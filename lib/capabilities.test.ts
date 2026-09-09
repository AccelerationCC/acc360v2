import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  type Capability,
  capabilitiesForDisplay,
  hasCapability,
  isCapability,
  parseCapabilities,
} from "./capabilities";

// THE SHARED BEHAVIOUR TABLE — copied verbatim from
// client-newsroom/src/lib/capabilities.test.ts. If the two ever disagree, the
// two apps disagree about who holds a capability, so these cases are the
// contract rather than examples. Keep them in step with the source.
const TABLE: Array<{ name: string; metadata: unknown; expected: Capability[] }> = [
  // Absent or empty
  { name: "role only, no capabilities key", metadata: { role: "exec" }, expected: [] },
  { name: "empty object", metadata: {}, expected: [] },
  { name: "explicit empty array", metadata: { capabilities: [] }, expected: [] },
  { name: "undefined value", metadata: { capabilities: undefined }, expected: [] },
  { name: "null value", metadata: { capabilities: null }, expected: [] },

  // Not an array
  { name: "bare string", metadata: { capabilities: "ultra" }, expected: [] },
  { name: "object", metadata: { capabilities: { ultra: true } }, expected: [] },
  { name: "number", metadata: { capabilities: 1 }, expected: [] },
  { name: "boolean", metadata: { capabilities: true }, expected: [] },

  // Not metadata at all
  { name: "undefined metadata", metadata: undefined, expected: [] },
  { name: "null metadata", metadata: null, expected: [] },
  { name: "string metadata", metadata: "nonsense", expected: [] },
  { name: "number metadata", metadata: 42, expected: [] },
  { name: "array metadata", metadata: ["ultra"], expected: [] },

  // Real values
  { name: "one capability", metadata: { capabilities: ["ultra"] }, expected: ["ultra"] },
  { name: "the other one", metadata: { capabilities: ["plus"] }, expected: ["plus"] },
  {
    name: "both, alongside a role",
    metadata: { role: "king", capabilities: ["ultra", "plus"] },
    expected: ["ultra", "plus"],
  },

  // Unknown entries are ignored, not fatal
  {
    name: "unknown entry dropped, known kept",
    metadata: { capabilities: ["ultra", "telepathy"] },
    expected: ["ultra"],
  },
  {
    name: "only unknown entries",
    metadata: { capabilities: ["telepathy", "flight"] },
    expected: [],
  },
  {
    name: "mixed junk types inside the array",
    metadata: { capabilities: ["plus", 1, null, {}, ["ultra"]] },
    expected: ["plus"],
  },

  // Normalisation
  {
    name: "duplicates collapse",
    metadata: { capabilities: ["ultra", "ultra", "plus"] },
    expected: ["ultra", "plus"],
  },
  {
    name: "order is canonical, not as-written",
    metadata: { capabilities: ["plus", "ultra"] },
    expected: ["ultra", "plus"],
  },

  // Case-sensitive, like every role check in both repos
  { name: "wrong case is unknown", metadata: { capabilities: ["ULTRA"] }, expected: [] },
  { name: "padded is unknown", metadata: { capabilities: [" ultra"] }, expected: [] },
];

describe("parseCapabilities", () => {
  for (const { name, metadata, expected } of TABLE) {
    it(name, () => {
      expect(parseCapabilities(metadata)).toEqual(expected);
    });
  }

  it("never throws, whatever it is handed", () => {
    for (const input of [undefined, null, 0, "", [], {}, NaN, Symbol("x"), () => {}]) {
      expect(() => parseCapabilities(input as unknown)).not.toThrow();
    }
  });
});

