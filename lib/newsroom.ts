import Anthropic from '@anthropic-ai/sdk'
import {
  NewsroomResult,
  NewsArticle,
  NewsCategory,
  SourceTier,
} from '@/types/newsroom'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// The model used for the newsroom. Kept consistent with ACC360's chatbot.
const MODEL = 'claude-sonnet-4-6'

// ─── Source tiering ──────────────────────────────────────────────────────────
// Ported from the original Client-Newsroom credibility logic. Used to label
// each article so the deal team can weight coverage. We compute tier ourselves
// from the domain rather than trusting the model to assign it.

const TIER_1 = new Set([
  'nytimes.com', 'wsj.com', 'washingtonpost.com', 'bbc.com', 'bbc.co.uk',
  'apnews.com', 'reuters.com', 'bloomberg.com', 'ft.com', 'economist.com',
  'cnbc.com', 'forbes.com', 'cnn.com', 'theguardian.com', 'npr.org',
])

const TIER_2 = new Set([
  // Ad / marketing / agency trade press — most relevant for ACC's targets
  'adage.com', 'adweek.com', 'digiday.com', 'thedrum.com', 'marketingdive.com',
  'campaignlive.com', 'campaignlive.co.uk', 'prweek.com', 'prnewswire.com',
  'businesswire.com', 'agencyspy.com', 'mediapost.com', 'thewrap.com',
  // Tech / business
  'techcrunch.com', 'theverge.com', 'wired.com', 'axios.com', 'businessinsider.com',
  'fastcompany.com', 'fortune.com', 'inc.com', 'entrepreneur.com', 'variety.com',
  'hollywoodreporter.com', 'deadline.com', 'fool.com', 'crunchbase.com',
])

export function tierForDomain(domain?: string): SourceTier {
  if (!domain) return 't3'
  const d = domain.toLowerCase().replace(/^www\./, '')
  if (TIER_1.has(d)) return 't1'
  if (TIER_2.has(d)) return 't2'
  // sub-path / regional variants
  for (const t1 of Array.from(TIER_1)) if (d.endsWith(t1)) return 't1'
  for (const t2 of Array.from(TIER_2)) if (d.endsWith(t2)) return 't2'
  return 't3'
}

