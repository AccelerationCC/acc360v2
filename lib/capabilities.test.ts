import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  type Capability,
  effectiveCapabilities,
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
  // Additive by design. Phase 1 ships exactly these two; a later phase adding a
  // third should update this deliberately, in both repos.
  it("is exactly ultra and plus", () => {
    expect([...CAPABILITIES]).toEqual(["ultra", "plus", "add", "crown"]);
  });
});

// ── crown, the implication ─────────────────────────────────────────────────
//
// The rule: granting crown means the stored array reads ["crown"] and nothing
// else, and hasCapability answers true for the three it covers. The failure it
// exists to prevent is a half-revoked state — ultra/plus/add written INTO the
// array beside crown, so revoking crown leaves them behind.

describe("crown implies ultra, plus and add", () => {
  const crownOnly = { capabilities: ["crown"] };

  it.each(["ultra", "plus", "add"] as const)(
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

  it("REMOVING crown removes all four — the whole point", () => {
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

describe("effectiveCapabilities — for display, never for a gate", () => {
  it("expands crown into everything it covers", () => {
    expect(effectiveCapabilities({ capabilities: ["crown"] })).toEqual([
      "ultra",
      "plus",
      "add",
      "crown",
    ]);
  });

  it("leaves a non-crown set alone — the control", () => {
    expect(effectiveCapabilities({ capabilities: ["plus"] })).toEqual(["plus"]);
  });

  it("differs from parseCapabilities on crown, and that is the distinction", () => {
    const meta = { capabilities: ["crown"] };
    expect(parseCapabilities(meta)).toEqual(["crown"]);
    expect(effectiveCapabilities(meta)).toHaveLength(4);
  });
});
