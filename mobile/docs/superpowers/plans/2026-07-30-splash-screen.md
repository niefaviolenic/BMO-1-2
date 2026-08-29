# Joy Splash Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Expo starter splash with the pixel-accurate Joy launch experience from Figma, backed by reusable React Native components and verified section-by-section on both required Android emulators.

**Architecture:** Keep the feature presentation-only under `src/features/splash/presentation`: an exact bundled Expression asset, native signature text, a stateless composition, and a lifecycle-owning overlay. Refactor Expo Router into a root stack plus `(tabs)` group so `/splash` can expose deterministic test previews without tab chrome while the same `SplashScreen` powers the production overlay. Native `expo-splash-screen` supplies startup continuity; the React overlay is the complete visual authority.

**Tech Stack:** Expo SDK 57.0.8, Expo Router 57.0.8, React Native 0.86, React 19.2.3, TypeScript 6, `expo-image`, `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, React Native Reanimated 4.5, Maestro CLI/MCP, Android API 34 and API 30 emulators.

## Global Constraints

- Read exact Expo SDK 57 docs before code changes: `https://docs.expo.dev/versions/v57.0.0/`.
- UI only; no backend, persistence, repositories, entities, or empty domain/data layers.
- Preserve reusable components, design tokens, Clean Architecture presentation boundaries, strict TypeScript, Android/iOS stability, and fast startup.
- Figma frame `611:132489` is 402 × 874; `Expression` `611:139733` is 64 × 64 at x=169/y=405; `Signature Text` `611:132491` is 108 × 17 at x=147/y=807.
- Red/pink safe-area guides, arrows, measurements, and Dynamic Island artwork are documentation only and must not render.
- Splash background is always `#FFFFFF`; signature is always `#000000`.
- Expression remains 64 × 64 logical pixels and centered on the complete viewport.
- Signature copy is exactly `From Biner Labs`, 14 logical pixels, regular system sans, 17 logical-pixel line height, horizontally centered, with bottom edge `bottom safe-area inset + 16`.
- Native splash hands off after React overlay first layout. React overlay holds until 1,000 ms from mount, then fades for 200 ms. Reduced motion skips fade.
- No liquid glass, blur, scale, layout, image crossfade, or network animation. Design contains no interactive/glass surface.
- Android application ID is `com.binerlabs.joy`; set matching iOS bundle identifier `com.binerlabs.joy` for cross-platform consistency.
- Code Connect cannot be created: authenticated Figma account lacks required Organization/Enterprise Dev or Full seat. Continue with Figma Native `get_design_context`, `download_assets`, and screenshots.
- Required AVDs: `medium-android14-api34` and `small-android11-api30`, run one at a time.
- Audit and pass Expression on both AVDs before Signature; pass Signature on both before full composition; pass full composition before native handoff.
- Do not overwrite unrelated working-tree edits in `.repotix/issues.json`, `AGENTS.md`, or existing untracked docs.
- Git commit steps require explicit user authorization at execution time.

---

## File Map

### Create

- `assets/images/splash/expression-default.png` — exact Figma-exported 64 × 64 Expression artwork.
- `src/features/splash/presentation/joy-expression.tsx` — decorative fixed-size Expression component.
- `src/features/splash/presentation/splash-signature.tsx` — native signature text component.
- `src/features/splash/presentation/splash-screen.tsx` — stateless responsive composition and preview-section switch.
- `src/features/splash/presentation/splash-overlay.tsx` — native handoff, hold, fade, cleanup, and once-only completion.
- `src/app/(tabs)/_layout.tsx` — Native Tabs layout formerly mounted at root.
- `src/app/splash.tsx` — deterministic `/splash?section=expression|signature|full` adapter.
- `.maestro/splash/expression.yaml` — Gate 1 crop and visibility audit.
- `.maestro/splash/signature.yaml` — Gate 2 crop and visibility audit.
- `.maestro/splash/full.yaml` — Gate 3 composition screenshot.
- `.maestro/splash/cold-launch.yaml` — native-to-React functional dismissal check.
- `.maestro/splash/references/medium-android14-api34/` — approved API 34 baselines.
- `.maestro/splash/references/small-android11-api30/` — approved API 30 baselines.
- `.maestro/splash/candidates/` — generated audit screenshots, ignored by Git.
- `scripts/verify-splash-geometry.mjs` — deterministic screenshot/hierarchy geometry checks.

### Move

- `src/app/index.tsx` to `src/app/(tabs)/index.tsx` — preserve Home screen behavior.
- `src/app/explore.tsx` to `src/app/(tabs)/explore.tsx` — preserve Explore screen behavior.

### Modify

- `src/constants/theme.ts` — add immutable splash tokens.
- `src/app/_layout.tsx` — root Stack, module-scope native splash control, root background, production overlay.
- `src/components/animated-icon.tsx` — remove obsolete Expo starter `AnimatedSplashOverlay`; retain Home `AnimatedIcon`.
- `app.json` — white native splash, exact Expression asset, package/bundle IDs.
- `package.json` — add test-only `pngjs` and verification scripts.
- `.gitignore` — ignore generated Maestro candidates and debug output, retain approved references.

---

