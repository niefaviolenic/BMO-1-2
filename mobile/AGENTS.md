# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Architecture & Engineering Principles

- **Clean Architecture**: Always follow Clean Architecture principles (separation of concerns across data, domain, and presentation layers).
- **Atomic Design & Reusable Components**: Always structure and build UI components using Atomic Design principles (Atoms, Molecules, Organisms, Templates/Screens). Always prioritize modular, reusable components to avoid code duplication and maintain consistency across all screens.
- **Design Tokens**: Always define and consume design tokens from `src/constants/theme.ts` (and `src/global.css` where applicable) instead of hardcoding style values.
  - **No Magic Values**: Never hardcode magic numbers or raw color hex codes (e.g., `#FFFFFF`, `rgba(...)`, raw `fontSize`, raw `margin`/`padding`) in component styles.
  - **Colors**: Use `Colors.light` / `Colors.dark` or semantic color tokens (`useTheme()`) for all background, foreground, border, and status colors to guarantee light and dark mode support.
  - **Typography & Fonts**: Use `Fonts` and standardized typography tokens (`fontSize`, `fontWeight`, `lineHeight`).
  - **Spacing**: Use standard spacing scales from `Spacing` (`half`, `one`, `two`, `three`, `four`, `five`, `six`) for margins, paddings, and gap dimensions.
  - **Component & Feature-Specific Tokens**: Centralize feature- and component-specific design tokens (e.g., `WelcomeTokens`, `SplashTokens`, `SettingsTokens`) in `src/constants/theme.ts` to keep styling consistent across Figma designs and code.

# Testing & Visual Verification

- **Visual & Functional Testing**: Always test on an emulator running **Expo Go** (`appId: host.exp.exponent` with `expo start`) by default. Do not run or trigger native builds (`expo run:android` / `expo run:ios`) unless explicitly requested by the user.

