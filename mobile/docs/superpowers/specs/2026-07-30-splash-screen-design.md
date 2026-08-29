# Splash Screen Design

Date: 2026-07-30
Status: Approved design; awaiting written-spec review
Target: Expo SDK 57 mobile app, Android validation
Figma source: [`Splash` 611:132489](https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=611-132489&m=dev)

## Goal

Implement the Joy splash experience as a native launch screen bridged into a pixel-accurate React Native overlay. Reproduce the approved Figma composition while adapting safely across the requested Android emulator sizes. Keep artwork and text as real reusable components rather than a full-screen screenshot.

## Source of Truth

### Full frame

The Figma frame is 402 × 874 px with a solid white background.

The frame contains:

- `Expression` (`611:139733`): 64 × 64 px at x=169, y=405.
- `Signature Text` (`611:132491`): `From Biner Labs`, 108 × 17 px at x=147, y=807.
- Safe-area documentation: 62 px top and 34 px bottom.
- A Dynamic Island visualization used as design documentation.

The red/pink safe-area guides, arrows, measurements, and Dynamic Island visualization are annotations. They must not be rendered in the Android app.

### Expression component

Figma Native inspection resolves `Expression` to component `Expression=Default` (`611:99622`) with variant property `Expression=Default`. Its exact rendered 64 × 64 PNG will be exported from Figma and committed locally. Expiring Figma URLs must not remain in production code.

Code Connect is unavailable for this file because the authenticated Figma account lacks a Dev or Full seat on an Organization or Enterprise plan. This does not block implementation: `get_design_context`, `download_assets`, and read-only `use_figma` inspection provide the required design and component data.

### Typography

Signature text uses SF Pro Regular at 14 px in Figma. Android must use its regular system sans font at 14 logical pixels because SF Pro cannot be assumed or redistributed. Visual baselines must therefore be platform-specific. Text remains a real native text node, not baked into an image.

## Product Behavior

Use a native splash followed immediately by a matching React Native overlay.

1. Native splash appears during process startup.
2. React overlay mounts over the existing app content.
3. Once the overlay has completed first layout, hide the native splash.
4. Keep the React overlay visible until 1,000 ms from its mount.
5. Fade the overlay out over 200 ms.
6. Remove the overlay and reveal the existing app.

If reduced motion is enabled, remove the overlay without the fade after the 1,000 ms hold.

The Android application ID will be `com.binerlabs.joy` so a local release APK can be built, installed, and launched directly by Maestro.

## Architecture

Use feature-local presentation boundaries:

```text
assets/images/splash/
  expression-default.png

src/features/splash/presentation/
  joy-expression.tsx
  splash-signature.tsx
  splash-screen.tsx
  splash-overlay.tsx

src/app/
  _layout.tsx
  splash.tsx

.maestro/
  splash/
  screenshots/
```

Responsibilities:

- `JoyExpression`: render the exact bundled Figma export with explicit dimensions and no transition or network work.
- `SplashSignature`: render the brand signature with splash typography tokens.
- `SplashScreen`: compose background, centered expression, and safe-area-aware signature. It owns no timer or navigation behavior.
- `SplashOverlay`: own native splash handoff, minimum display duration, reduced-motion handling, opacity animation, and removal callback.
- `src/app/_layout.tsx`: mount `SplashOverlay` above existing app content.
- `src/app/splash.tsx`: expose the same `SplashScreen` for direct deterministic Maestro audits. It must support stable section previews without duplicating visual code.

No data or domain layer is needed. This feature has no entities, repositories, remote data, persistence, or business rules. Adding empty layers would create ceremony rather than separation of concerns.

The existing Expo starter `AnimatedSplashOverlay` must be replaced or retired so two splash overlays never stack.

## Design Tokens

Extend the project token module instead of hardcoding values inside components. Tokens must cover:

- background: `#FFFFFF`
- foreground text: `#000000`
- expression size: `64`
- signature font size: `14`
- signature line height: `17`
- signature safe-area gap: `16`
- minimum visible duration: `1,000 ms`
- fade duration: `200 ms`

Existing global light/dark theme behavior must not alter splash colors. Splash always matches the approved white Figma frame.

## Layout

### Root

Use a full-window white view. Centering must use the complete viewport, not the safe-area content rectangle.

### Expression

For the 402 × 874 reference:

- x=169 and width=64 produce horizontal center x=201.
- y=405 and height=64 produce vertical center y=437.
- Frame center is x=201, y=437.

Therefore, center the Expression on both axes using responsive layout. Do not scale it with viewport size. It remains 64 × 64 logical pixels on both requested emulators.

The image is decorative. Hide it from the accessibility tree.

### Signature

Render `From Biner Labs` as one native text node:

- 14 logical pixels
- regular system sans
- black
- natural/17 px line height
- one line
- centered horizontally
- font scaling disabled for stable launch geometry

Position its bottom edge 16 px above the bottom safe-area boundary. Runtime formula:

```text
bottom = bottom safe-area inset + 16
```

In the Figma reference, the text ends at y=824, the bottom safe area starts at y=840, and the gap is 16 px.

## Native Splash

Configure `expo-splash-screen` through `app.json`, as required by Expo SDK 57. Use a white native background and the exact Expression artwork where platform constraints allow.