### Task 1: Lock Figma Asset, Tokens, and Native Configuration

**Files:**
- Create: `assets/images/splash/expression-default.png`
- Modify: `src/constants/theme.ts`
- Modify: `app.json`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Figma file `4M6ZJeHGYWaNO9bODM7Pou`, node `611:139733`.
- Produces: `SplashTokens`, bundled `require('@/assets/images/splash/expression-default.png')`, native package IDs, white native splash configuration.

- [ ] **Step 1: Re-read versioned Expo configuration docs**

Read:

```text
https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/
https://docs.expo.dev/versions/v57.0.0/sdk/image/
https://docs.expo.dev/versions/v57.0.0/sdk/system-ui/
https://docs.expo.dev/versions/v57.0.0/sdk/status-bar/
```

Confirm exact SDK 57 rules: `preventAutoHideAsync()` at module scope, config changes require native rebuild, Expo Go does not reproduce the configured Android splash, and release builds are final authority.

- [ ] **Step 2: Write failing asset/config checks**

Run before changes:

```bash
test -f assets/images/splash/expression-default.png
pnpm exec expo config --type public | grep -F "backgroundColor: '#FFFFFF'"
pnpm exec expo config --type public | grep -F "package: 'com.binerlabs.joy'"
```

Expected: first command fails because asset is absent; config checks fail because current background is `#208AEF` and package is unset.

- [ ] **Step 3: Export exact Expression with Figma Native**

Call Figma MCP:

```json
{
  "fileKey": "4M6ZJeHGYWaNO9bODM7Pou",
  "nodeId": "611:139733",
  "defaultFormat": "png",
  "defaultScale": 1
}
```

Download returned short-lived `export.url` immediately to:

```bash
mkdir -p assets/images/splash
curl -L "$FIGMA_EXPRESSION_URL" -o assets/images/splash/expression-default.png
file assets/images/splash/expression-default.png
```

Expected: PNG, 64 × 64 pixels. If `file` reports another size, stop and re-export node `611:139733`; do not resize an incorrect export.

- [ ] **Step 4: Add splash tokens**

Append to `src/constants/theme.ts`:

```ts
export const SplashTokens = {
  colors: {
    background: '#FFFFFF',
    foreground: '#000000',
  },
  expressionSize: 64,
  signature: {
    fontSize: 14,
    lineHeight: 17,
    safeAreaGap: 16,
  },
  motion: {
    minimumVisibleDuration: 1_000,
    fadeDuration: 200,
  },
} as const;
```

Use these tokens in all later components; no duplicate splash geometry literals.

- [ ] **Step 5: Replace native splash configuration**

Change `app.json` to preserve unrelated fields while adding IDs and replacing only the splash plugin object:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.binerlabs.joy",
      "icon": "./assets/expo.icon"
    },
    "android": {
      "package": "com.binerlabs.joy",
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#FFFFFF",
          "image": "./assets/images/splash/expression-default.png",
          "imageWidth": 64,
          "resizeMode": "contain"
        }
      ]
    ]
  }
}
```

- [ ] **Step 6: Add screenshot parser dependency and scripts**

Run:

```bash
pnpm add -D pngjs
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "test:splash:syntax": "maestro check-syntax .maestro/splash",
    "test:splash:geometry": "node scripts/verify-splash-geometry.mjs"
  }
}
```

Do not change existing scripts.

- [ ] **Step 7: Ignore generated audit output**

Append to `.gitignore`:

```gitignore
.maestro/splash/candidates/
.maestro/splash/debug/
```

Do not ignore `.maestro/splash/references/`.

- [ ] **Step 8: Verify asset and resolved Expo config**

Run:

```bash
file assets/images/splash/expression-default.png
pnpm exec expo config --type public
pnpm exec tsc --noEmit
```

Expected: PNG reports 64 × 64; public config reports white splash, 64 image width, `com.binerlabs.joy`; TypeScript passes.

- [ ] **Step 9: Commit only with explicit authorization**

```bash
git add app.json package.json pnpm-lock.yaml .gitignore src/constants/theme.ts assets/images/splash/expression-default.png
git commit -m "feat: add Joy splash foundations"
```

---

### Task 2: Build and Audit Expression Section

**Files:**
- Create: `src/features/splash/presentation/joy-expression.tsx`
- Create: `src/features/splash/presentation/splash-screen.tsx`
- Create: `src/app/(tabs)/_layout.tsx`
- Create: `src/app/splash.tsx`
- Move: `src/app/index.tsx` to `src/app/(tabs)/index.tsx`
- Move: `src/app/explore.tsx` to `src/app/(tabs)/explore.tsx`
- Modify: `src/app/_layout.tsx`
- Create: `.maestro/splash/expression.yaml`

**Interfaces:**
- Consumes: `SplashTokens.expressionSize`, exact bundled Expression PNG.
- Produces: `JoyExpressionProps`, `SplashSection`, `SplashScreenProps`, route `/splash?section=expression`, test IDs `splash-screen` and `splash-expression`.

- [ ] **Step 1: Write failing Maestro Expression flow**

Create `.maestro/splash/expression.yaml`:

```yaml
appId: com.binerlabs.joy
name: Splash Expression audit
tags:
  - splash
  - visual
