# theme/ — design tokens

`tokens.ts` is the single source for colours, fonts, radii, card sizes and table felt, mirroring the mehfil design (`Docs/design/`). `contrast.test.ts` checks WCAG contrast of every token pair. Components read colours through `useTheme()`, not from here directly, except for fixed table colours.
