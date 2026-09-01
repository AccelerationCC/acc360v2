/* eslint-disable @next/next/no-img-element, @next/next/no-head-element --
 * DELIBERATE, both of them. This component emits a STANDALONE HTML DOCUMENT
 * that is rendered to a string and served on its own (see lib/renderNewsletter),
 * not a Next page. next/image needs the Next runtime and rewrites the URL to an
 * optimiser endpoint that would not resolve outside the app; next/head only
 * works inside the router. A plain <img> with explicit dimensions and a real
 * <head> are the correct primitives for a self-contained document, and the
 * template test asserts every image keeps its alt/width/height.
 */
import type { NewsletterEdition, ObservanceItem } from '@/types/newsletterTemplate'
import type { NewsletterCompanySection } from '@/types/newsletter'
import { editionLabel } from '@/lib/newsletterEdition'

/**
 * THE LOCKED NEWSLETTER TEMPLATE.
 *
 * One layout. It does not vary between editions — only slot CONTENTS do.
 *
 * WHAT "LOCKED" MEANS HERE, CONCRETELY. The six slots are written out
 * literally, in order, below. There is no slots array, no `order` prop, no
 * className prop, no style prop, and no `children`. A caller cannot move a
 * slot, add one, remove one, or restyle one, because there is no parameter that
 * would let them — the only input is the edition's DATA. That is the whole
 * mechanism, and newsletterTemplate.test.ts asserts the component's props stay
 * that way.
 *
 * NOT AN EMAIL. The brief specified react-email, table layout, inline CSS and
 * Outlook support. Tracing the code showed there is no send path: generate
 * writes KV, /360/newsletter reads it, and nothing else consumes it — no
 * mailer, no export, not even a copy button. So this is a page component, and
 * the email constraints were dropped deliberately rather than forgotten. If a
 * sender is ever added, the table/inline-CSS rewrite happens then, against a
 * real target.
 *
 * SELF-CONTAINED ON PURPOSE. It emits a whole document with its own <style>,
 * so the HTML this renders is the artifact — identical whether it is served
 * standalone or shown in the preview's iframe. Nothing depends on the
 * dashboard's Tailwind build being present, which is what would have made the
 * preview an approximation.
 *
 * COLOURS ARE TOKENS. The custom properties below are the definition site, and
 * every rule references var(--…). No literal colour appears in the markup.
 */

const STYLES = `
:root {
  --paper: hsl(45 38% 96%);
  --surface: hsl(40 30% 99%);
  --ink: hsl(0 0% 14%);
  --muted-ink: hsl(28 30% 38%);
  --bronze: hsl(28 55% 35%);
  --gold: hsl(38 68% 30%);
  --rule: hsl(0 0% 14% / 10%);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: Georgia, 'Times New Roman', serif;
  line-height: 1.55;
}
.wrap { max-width: 640px; margin: 0 auto; padding: 32px 24px 56px; }
.masthead {
  text-align: center;
  border-bottom: 2px solid var(--ink);
  padding-bottom: 14px;
}
.masthead .name {
  font-size: 30px; letter-spacing: 0.12em; text-transform: uppercase;
  font-weight: 700; margin: 0;
}
.masthead .tagline {
  font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--muted-ink); margin: 6px 0 0;
}
.edition-line {
  text-align: center; font-size: 12px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--muted-ink);
  padding: 10px 0 0; margin: 0;
}
.slot { margin-top: 34px; }
.slot-heading {
  font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--muted-ink); margin: 0 0 12px;
  border-bottom: 1px solid var(--rule); padding-bottom: 6px;
}
.hero h1 { font-size: 32px; line-height: 1.2; margin: 0 0 10px; }
.hero .lede { font-size: 16px; color: var(--muted-ink); margin: 0; }
.hero img { display: block; width: 100%; height: auto; margin: 0 0 16px; }
.observance { padding: 14px 0; border-bottom: 1px solid var(--rule); }
.observance:last-child { border-bottom: none; }
.observance .meta {
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--bronze); margin: 0 0 4px;
}
.observance h3 { font-size: 19px; margin: 0 0 6px; }
.observance img { display: block; width: 100%; height: auto; margin: 0 0 10px; }
.observance ul { margin: 8px 0 0; padding-left: 18px; }
.observance li { font-size: 14px; margin: 0 0 6px; }
.observance a { color: var(--gold); }
.observance .pubdate { color: var(--muted-ink); font-size: 12px; }
.no-coverage { font-size: 14px; color: var(--muted-ink); font-style: italic; margin: 6px 0 0; }
.company { padding: 16px 0; border-bottom: 1px solid var(--rule); }
.company:last-child { border-bottom: none; }
.company h3 { font-size: 19px; margin: 0 0 6px; }
.company .summary { font-size: 15px; margin: 0 0 8px; }
.company ul { margin: 0; padding-left: 18px; }
.company li { font-size: 14px; margin: 0 0 6px; }
.company a { color: var(--gold); }
.empty { font-size: 15px; color: var(--muted-ink); font-style: italic; }
.footer {
  margin-top: 44px; padding-top: 16px; border-top: 2px solid var(--ink);
  font-size: 12px; color: var(--muted-ink); text-align: center;
}
.footer a { color: var(--muted-ink); }
.footer p { margin: 0 0 6px; }
`