---
- launchApp:
    clearState: true
    stopApp: true
- openLink: "joymobile:///splash?section=expression"
- extendedWaitUntil:
    visible:
      id: "splash-expression"
    timeout: 5000
- assertVisible:
    id: "splash-expression"
- takeScreenshot:
    path: "./.maestro/splash/candidates/${AVD}/expression-full.png"
- takeScreenshot:
    path: "./.maestro/splash/candidates/${AVD}/expression-crop.png"
    cropOn:
      id: "splash-expression"
```

Run:

```bash
maestro check-syntax .maestro/splash/expression.yaml
```

Expected: syntax passes. Runtime later fails because package/route/component are not installed yet.

- [ ] **Step 2: Create fixed-size Expression component**

Create `src/features/splash/presentation/joy-expression.tsx`:

```tsx
import { Image } from 'expo-image';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { SplashTokens } from '@/constants/theme';

export type JoyExpressionProps = Pick<ViewProps, 'testID' | 'style'>;

export function JoyExpression({ style, testID = 'splash-expression' }: JoyExpressionProps) {
  return (
    <View collapsable={false} style={[styles.frame, style]} testID={testID}>
      <Image
        accessible={false}
        contentFit="contain"
        source={require('@/assets/images/splash/expression-default.png')}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: SplashTokens.expressionSize,
    height: SplashTokens.expressionSize,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
```

No transition prop, network URI, runtime SVG parsing, tint, or scaling animation.

- [ ] **Step 3: Create Expression-first stateless screen**

Create `src/features/splash/presentation/splash-screen.tsx`:

```tsx
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SplashTokens } from '@/constants/theme';
import { JoyExpression } from '@/features/splash/presentation/joy-expression';

export type SplashSection = 'expression' | 'signature' | 'full';

export type SplashScreenProps = {
  exposeTestMetrics?: boolean;
  section?: SplashSection;
  testID?: string;
};

export function SplashScreen({
  exposeTestMetrics = false,
  section = 'full',
  testID = 'splash-screen',
}: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const showExpression = section === 'expression' || section === 'full';
  const metrics = exposeTestMetrics
    ? `splash-metrics:${width}x${height};bottom=${insets.bottom}`
    : undefined;

  return (
    <View
      accessibilityLabel={metrics}
      collapsable={false}
      style={styles.root}
      testID={testID}>
      {showExpression ? <JoyExpression style={styles.expression} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SplashTokens.colors.background,
  },
  expression: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -SplashTokens.expressionSize / 2,
    marginTop: -SplashTokens.expressionSize / 2,
  },
});
```

This intentionally reserves `signature` mode but renders only white until Task 3.

- [ ] **Step 4: Move tab routes under a route group**

Run:

```bash
mkdir -p 'src/app/(tabs)'
mv src/app/index.tsx 'src/app/(tabs)/index.tsx'
mv src/app/explore.tsx 'src/app/(tabs)/explore.tsx'
```

Create `src/app/(tabs)/_layout.tsx`:

```tsx
import AppTabs from '@/components/app-tabs';