function domainFromUrl(url: string): string | undefined {
  try {
    const u = url.startsWith('http') ? url : `https://${url}`
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

const VALID_CATEGORIES: NewsCategory[] = [
  'ma', 'leadership', 'finance', 'client', 'drama', 'award', 'general',
]

function normalizeCategory(c: unknown): NewsCategory {
  if (typeof c === 'string' && VALID_CATEGORIES.includes(c as NewsCategory)) {
    return c as NewsCategory
  }
  return 'general'
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the research engine behind ACC360's Newsroom. ACC is an agency-acquisition company; the user is a deal team member researching a potential acquisition target. Your job: use web search to find RECENT, REAL news about one specific company, then return a structured intelligence briefing.

NON-NEGOTIABLE ACCURACY RULES:
- Every article you report MUST come from an actual web search result you retrieved. NEVER invent a headline, outlet, URL, or date. If you are unsure a result is real, omit it.
- Only include articles that are genuinely about THIS company — the agency identified by the given name AND website domain. Many agencies share common-word names (e.g. "Hero", "Battery", "Bakery", "Mythology"). Use the domain, location, industry, and leadership name to disambiguate. When a result could be about a different entity with the same name, EXCLUDE it.
- Prefer coverage from the last 90 days. Older items are acceptable only when they are materially important (e.g. the acquisition that defines the company's current status).
- Paraphrase. Write every snippet in your own words. Do not reproduce sentences from the source. Keep snippets to 1–2 sentences.
- If you find little or no real coverage, say so honestly via the "sparse" flag. Returning 2 real articles is correct; padding to 8 with guesses is a failure.

CATEGORIES — tag each article with exactly one:
- "ma": acquisitions, mergers, being acquired, PE investment, sale rumors
- "leadership": executive hires, departures, promotions, founder moves, org restructuring
- "finance": revenue, funding rounds, financial results, valuation, pricing/model changes
- "client": new client wins, account losses, notable campaigns or work
- "drama": controversy, layoffs, lawsuits, reputational issues, negative press
- "award": awards, rankings, recognition, "best places to work" type lists
- "general": clearly relevant to the company but none of the above

OUTPUT — return ONLY valid JSON (no markdown fences, no preamble) in this exact shape:
{
  "summary": "2-4 sentence executive summary of what's happening with this company right now, written for an acquirer.",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "flags": [
    { "category": "<one of the categories>", "text": "One-line deal-relevant signal." }
  ],
  "articles": [
    {
      "title": "Exact headline from the search result",
      "url": "Full article URL from the search result",
      "source": "Publisher name",
      "publishedAt": "YYYY-MM-DD if known, else omit",
      "category": "<one of the categories>",
      "snippet": "Your 1-2 sentence paraphrased summary."
    }
  ]
}

confidence guidance: HIGH = several articles across multiple reputable sources with a consistent picture; MEDIUM = some coverage, mixed or limited sources; LOW = little coverage or single-source.
flags: 0-5 items. Surface what an acquirer must know — especially M&A status (is the company independent or already acquired?), leadership stability, and any reputational risk. If the company appears defunct or already acquired, that is the single most important flag.`

function buildUserPrompt(opts: {
  name: string
  domain?: string
  vertical?: string
  hq?: string
  contact?: string
}): string {
  const { name, domain, vertical, hq, contact } = opts
  const lines = [
    `Research this company and return the JSON briefing:`,
    ``,
    `Company name: ${name}`,
  ]
  if (domain) lines.push(`Website / domain: ${domain}  (use this to confirm identity)`)
  if (vertical) lines.push(`Industry / vertical: ${vertical}`)
  if (hq) lines.push(`Headquarters: ${hq}`)
  if (contact) lines.push(`Known leadership: ${contact}`)
  lines.push(
    ``,
    `Search the web for recent news about this specific company. Confirm each result matches the domain/identity above before including it. Return ONLY the JSON object.`,
  )
  return lines.join('\n')
}

// ─── Response parsing ────────────────────────────────────────────────────────

function extractJson(text: string): any | null {
  // Strip accidental code fences, then grab the outermost JSON object.
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

// Collect all text blocks from the response (web search interleaves tool blocks).
function gatherText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

// ─── Public entry point ──────────────────────────────────────────────────────

export interface NewsroomInput {
  name: string
  domain?: string
  vertical?: string
  hq?: string
  contact?: string
}

// TEMP DEBUG — remove after Vercel issue is diagnosed
export interface NewsroomDebug {
  company: string
  elapsedMs?: number          // ms for the Anthropic messages.create() call
  stopReason?: string
  blockTypes?: string[]
  toolUseBlocks?: number
  searchResultBlocks?: number
  rawTextLen?: number
  /** Exact billing figures from the API response. Estimating input tokens from
   *  character counts was off by an unknown factor — server-side web search
   *  results are billed as input and accumulate across search iterations within
   *  a single turn, so the visible output length says nothing about the input
   *  side. This makes the real number observable per company. */
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  webSearchRequests?: number
  rawSnippet?: string
  parseOk?: boolean
  articleCount?: number
  thrownError?: string        // set when messages.create() throws (includes HTTP status + body)
}

export async function getCompanyNews(
  input: NewsroomInput,
  debug?: NewsroomDebug,
): Promise<NewsroomResult> {
  const { name, domain } = input
  const generatedAt = new Date().toISOString()

  // TEMP DEBUG: time the Anthropic call; capture SDK error details if it throws.
  const t0 = Date.now()
  let response: Awaited<ReturnType<typeof anthropic.messages.create>>
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(input) }],
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 6,
        } as any,
      ],
    })
  } catch (err: any) {
    if (debug) {
      debug.elapsedMs   = Date.now() - t0
      // Anthropic SDK errors expose .status (HTTP code) and .error (parsed body)
      const httpStatus  = err?.status  != null ? ` [HTTP ${err.status}]` : ''
      const errBody     = err?.error   != null ? ` body=${JSON.stringify(err.error)}` : ''
      debug.thrownError = `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}${httpStatus}${errBody}`
    }
    throw err
  }

  // ── Diagnostic (TEMP) ───────────────────────────────────────────────────────
  const elapsed         = Date.now() - t0
  const blockSummary    = response.content.map((b) => b.type)
  const searchUseBlocks = response.content.filter((b) => b.type === 'tool_use').length
  const searchResBlocks = response.content.filter((b) => b.type === 'web_search_tool_result').length
  console.log(`[newsroom:${name}] elapsed=${elapsed}ms stop_reason=${response.stop_reason} blocks=${JSON.stringify(blockSummary)}`)
  console.log(`[newsroom:${name}] tool_use=${searchUseBlocks} search_results=${searchResBlocks}`)
  // ── End diagnostic ──────────────────────────────────────────────────────────

  const raw    = gatherText(response.content)
  const parsed = extractJson(raw)

  console.log(`[newsroom:${name}] raw_len=${raw.length} snippet=${raw.slice(0, 200).replace(/\n/g, ' ')}`)
  console.log(`[newsroom:${name}] parse_ok=${parsed !== null} articles=${Array.isArray(parsed?.articles) ? parsed.articles.length : 'n/a'}`)

  // Populate caller-supplied debug object so the HTTP response can surface it.
  if (debug) {
    debug.elapsedMs          = elapsed
    debug.stopReason         = String(response.stop_reason)
    debug.blockTypes         = blockSummary
    debug.toolUseBlocks      = searchUseBlocks
    debug.searchResultBlocks = searchResBlocks
    debug.rawTextLen         = raw.length
    debug.inputTokens          = response.usage?.input_tokens
    debug.outputTokens         = response.usage?.output_tokens
    debug.cacheReadTokens      = response.usage?.cache_read_input_tokens ?? undefined
    debug.cacheCreationTokens  = response.usage?.cache_creation_input_tokens ?? undefined
    debug.webSearchRequests    = response.usage?.server_tool_use?.web_search_requests ?? undefined
    debug.rawSnippet         = raw.slice(0, 300).replace(/\n/g, ' ')
    debug.parseOk            = parsed !== null
    debug.articleCount       = Array.isArray(parsed?.articles) ? parsed.articles.length : 0
  }

  // If the model returned no parseable JSON, fail honestly rather than fabricating.
  if (!parsed) {
    console.warn(`[newsroom:${name}] no parseable JSON — stop_reason="${response.stop_reason}"`)
    return {
      company: name,
      domain,
      generatedAt,
      brief: {
        summary: `Search completed for ${name}. The results could not be assembled into a briefing this time. Try refreshing.`,
        flags: [],
        confidence: 'LOW',
        sourceCount: 0,
      },
      articles: [],
      sparse: true,
      note: 'No structured result was produced.',
    }
  }

  // Normalize + tier the articles. We compute tier ourselves from the domain.
  const articlesRaw: any[] = Array.isArray(parsed.articles) ? parsed.articles : []
  const seen = new Set<string>()
  const articles: NewsArticle[] = []

  for (const a of articlesRaw) {
    if (!a || typeof a.title !== 'string' || typeof a.url !== 'string') continue
    const url: string = a.url
    if (seen.has(url)) continue
    seen.add(url)

    const sourceDomain = domainFromUrl(url)
    articles.push({
      title: a.title.trim(),
      url,
      source: typeof a.source === 'string' && a.source.trim()
        ? a.source.trim()
        : (sourceDomain ?? 'Unknown'),
      sourceDomain,
      tier: tierForDomain(sourceDomain),
      publishedAt: typeof a.publishedAt === 'string' ? a.publishedAt : undefined,
      ageLabel: ageLabel(a.publishedAt),
      category: normalizeCategory(a.category),
      snippet: typeof a.snippet === 'string' ? a.snippet.trim() : '',
    })
  }

  // Sort: newest-ish first, then by source tier (t1 above t3).
  const tierRank: Record<SourceTier, number> = { t1: 0, t2: 1, t3: 2 }
  articles.sort((x, y) => {
    const dx = x.publishedAt ? Date.parse(x.publishedAt) : 0
    const dy = y.publishedAt ? Date.parse(y.publishedAt) : 0
    if (dy !== dx) return dy - dx
    return tierRank[x.tier] - tierRank[y.tier]
  })

  const sourceCount = new Set(articles.map((a) => a.sourceDomain ?? a.source)).size
  const flags = Array.isArray(parsed.flags)
    ? parsed.flags
        .filter((fl: any) => fl && typeof fl.text === 'string')
        .slice(0, 5)
        .map((fl: any) => ({
          category: normalizeCategory(fl.category),
          text: fl.text.trim(),
        }))
    : []

  const confidence =
    parsed.confidence === 'HIGH' || parsed.confidence === 'MEDIUM' || parsed.confidence === 'LOW'
      ? parsed.confidence
      : articles.length >= 5
        ? 'MEDIUM'
        : 'LOW'

  const sparse = articles.length === 0

  return {
    company: name,
    domain,
    generatedAt,
    brief: {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : `Limited recent coverage was found for ${name}.`,
      flags,
      confidence,
      sourceCount,
    },
    articles,
    sparse,
    note: sparse ? 'No clearly-matching recent coverage was found for this company.' : undefined,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ageLabel(publishedAt?: unknown): string | undefined {
  if (typeof publishedAt !== 'string') return undefined
  const t = Date.parse(publishedAt)
  if (isNaN(t)) return undefined
  const days = Math.floor((Date.now() - t) / 86_400_000)
  if (days < 0) return undefined
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}