describe("hasCapability", () => {
  it("answers from the parsed set", () => {
    const md = { capabilities: ["ultra"] };
    expect(hasCapability(md, "ultra")).toBe(true);
    expect(hasCapability(md, "plus")).toBe(false);
  });

  // THE PIN THAT MATTERS MOST. Tier and capability are orthogonal: a king with
  // no capabilities holds none. If anyone ever adds a "king implies
  // everything" shortcut, this is what fails.
  it("gives a king NOTHING implicitly", () => {
    for (const role of ["king", "superexec", "admin", "exec", "hr"]) {
      for (const cap of CAPABILITIES) {
        expect(hasCapability({ role }, cap), `${role} must not imply ${cap}`).toBe(false);
      }
    }
  });

  // The mirror: no tier at all does not prevent holding a capability.
  it("grants a roleless user a capability they were given", () => {
    expect(hasCapability({ capabilities: ["plus"] }, "plus")).toBe(true);
    expect(hasCapability({ role: null, capabilities: ["plus"] }, "plus")).toBe(true);
  });

  it("is false for every capability when metadata is unusable", () => {
    for (const cap of CAPABILITIES) {
      expect(hasCapability(undefined, cap)).toBe(false);
      expect(hasCapability({ capabilities: "ultra" }, cap)).toBe(false);
    }
  });
});

describe("isCapability", () => {
  it("accepts exactly the known set", () => {
    for (const cap of CAPABILITIES) expect(isCapability(cap)).toBe(true);
  });

  it("rejects everything else", () => {
    for (const v of ["telepathy", "Ultra", "", null, undefined, 1, {}, ["ultra"]]) {
      expect(isCapability(v)).toBe(false);
    }
  });
});

describe("the capability list itself", () => {
  // Additive by design. A later phase adding another should update this
  // deliberately, in both repos. `crown` is in the list because it IS a
  // capability someone is granted — what makes it different is that
  // hasCapability expands it, not that it is stored differently.
  //
  // `learn` is last, and crown DOES cover it — since 2026-09-09, and not
  // before. The crown block below carries the reversal and what it rests on.
  it("is exactly ultra, plus, add, crown and learn", () => {
    expect([...CAPABILITIES]).toEqual(["ultra", "plus", "add", "crown", "learn"]);
  });
});

// ── crown, the implication ─────────────────────────────────────────────────
//
// The rule: granting crown means the stored array reads ["crown"] and nothing
// else, and hasCapability answers true for the four it covers. The failure it
// exists to prevent is a half-revoked state — ultra/plus/add/learn written INTO
// the array beside crown, so revoking crown leaves them behind.

describe("crown implies ultra, plus, add and learn", () => {
  const crownOnly = { capabilities: ["crown"] };

  it.each(["ultra", "plus", "add", "learn"] as const)(
    "grants %s from an array holding only crown",
    (cap) => {
      expect(hasCapability(crownOnly, cap)).toBe(true);
    },
  );

  it("grants crown itself", () => {
    expect(hasCapability(crownOnly, "crown")).toBe(true);
  });

  it("parseCapabilities returns EXACTLY [\"crown\"] — never the expansion", () => {
    // The pin. If expansion ever migrates into the parser, "what does this user
    // hold" starts disagreeing with what Clerk actually stores, and a revoke
    // looks like it left three capabilities behind.
    expect(parseCapabilities(crownOnly)).toEqual(["crown"]);
  });

  it("REMOVING crown removes all five — the whole point", () => {
    // The control for the tests above. If the grants came from the array rather
    // than the implication, this is where it would show: they would survive.
    const revoked = { capabilities: [] };
    for (const cap of CAPABILITIES) expect(hasCapability(revoked, cap)).toBe(false);
  });

  it("does not work in reverse — add does not imply crown", () => {
    const addOnly = { capabilities: ["add"] };
    expect(hasCapability(addOnly, "add")).toBe(true);
    expect(hasCapability(addOnly, "crown")).toBe(false);
    expect(hasCapability(addOnly, "ultra")).toBe(false);
    expect(hasCapability(addOnly, "plus")).toBe(false);
  });

  it("a KING with no capabilities still gets add — no, it does not", () => {
    // The equivalent of the existing plus assertion, for add. Tiers grant no
    // capability, and there is deliberately no king shortcut anywhere.
    expect(hasCapability({ role: "king", capabilities: [] }, "add")).toBe(false);
    expect(hasCapability({ role: "king" }, "add")).toBe(false);
    expect(hasCapability({ role: "king", capabilities: ["crown"] }, "add")).toBe(true);
  });
});