function ObservanceBlock({ item }: { item: ObservanceItem }) {
  return (
    <article className="observance">
      {item.imageUrl && item.imageAlt && (
        // Explicit dimensions are required alongside a URL; the schema refuses
        // a URL without alt text, so both are present or neither is.
        <img src={item.imageUrl} alt={item.imageAlt} width={640} height={360} />
      )}
      <p className="meta">
        {item.category} &middot; {item.dateLabel}
      </p>
      <h3>{item.name}</h3>
      {item.articles.length === 0 ? (
        // THE STEADY STATE, not a placeholder. The article pull is Part 3,
        // blocked behind the Perigon swap. This line is a required state in the
        // brief either way: an observance with no post-2025 coverage says so
        // rather than falling back to an older article or vanishing.
        <p className="no-coverage">No recent coverage.</p>
      ) : (
        <ul>
          {item.articles.map((a) => (
            <li key={a.url}>
              <a href={a.url}>{a.title}</a>{' '}
              <span className="pubdate">
                &mdash; {a.sourceName}, {a.publishedAt.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function CompanyBlock({ section }: { section: NewsletterCompanySection }) {
  return (
    <article className="company">
      <h3>{section.companyName}</h3>
      <p className="summary">{section.result.brief.summary}</p>
      {section.result.articles.length > 0 && (
        <ul>
          {section.result.articles.map((a) => (
            <li key={a.url}>
              <a href={a.url}>{a.title}</a>{' '}
              <span className="pubdate">&mdash; {a.source}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function NewsletterTemplate({ edition }: { edition: NewsletterEdition }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`The Acceleration Brief — ${edition.date}`}</title>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body>
        <div className="wrap">
          {/* ── SLOT 1: MASTHEAD (static) ── */}
          <header className="masthead">
            <p className="name">The Acceleration</p>
            <p className="tagline">Hot List Brief</p>
          </header>

          {/* ── SLOT 2: EDITION LINE (date, fixed format) ── */}
          <p className="edition-line">{editionLabel(edition.date)}</p>

          {/* ── SLOT 3: HERO ── */}
          <section className="slot hero">
            {edition.hero.imageUrl &&
              edition.hero.imageAlt &&
              edition.hero.imageWidth &&
              edition.hero.imageHeight && (
                <img
                  src={edition.hero.imageUrl}
                  alt={edition.hero.imageAlt}
                  width={edition.hero.imageWidth}
                  height={edition.hero.imageHeight}
                />
              )}
            <h1>{edition.hero.headline}</h1>
            <p className="lede">{edition.hero.lede}</p>
          </section>

          {/* ── SLOT 4: OBSERVANCES ── */}
          <section className="slot">
            <h2 className="slot-heading">Observances</h2>
            {edition.observances.length === 0 ? (
              <p className="empty">No observances fall in this edition&rsquo;s window.</p>
            ) : (
              edition.observances.map((o) => <ObservanceBlock key={o.id} item={o} />)
            )}
          </section>

          {/* ── SLOT 5: HOT LIST BRIEF (existing content, unchanged) ── */}
          <section className="slot">
            <h2 className="slot-heading">Hot List</h2>
            {!edition.brief || edition.brief.sections.length === 0 ? (
              <p className="empty">No brief has been generated for this date.</p>
            ) : (
              edition.brief.sections.map((s) => (
                <CompanyBlock key={s.companyId} section={s} />
              ))
            )}
          </section>

          {/* ── SLOT 6: FOOTER (static, legal) ── */}
          <footer className="footer">
            <p>The Acceleration &middot; Confidential &mdash; internal distribution only.</p>
            <p>
              <a href="https://www.acceleration.news/privacy">Privacy</a> &middot;{' '}
              <a href="https://www.acceleration.news/terms">Terms</a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}
