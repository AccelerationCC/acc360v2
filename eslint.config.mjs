// Flat config, required by eslint-config-next@16 (eslint >= 9). Replaces
// .eslintrc.json's `extends: "next/core-web-vitals"` — the package now exports
// the equivalent flat array directly. `next lint` was removed in Next 16, so
// package.json's lint script invokes eslint itself.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  // Unlike `next lint`, bare eslint does not know about Next's build output.
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...nextCoreWebVitals,
  {
    // Rules that arrived with this toolchain (eslint-plugin-react-hooks 7,
    // eslint-config-next 16) and fire on pre-existing, working code. The
    // 2026-08 dependency-security branch deliberately changes no component
    // behavior, so these stay visible as warnings instead of blocking the
    // gate. Tightening them back to errors is a follow-up cleanup:
    //  - set-state-in-effect: 4 sites (companies, compare, entrance)
    //  - no-html-link-for-pages: 2 plain <a href="/"> full-reload links whose
    //    behavior under basePath differs from <Link> on purpose.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
]

export default config
