// Flat config, required by eslint-config-next@16 (eslint >= 9). Replaces
// .eslintrc.json's `extends: "next/core-web-vitals"` — the package now exports
// the equivalent flat array directly. `next lint` was removed in Next 16, so
// package.json's lint script invokes eslint itself.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  // Unlike `next lint`, bare eslint does not know about Next's build output.
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...nextCoreWebVitals,
  // No rule downgrades. The two that arrived with this toolchain
  // (eslint-plugin-react-hooks 7, eslint-config-next 16) were briefly warnings
  // while the security upgrade was in flight; both are back at their default
  // error severity:
  //  - set-state-in-effect: all 4 sites rewritten to adjust state during
  //    render (companies ×2, compare) or to read an external store
  //    (entrance's clock), so none of them sets state from an effect any more.
  //  - no-html-link-for-pages: the 2 sites are deliberate basePath escapes and
  //    carry a targeted eslint-disable-next-line each, so the rule still
  //    catches an accidental <a> anywhere else.
]

export default config
