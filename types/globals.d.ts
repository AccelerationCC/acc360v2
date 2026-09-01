// Clerk user metadata, typed.
//
// This repo previously declared NOTHING here, so `user.publicMetadata` fell
// back to Clerk's `{ [k: string]: unknown }` and every read — adminGuard,
// execGuard, useAdmin, the /companies/new page — was reaching into an untyped
// bag. That is also why `role` needed a `typeof` guard at each site rather than
// being known to be a string.
//
// Unlike client-newsroom, this app does NOT read a session-token claim: every
// role and capability read goes to the live user via currentUser() on the
// server or useUser() on the client (see lib/execGuard.ts and
// lib/adminGuard.ts, which say why). So there is no CustomJwtSessionClaims
// declaration here — adding one would imply a JWT dependency this app
// deliberately does not have.
export {};

/**
 * THE AUTHORITATIVE ROLE SET, confirmed from the role literals actually
 * compared in both repos' auth code:
 *
 *   "hr" | "exec" | "superexec" | "king" | "admin"
 *
 * ("admin" is the temporary bridge — see lib/roles.ts.)
 *
 * Left OPEN rather than closed. Role values come from Clerk, outside this
 * codebase, and can be hand-edited in the Dashboard to anything; every guard
 * already fails closed on an unrecognised value. A closed union would invite
 * exhaustiveness assumptions over data we do not control.
 */
type KnownRole = "hr" | "exec" | "superexec" | "king" | "admin";
type RoleValue = KnownRole | (string & {});

declare global {
  /**
   * `capabilities` is the second, orthogonal axis — see lib/capabilities.ts.
   * Typed `string[]` and not the narrow union on purpose: this describes what
   * arrives from Clerk, which may include a capability written by a newer
   * deploy that this build does not know. parseCapabilities() is the only thing
   * that turns it into known values, and it drops what it does not recognise.
   *
   * Note this interface declaration-MERGES with Clerk's own
   * `{ [k: string]: unknown }` rather than replacing it, so arbitrary extra
   * keys still type-check. Naming the fields buys editor support and a typed
   * read; it is not an authorization boundary.
   */
  interface UserPublicMetadata {
    role?: RoleValue | null;
    capabilities?: string[];
  }
}
