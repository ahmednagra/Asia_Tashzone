# context/ — React context providers

App-wide state shared through the tree. `ThemeContext.tsx` owns display preferences (theme, four-colour deck, reduced motion, large cards) and exposes `useTheme()` for colours and `usePrefs()` to read and change them.