// ── learn, AND WHAT crown NOW COVERS ───────────────────────────────────────
//
// /learning is gated on `learn` (requireLearn in archive-auth.ts). Two things
// reach it: an explicit `learn` grant, and `crown`.
//
// crown was NOT one of them when `learn` was added on 2026-09-09 — it became
// one later the same day. That was a REVERSAL, not a bug fix: crown is
// permanently locked to a single account, so covering `learn` widens who can
// reach the area by nobody, and keeping them apart bought nothing.
//
// What the reversal rests on is Clerk state, which no test here can see. These
// cases pin the new answer; the tier case below them pins the half that did NOT
// move, which is the half someone would break by conflating the two axes.

describe("learn is reached by an explicit grant and by crown", () => {
  it("crown implies learn — the reversal, pinned", () => {
    expect(hasCapability({ capabilities: ["crown"] }, "learn")).toBe(true);
  });

  it("no tier implies learn — UNCHANGED by the reversal", () => {
    // crown is a capability someone is granted; king is a tier. Folding learn
    // into crown says nothing whatever about tiers, and this is what fails if
    // anyone ever reads the reversal as licence to add a king shortcut.
    for (const role of ["king", "superexec", "admin", "exec", "hr"]) {
      expect(hasCapability({ role }, "learn"), `${role} must not imply learn`).toBe(false);
      expect(hasCapability({ role, capabilities: [] }, "learn")).toBe(false);
    }
  });

  it("king + crown reaches it — via the crown, never via the king", () => {
    expect(hasCapability({ role: "king", capabilities: ["crown"] }, "learn")).toBe(true);
    // The control that names which half did the work: strip the crown and the
    // same king is refused. Without this line the assertion above would pass
    // just as happily under a king-implies-everything shortcut.
    expect(hasCapability({ role: "king", capabilities: [] }, "learn")).toBe(false);
  });

  it("the stored grant works on its own, with or without a tier", () => {
    expect(hasCapability({ capabilities: ["learn"] }, "learn")).toBe(true);
    expect(hasCapability({ role: null, capabilities: ["learn"] }, "learn")).toBe(true);
  });

  it("learn is still a leaf — it grants nothing else", () => {
    // Implication runs one way only. If it ran backwards, granting someone the
    // learning area would also hand them ultra, plus and add.
    const learnOnly = { capabilities: ["learn"] };
    for (const cap of ["ultra", "plus", "add", "crown"] as const) {
      expect(hasCapability(learnOnly, cap), `learn must not imply ${cap}`).toBe(false);
    }
  });
});

describe("capabilitiesForDisplay — for display, never for a gate", () => {
  it("expands crown into everything it covers", () => {
    expect(capabilitiesForDisplay({ capabilities: ["crown"] })).toEqual([
      "ultra",
      "plus",
      "add",
      "crown",
      "learn",
    ]);
  });

  it("leaves a non-crown set alone — the control", () => {
    expect(capabilitiesForDisplay({ capabilities: ["plus"] })).toEqual(["plus"]);
  });

  // Display and gate must agree in BOTH directions. This assertion used to read
  // `.not.toContain` and was correct then; it inverted with the IMPLIES change
  // rather than being deleted, because the property it guards — the two never
  // disagree about /learning — is the same property either way.
  it("shows learn for a crown holder — display agrees with the gate", () => {
    expect(capabilitiesForDisplay({ capabilities: ["crown"] })).toContain("learn");
  });

  it("crown+learn stored together collapses to the same set — expansion is idempotent", () => {
    expect(capabilitiesForDisplay({ capabilities: ["crown", "learn"] })).toEqual([
      "ultra",
      "plus",
      "add",
      "crown",
      "learn",
    ]);
  });

  it("differs from parseCapabilities on crown, and that is the distinction", () => {
    const meta = { capabilities: ["crown"] };
    expect(parseCapabilities(meta)).toEqual(["crown"]);
    expect(capabilitiesForDisplay(meta)).toHaveLength(5);
  });
});