export default function TabLayout() {
  return <AppTabs />;
}
```

Imports inside moved screens remain valid through the `@/*` aliases.

- [ ] **Step 5: Create direct Splash preview route**

Create `src/app/splash.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import {
  SplashScreen,
  type SplashSection,
} from '@/features/splash/presentation/splash-screen';

const sections = new Set<SplashSection>(['expression', 'signature', 'full']);

export default function SplashPreviewRoute() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const requestedSection = Array.isArray(section) ? section[0] : section;
  const resolvedSection = sections.has(requestedSection as SplashSection)
    ? (requestedSection as SplashSection)
    : 'full';

  return (
    <>
      <StatusBar style="dark" />
      <SplashScreen exposeTestMetrics section={resolvedSection} />
    </>
  );
}
```

- [ ] **Step 6: Replace root Native Tabs layout with Stack shell**

Replace `src/app/_layout.tsx` temporarily; production overlay is added in Task 5:

```tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="splash" />
      </Stack>
    </ThemeProvider>
  );
}
```

Use `@react-navigation/native` exports already available through Expo Router. If TypeScript rejects the direct dependency boundary, retain the existing `DarkTheme`, `DefaultTheme`, and `ThemeProvider` import from `expo-router`; do not install another runtime dependency.

- [ ] **Step 7: Verify route and type structure**

Run:

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm exec expo export --platform android --output-dir /tmp/joy-splash-expression-export
```

Expected: all commands pass; export contains both `(tabs)` and `splash` routes.

- [ ] **Step 8: Build debug app and start API 34 AVD**

Start only `medium-android14-api34`:

```bash
emulator -avd medium-android14-api34 -no-window -no-boot-anim -no-snapshot-save
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
SERIAL=$(adb devices | grep '^emulator-' | cut -f1 | head -n1)
pnpm exec expo run:android --device "$SERIAL"
```

Keep Metro available while running debug audits.

- [ ] **Step 9: Run API 34 Expression audit with CLI and MCP**

CLI:

```bash
AVD=medium-android14-api34 maestro --device "$SERIAL" test .maestro/splash/expression.yaml
```

MCP sequence:

```text
list_devices
inspect_screen(device_id=<connected medium AVD id>)
run(device_id=<id>, files=[".maestro/splash/expression.yaml"], env={"AVD":"medium-android14-api34"})
take_screenshot(device_id=<id>)
```

Compare `expression-crop.png` against Figma node `611:139733`. Audit 64 × 64 bounds, transparency on white, center, interpolation, and edge clarity. Fix discrepancies before continuing.

- [ ] **Step 10: Repeat Gate 1 on API 30 before Signature work**

Stop API 34, then start only API 30:

```bash
adb -s "$SERIAL" emu kill
emulator -avd small-android11-api30 -no-window -no-boot-anim -no-snapshot-save
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done
SERIAL=$(adb devices | grep '^emulator-' | cut -f1 | head -n1)
pnpm exec expo run:android --device "$SERIAL"
AVD=small-android11-api30 maestro --device "$SERIAL" test .maestro/splash/expression.yaml
```

Repeat MCP inspection and screenshot. Gate passes only when both crops preserve exact artwork and hierarchy reports a centered 64 × 64 logical-pixel wrapper.

- [ ] **Step 11: Promote approved Expression baselines**

After direct Figma comparison passes:

```bash
mkdir -p .maestro/splash/references/medium-android14-api34
mkdir -p .maestro/splash/references/small-android11-api30
cp .maestro/splash/candidates/medium-android14-api34/expression-crop.png .maestro/splash/references/medium-android14-api34/expression.png
cp .maestro/splash/candidates/small-android11-api30/expression-crop.png .maestro/splash/references/small-android11-api30/expression.png
```

Add this assertion after the crop capture in `.maestro/splash/expression.yaml`:

```yaml
- assertScreenshot:
    path: "./.maestro/splash/references/${AVD}/expression.png"
    cropOn:
      id: "splash-expression"
    thresholdPercentage: 99.5
    label: "Expression remains visually identical"
```

Run both AVDs again. Expected: pass at 99.5% or higher. Do not lower threshold to hide an unexplained mismatch.

- [ ] **Step 12: Commit only with explicit authorization**

```bash
git add src/app src/features/splash .maestro/splash/expression.yaml .maestro/splash/references
git commit -m "feat: add splash expression section"
```

---

### Task 3: Build and Audit Signature Text

**Files:**
- Create: `src/features/splash/presentation/splash-signature.tsx`
- Modify: `src/features/splash/presentation/splash-screen.tsx`
- Create: `.maestro/splash/signature.yaml`

**Interfaces:**
- Consumes: `Fonts.sans`, `SplashTokens.signature`, `SplashTokens.colors.foreground`.
- Produces: `SplashSignature`, test ID `splash-signature`, signature-only and full sections with safe-area-aware placement.

- [ ] **Step 1: Write failing Maestro Signature flow**

Create `.maestro/splash/signature.yaml`:

```yaml
appId: com.binerlabs.joy
name: Splash signature audit
tags:
  - splash
  - visual
---
- launchApp:
    clearState: true
    stopApp: true
- openLink: "joymobile:///splash?section=signature"
- extendedWaitUntil:
    visible:
      id: "splash-signature"
    timeout: 5000
- assertVisible: "From Biner Labs"
- assertVisible:
    id: "splash-signature"
- takeScreenshot:
    path: "./.maestro/splash/candidates/${AVD}/signature-full.png"
- takeScreenshot:
    path: "./.maestro/splash/candidates/${AVD}/signature-crop.png"
    cropOn:
      id: "splash-signature"
```

Run:

```bash
maestro check-syntax .maestro/splash/signature.yaml
```

Expected: syntax passes; runtime fails because `splash-signature` does not exist.

- [ ] **Step 2: Implement native signature component**

Create `src/features/splash/presentation/splash-signature.tsx`:

```tsx
import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, SplashTokens } from '@/constants/theme';

export type SplashSignatureProps = Pick<TextProps, 'style' | 'testID'>;

export function SplashSignature({
  style,
  testID = 'splash-signature',
}: SplashSignatureProps) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[styles.text, style]}
      testID={testID}>
      From Biner Labs
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: SplashTokens.colors.foreground,
    fontFamily: Fonts?.sans,
    fontSize: SplashTokens.signature.fontSize,
    fontWeight: '400',
    lineHeight: SplashTokens.signature.lineHeight,
    textAlign: 'center',
  },
});
```

Android uses its regular system sans. Do not bundle or imitate SF Pro.

- [ ] **Step 3: Add signature to responsive composition**

Update `src/features/splash/presentation/splash-screen.tsx` imports:

```tsx
import { SplashSignature } from '@/features/splash/presentation/splash-signature';
```

Add visibility and render logic:

```tsx
const showSignature = section === 'signature' || section === 'full';
```

Render after Expression:

```tsx
{showSignature ? (
  <SplashSignature
    style={[
      styles.signature,
      { bottom: insets.bottom + SplashTokens.signature.safeAreaGap },
    ]}
  />
) : null}
```

Add style:

```tsx
signature: {
  position: 'absolute',
  alignSelf: 'center',
},
```

Do not give signature a fixed width; natural native text width differs between SF Pro and Android system sans. Horizontal center and line geometry are authoritative.

- [ ] **Step 4: Verify static checks**

Run:

```bash
pnpm exec tsc --noEmit
pnpm lint
maestro check-syntax .maestro/splash/signature.yaml
```

Expected: all pass.

- [ ] **Step 5: Fetch Signature reference and audit API 34**

Call Figma Native `get_design_context` for `611:132491` and retain screenshot showing exact copy, 14 px regular weight, black fill, 108 × 17 Figma bounds.

Run on only `medium-android14-api34`:

```bash
AVD=medium-android14-api34 maestro --device "$SERIAL" test .maestro/splash/signature.yaml
```

Use Maestro MCP `inspect_screen` before screenshot. Confirm exact text, one line, 14 logical-pixel font, 17 logical-pixel node height, horizontal center, and bottom formula `safe inset + 16`. Android glyph rasterization/width may differ from SF Pro; geometry and weight must remain visually equivalent.

- [ ] **Step 6: Audit API 30 before full composition work**

Switch AVDs using Task 2 commands, then run:

```bash
AVD=small-android11-api30 maestro --device "$SERIAL" test .maestro/splash/signature.yaml
```

Inspect with MCP. Fix clipping, weight, baseline, centering, or safe-area errors before continuing.

- [ ] **Step 7: Promote device-specific Signature baselines**

After both direct Figma audits pass:

```bash
cp .maestro/splash/candidates/medium-android14-api34/signature-crop.png .maestro/splash/references/medium-android14-api34/signature.png
cp .maestro/splash/candidates/small-android11-api30/signature-crop.png .maestro/splash/references/small-android11-api30/signature.png
```

Add assertion to `.maestro/splash/signature.yaml`:

```yaml
- assertScreenshot:
    path: "./.maestro/splash/references/${AVD}/signature.png"
    cropOn:
      id: "splash-signature"
    thresholdPercentage: 98.5
    label: "Signature typography remains stable"
```

Run both AVDs again. Keep separate baselines; never reuse one API/device font raster as the other device reference.

- [ ] **Step 8: Commit only with explicit authorization**

```bash
git add src/features/splash/presentation .maestro/splash/signature.yaml .maestro/splash/references
git commit -m "feat: add splash signature section"
```

---

### Task 4: Verify Full Composition and Deterministic Geometry

**Files:**
- Create: `.maestro/splash/full.yaml`
- Create: `scripts/verify-splash-geometry.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: test IDs `splash-screen`, `splash-expression`, `splash-signature`; accessibility metric `splash-metrics:<width>x<height>;bottom=<inset>`.
- Produces: full-screen device baselines and executable geometry validation for white background, 64 × 64 Expression, viewport center, Signature center, and safe-area gap.

- [ ] **Step 1: Write failing full composition flow**

Create `.maestro/splash/full.yaml`:

```yaml
appId: com.binerlabs.joy
name: Full splash visual audit
tags:
  - splash
  - visual
---
- launchApp:
    clearState: true
    stopApp: true
- openLink: "joymobile:///splash?section=full"
- extendedWaitUntil:
    visible:
      id: "splash-expression"
    timeout: 5000
- assertVisible:
    id: "splash-screen"
- assertVisible:
    id: "splash-expression"
- assertVisible:
    id: "splash-signature"
- assertVisible: "From Biner Labs"
- takeScreenshot:
    path: "./.maestro/splash/candidates/${AVD}/full.png"
    cropOn:
      id: "splash-screen"
```

Syntax check:

```bash
maestro check-syntax .maestro/splash/full.yaml
```

Expected: pass.

- [ ] **Step 2: Implement geometry verifier**

Create `scripts/verify-splash-geometry.mjs`:

```js
import fs from 'node:fs';
import { PNG } from 'pngjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }),
);

for (const key of ['screenshot', 'hierarchy']) {
  if (!args[key]) throw new Error(`Missing --${key}=<path>`);
}

const png = PNG.sync.read(fs.readFileSync(args.screenshot));
const hierarchy = fs.readFileSync(args.hierarchy, 'utf8');

function nodeBounds(id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const node = hierarchy.match(
    new RegExp(`<node[^>]*(?:resource-id|content-desc)="[^"]*${escaped}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*>`),
  );
  if (!node) throw new Error(`Missing hierarchy node: ${id}`);
  return node.slice(1, 5).map(Number);
}

function nearly(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

const metricsMatch = hierarchy.match(/splash-metrics:(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?);bottom=(\d+(?:\.\d+)?)/);
if (!metricsMatch) throw new Error('Missing splash metrics');

const [, widthDpRaw, heightDpRaw, bottomInsetDpRaw] = metricsMatch;
const widthDp = Number(widthDpRaw);
const heightDp = Number(heightDpRaw);
const bottomInsetDp = Number(bottomInsetDpRaw);
const scaleX = png.width / widthDp;
const scaleY = png.height / heightDp;
nearly(scaleX, scaleY, 0.02, 'uniform pixel scale');
const scale = (scaleX + scaleY) / 2;
const tolerance = Math.max(1, Math.ceil(scale));

const [rootLeft, rootTop, rootRight, rootBottom] = nodeBounds('splash-screen');
const [expressionLeft, expressionTop, expressionRight, expressionBottom] = nodeBounds('splash-expression');
const [signatureLeft, , signatureRight, signatureBottom] = nodeBounds('splash-signature');

nearly(expressionRight - expressionLeft, 64 * scale, tolerance, 'Expression width');
nearly(expressionBottom - expressionTop, 64 * scale, tolerance, 'Expression height');
nearly((expressionLeft + expressionRight) / 2, (rootLeft + rootRight) / 2, tolerance, 'Expression horizontal center');
nearly((expressionTop + expressionBottom) / 2, (rootTop + rootBottom) / 2, tolerance, 'Expression vertical center');
nearly((signatureLeft + signatureRight) / 2, (rootLeft + rootRight) / 2, tolerance, 'Signature horizontal center');
nearly(rootBottom - bottomInsetDp * scale - signatureBottom, 16 * scale, tolerance, 'Signature safe-area gap');

let nonWhiteBackgroundPixels = 0;
for (let y = 0; y < png.height; y += Math.max(1, Math.floor(scale * 8))) {
  for (let x = 0; x < png.width; x += Math.max(1, Math.floor(scale * 8))) {
    const insideExpression = x >= expressionLeft && x < expressionRight && y >= expressionTop && y < expressionBottom;
    const nearSignature = y >= signatureBottom - 24 * scale && y <= signatureBottom + 2 * scale;
    if (insideExpression || nearSignature) continue;
    const index = (png.width * y + x) * 4;
    const [red, green, blue, alpha] = png.data.subarray(index, index + 4);
    if (alpha !== 255 || red < 250 || green < 250 || blue < 250) nonWhiteBackgroundPixels++;
  }
}
if (nonWhiteBackgroundPixels > 0) {
  throw new Error(`Background contains ${nonWhiteBackgroundPixels} sampled non-white pixels`);
}

console.log(`Splash geometry valid at ${widthDp}x${heightDp} dp, scale ${scale.toFixed(2)}`);
```

This script fails loudly on missing IDs or geometry drift. It samples outside artwork/text regions to verify white background.

- [ ] **Step 3: Capture hierarchy and run verifier on API 34**

Run full flow, dump Android hierarchy, then validate:

```bash
AVD=medium-android14-api34 maestro --device "$SERIAL" test .maestro/splash/full.yaml
adb -s "$SERIAL" shell uiautomator dump /sdcard/splash.xml
adb -s "$SERIAL" pull /sdcard/splash.xml .maestro/splash/candidates/medium-android14-api34/hierarchy.xml
node scripts/verify-splash-geometry.mjs \
  --screenshot=.maestro/splash/candidates/medium-android14-api34/full.png \
  --hierarchy=.maestro/splash/candidates/medium-android14-api34/hierarchy.xml
```

Expected: `Splash geometry valid ...`; no geometry or background errors.

- [ ] **Step 4: Compare API 34 composition against Figma**

Call Figma `get_design_context` for full frame `611:132489` and inspect Main Layout `611:132490`. Ignore annotation layers `611:132492`, `611:132493`, and `611:132494`. Compare component dimensions, viewport center, signature placement, white, and black. Use Maestro MCP `inspect_screen`, `take_screenshot`, and `run` to confirm the CLI result.

Fix any mismatch before API 30.

- [ ] **Step 5: Run full Gate 3 on API 30**

Switch to only `small-android11-api30`, then run:

```bash
AVD=small-android11-api30 maestro --device "$SERIAL" test .maestro/splash/full.yaml
adb -s "$SERIAL" shell uiautomator dump /sdcard/splash.xml
adb -s "$SERIAL" pull /sdcard/splash.xml .maestro/splash/candidates/small-android11-api30/hierarchy.xml
node scripts/verify-splash-geometry.mjs \
  --screenshot=.maestro/splash/candidates/small-android11-api30/full.png \
  --hierarchy=.maestro/splash/candidates/small-android11-api30/hierarchy.xml
```

Expected: pass. Inspect through Maestro MCP. Do not continue to lifecycle work until both devices pass.

- [ ] **Step 6: Promote and enforce full-screen baselines**

```bash
cp .maestro/splash/candidates/medium-android14-api34/full.png .maestro/splash/references/medium-android14-api34/full.png
cp .maestro/splash/candidates/small-android11-api30/full.png .maestro/splash/references/small-android11-api30/full.png
```

Append to `.maestro/splash/full.yaml`:

```yaml
- assertScreenshot:
    path: "./.maestro/splash/references/${AVD}/full.png"
    cropOn:
      id: "splash-screen"
    thresholdPercentage: 98.0
    label: "Full splash remains visually stable"
```

Run both AVDs again. Explain any mismatch rather than weakening threshold.

- [ ] **Step 7: Add complete visual command**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test:splash:visual": "maestro test .maestro/splash/expression.yaml .maestro/splash/signature.yaml .maestro/splash/full.yaml"
  }
}
```

Device-specific execution still passes `--device` and `-e AVD=<name>` directly.

- [ ] **Step 8: Commit only with explicit authorization**

```bash
git add .maestro/splash/full.yaml .maestro/splash/references scripts/verify-splash-geometry.mjs package.json
git commit -m "test: lock splash visual geometry"
```

---

### Task 5: Implement Production Overlay and Native Handoff

**Files:**
- Create: `src/features/splash/presentation/splash-overlay.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/components/animated-icon.tsx`
- Create: `.maestro/splash/cold-launch.yaml`

**Interfaces:**
- Consumes: `SplashScreen`, `SplashTokens.motion`, `SplashScreen.hideAsync()`, Reanimated `useReducedMotion`, `withTiming`, worklets `scheduleOnRN`.
- Produces: `SplashOverlay({ onComplete? })`, once-only completion, native handoff after layout, 1,000 ms minimum hold, optional 200 ms fade.

- [ ] **Step 1: Write failing cold-launch behavior flow**

Create `.maestro/splash/cold-launch.yaml`:

```yaml
appId: com.binerlabs.joy
name: Splash cold launch dismissal
tags:
  - splash
  - functional
---
- launchApp:
    clearState: true
    stopApp: true
- assertVisible:
    id: "splash-screen"
- extendedWaitUntil:
    notVisible:
      id: "splash-screen"
    timeout: 3000
- assertVisible: "Welcome to Expo"
- assertNotVisible:
    id: "splash-expression"
```

Run against current debug build:

```bash
maestro check-syntax .maestro/splash/cold-launch.yaml
AVD=small-android11-api30 maestro --device "$SERIAL" test .maestro/splash/cold-launch.yaml
```

Expected: fails because root does not mount production `splash-screen`.

- [ ] **Step 2: Implement lifecycle-owning overlay**

Create `src/features/splash/presentation/splash-overlay.tsx`:

```tsx
import * as SplashScreenApi from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SplashTokens } from '@/constants/theme';
import { SplashScreen } from '@/features/splash/presentation/splash-screen';

export type SplashOverlayProps = {
  onComplete?: () => void;
};

export function SplashOverlay({ onComplete }: SplashOverlayProps) {
  const [visible, setVisible] = useState(true);
  const mountedAt = useRef(Date.now());
  const started = useRef(false);
  const completed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    setVisible(false);
    onComplete?.();
  }, [onComplete]);

  const beginDismissal = useCallback(() => {
    if (reduceMotion) {
      finish();
      return;
    }

    opacity.value = withTiming(
      0,
      { duration: SplashTokens.motion.fadeDuration },
      (animationFinished) => {
        'worklet';
        if (animationFinished) scheduleOnRN(finish);
      },
    );
  }, [finish, opacity, reduceMotion]);

  const handleLayout = useCallback(() => {
    if (started.current) return;
    started.current = true;
    void SplashScreenApi.hideAsync().catch(() => undefined);

    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(
      0,
      SplashTokens.motion.minimumVisibleDuration - elapsed,
    );
    timer.current = setTimeout(beginDismissal, remaining);
  }, [beginDismissal]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Animated.View onLayout={handleLayout} style={[styles.overlay, animatedStyle]}>
      <StatusBar style="dark" />
      <SplashScreen />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1_000,
  },
});
```

`hideAsync()` rejection cannot block the timer. Timer cleanup and `completed` guard prevent late or duplicate callbacks.

- [ ] **Step 3: Wire module-scope native splash control and white root**

Replace `src/app/_layout.tsx` with:

```tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreenApi from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useColorScheme } from 'react-native';

import { SplashOverlay } from '@/features/splash/presentation/splash-overlay';

void SplashScreenApi.preventAutoHideAsync();
void SystemUI.setBackgroundColorAsync('#FFFFFF');

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="splash" />
      </Stack>
      <SplashOverlay />
    </ThemeProvider>
  );
}
```

If `@react-navigation/native` is not directly resolvable, import theme exports from `expo-router` as existing code does. Keep both startup calls outside the component.

- [ ] **Step 4: Retire obsolete starter overlay**

In `src/components/animated-icon.tsx`:

- Remove `import * as SplashScreen from 'expo-splash-screen';`.
- Remove `useState` import.
- Remove the complete `AnimatedSplashOverlay` function.
- Remove `splashOverlay` from `StyleSheet.create`.
- Retain `AnimatedIcon` and its Home-screen animation unchanged.

Search:

```bash
rg "AnimatedSplashOverlay|#208AEF|SplashScreen.hideAsync" src
```

Expected: no starter overlay or blue splash remains; only new `SplashScreenApi.hideAsync()` exists.

- [ ] **Step 5: Run static and cold-launch tests**

```bash
pnpm exec tsc --noEmit
pnpm lint
maestro check-syntax .maestro/splash
AVD=small-android11-api30 maestro --device "$SERIAL" test .maestro/splash/cold-launch.yaml
```

Expected: splash visible on immediate launch assertion, gone within 3 seconds, Home visible, no remaining Expression.

- [ ] **Step 6: Verify timing and transition visually on both AVDs**

For each AVD, use Maestro MCP:

```text
inspect_screen before launch
run cold-launch flow
startRecording before launch when diagnosing continuity
take_screenshot during React overlay
inspect_screen after dismissal
```

Audit no crash, duplicate overlay, blue/blank flash, visible tabs during splash, layout motion, scale, blur, or crossfade. Overlay fade is the only motion.

- [ ] **Step 7: Verify reduced-motion branch manually**

On each AVD enable Android animator reduction/off in system settings, cold launch, and record. Expected: 1,000 ms hold remains; overlay disappears without 200 ms opacity fade; Home appears; no crash. Restore system animation setting after test.

- [ ] **Step 8: Commit only with explicit authorization**

```bash
git add src/app/_layout.tsx src/components/animated-icon.tsx src/features/splash/presentation/splash-overlay.tsx .maestro/splash/cold-launch.yaml
git commit -m "feat: add Joy splash handoff"
```

---

### Task 6: Release-Build Matrix and Final Regression

**Files:**
- Modify only if verification finds a confirmed discrepancy.
- Validate: all files above.

**Interfaces:**
- Consumes: complete splash feature, approved AVD references, four Maestro flows.
- Produces: verified release APK behavior on Android 14/API 34 and Android 11/API 30, final evidence for completion.

- [ ] **Step 1: Run clean static verification**

```bash
pnpm exec tsc --noEmit
pnpm lint
maestro check-syntax .maestro/splash
pnpm exec expo config --type public
```

Expected: all pass; config shows white splash, exact local asset, 64 width, and package ID.

- [ ] **Step 2: Generate native project and release APK**

Run:

```bash
pnpm exec expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
```

Expected APK:

```text
android/app/build/outputs/apk/release/app-release.apk
```

If release signing is unavailable, use generated local release signing only for test installation; do not add secrets or production keystores.

- [ ] **Step 3: Install and verify API 34 release build**

Start only `medium-android14-api34`, then:

```bash
SERIAL=$(adb devices | grep '^emulator-' | cut -f1 | head -n1)
adb -s "$SERIAL" install -r android/app/build/outputs/apk/release/app-release.apk
maestro --device "$SERIAL" test -e AVD=medium-android14-api34 \
  .maestro/splash/expression.yaml \
  .maestro/splash/signature.yaml \
  .maestro/splash/full.yaml \
  .maestro/splash/cold-launch.yaml
```

Run matching MCP flows and inspect screens. Expected: all pass.

- [ ] **Step 4: Install and verify API 30 release build**

Stop API 34, start only `small-android11-api30`, then:

```bash
SERIAL=$(adb devices | grep '^emulator-' | cut -f1 | head -n1)
adb -s "$SERIAL" install -r android/app/build/outputs/apk/release/app-release.apk
maestro --device "$SERIAL" test -e AVD=small-android11-api30 \
  .maestro/splash/expression.yaml \
  .maestro/splash/signature.yaml \
  .maestro/splash/full.yaml \
  .maestro/splash/cold-launch.yaml
```

Run matching MCP flows and inspect screens. Expected: all pass.

- [ ] **Step 5: Confirm native splash limitations are handled, not disguised**

Review cold-launch recordings:

- Android 12+/API 34 may apply system icon masking/scaling to the native enter frame.
- Native Android splash cannot show bottom signature text.
- React overlay must immediately restore exact full composition.
- No incorrect blue background or blank frame may appear.

Do not alter React geometry to mimic system-owned Android 12 icon treatment.

- [ ] **Step 6: Inspect final diff for scope and generated artifacts**

```bash
git status --short
git diff --check
git diff --stat
git diff -- app.json package.json src assets .maestro scripts
```

Expected: no backend, unrelated refactor, Figma annotation, SF Pro file, network asset URL, candidate screenshot, debug output, native build artifact, or accidental edits to pre-existing unrelated files.

- [ ] **Step 7: Run final complete verification once more**

```bash
pnpm exec tsc --noEmit
pnpm lint
maestro check-syntax .maestro/splash
```

Expected: pass. Record exact Maestro results per AVD and note any Android system-splash limitation separately from React visual results.

- [ ] **Step 8: Final commit only with explicit authorization**

```bash
git add app.json package.json pnpm-lock.yaml .gitignore assets src .maestro scripts
git commit -m "feat: implement Figma-accurate splash screen"
```

Do not stage `.repotix/issues.json`, unrelated `AGENTS.md` edits, Maestro candidates/debug output, `android/` build products, or any unrelated docs.

---

## Self-Review Results

- **Spec coverage:** Every approved requirement maps to Tasks 1–6: exact Figma asset, real native text, tokens, route adapter, responsive safe-area geometry, native handoff, minimum hold, reduced motion, performance constraints, both AVDs, section gates, release verification, and Code Connect limitation.
- **Scope:** Single presentation feature. No independent backend/domain subsystem needs another plan.
- **Type consistency:** `SplashSection`, `SplashScreenProps`, `SplashOverlayProps`, test IDs, query values, tokens, and Maestro paths remain identical across tasks.
- **Visual-test integrity:** Baselines are promoted only after direct Figma audit. Device-specific typography/full-screen references remain separate. Thresholds are explicit and may not be weakened to conceal unexplained diffs.
- **No unsupported effects:** Only full-overlay opacity changes. No glass, blur, layout, scale, image transition, or network work.
- **No placeholders:** All code, paths, commands, assertions, dimensions, copy, IDs, durations, and expected outcomes are specified.