Android 12+ controls the system splash structure, icon masking, and icon scale. It cannot render arbitrary bottom text. Consequently:

- native splash guarantees a white, brand-consistent startup surface;
- React overlay is the pixel-accuracy authority for the complete Figma composition;
- release-build tests validate handoff continuity, not impossible control over Android's system-owned enter frame.

Call `SplashScreen.preventAutoHideAsync()` at module scope without awaiting it. Hide the native splash only after the React overlay has laid out. Avoid any blank or blue frame.

## Motion and Performance

Use only one opacity animation on the full overlay. Do not animate layout, image decoding, blur, glass, scale, or position.

No liquid-glass effect applies because the screen contains no interactive or translucent component. Adding glass would contradict Figma and increase GPU work. Future interactive screens may implement liquid glass where the approved design requires it.

Performance properties:

- bundled 64 × 64 PNG
- no network requests
- no runtime SVG parsing
- no image crossfade
- no blur
- no state manager
- no route navigation during normal splash dismissal
- only one short UI-thread opacity transition

## Error Handling

The image is bundled and requires no asynchronous loading. The overlay must not hold launch indefinitely if native splash hiding rejects. The hide operation should be attempted after layout, but the timer and overlay removal must continue regardless.

Unmount cleanup must cancel pending timers and animation callbacks. Completion callback must fire at most once.

## Preview and Testability

`/splash` is a test and development adapter around the production `SplashScreen`, not a separate implementation. It must support deterministic rendering modes for:

- Expression only
- Signature only
- Complete screen

Preview mode keeps content visible instead of auto-dismissing. It hides app tabs and route chrome. Stable test IDs or accessibility labels must identify relevant section roots without changing layout.

## Section-by-Section Implementation Gate

### Gate 1: Expression

1. Export and commit exact 64 × 64 Figma PNG.
2. Implement `JoyExpression`.
3. Render Expression-only preview.
4. Run Maestro on one emulator at a time.
5. Assert component visibility.
6. Capture its exact crop.
7. Compare against the Figma export using `assertScreenshot` at a strict threshold.
8. Audit dimensions, center, transparency, interpolation, and edge clarity.
9. Fix all discrepancies before implementing Signature.

### Gate 2: Signature Text

1. Implement `SplashSignature` with tokens.
2. Render Signature-only preview.
3. Run Maestro crop assertions.
4. Audit exact copy, font size, weight, line height, centering, and 16 px safe-area gap.
5. Store emulator-specific baselines because Android font rasterization differs by API/device.
6. Fix all discrepancies before full composition.

### Gate 3: Full composition and launch

1. Compose both sections.
2. Capture full viewport on each requested emulator.
3. Assert emulator-specific full-screen references.
4. Verify cold launch shows splash and dismisses automatically.
5. Verify existing Home content becomes visible.
6. Verify no crash, blue flash, duplicate splash, or visible tab bar during splash.
7. Validate native-to-React handoff with a local release APK.

## Maestro Matrix

Required AVDs:

- `medium-android14-api34`
- `small-android11-api30`

Required flows:

- Expression visual audit
- Signature visual audit
- Full splash visual regression
- Cold-launch functional dismissal

Each flow must reset application state where appropriate. Launch checks must use application ID `com.binerlabs.joy`.

Reference screenshots are stored per AVD. This is required because physical resolution, API rendering, system bars, and font rasterization differ. Component crop assertions should use a stricter threshold than full-screen assertions. Maestro's default `assertScreenshot` threshold is 95%; exact thresholds will be calibrated once first approved baselines are captured, without weakening structural pixel checks.

In addition to screenshot comparison, perform deterministic pixel analysis for:

- white background
- Expression bounding box exactly 64 × 64
- Expression center equals viewport center within one pixel
- Signature horizontally centered
- Signature bottom gap equals 16 px relative to content safe-area boundary

## Verification Commands

Before completion:

```bash
pnpm exec tsc --noEmit
pnpm lint
maestro check-syntax .maestro
```

Then run all splash flows on both AVDs, one emulator at a time. Build and install a release APK before final native handoff validation because Expo Go and development builds do not faithfully reproduce Android release splash behavior.

## Acceptance Criteria

- Full React splash matches the Figma composition in background, image, copy, sizing, and relative geometry.
- Expression is implemented as a reusable component using exact Figma-exported artwork.
- Signature is implemented as reusable native text.
- Layout adapts to both requested emulator sizes without scaling the Expression or colliding with safe areas.
- Native launch transitions to React overlay without blank or incorrect-color frames.
- Overlay dismisses after 1,000 ms plus optional 200 ms fade.
- Reduced-motion users get no fade.
- Existing app appears after dismissal.
- No interactive or decorative effects absent from Figma are introduced.
- TypeScript, lint, Maestro syntax, visual regression, and functional flows pass.
- Both requested emulators are tested.

## Out of Scope

- Redesigning Home or tabs
- Adding authentication or onboarding navigation
- Adding buttons, loaders, progress text, glass surfaces, or extra branding
- Reconstructing the Joy artwork manually
- Shipping SF Pro font files
- Creating Code Connect mappings while account requirements are unmet
