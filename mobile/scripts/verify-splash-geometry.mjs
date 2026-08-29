import fs from 'node:fs';
import { PNG } from 'pngjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }),
);

for (const key of ['screenshot', 'hierarchy']) {
  if (!args[key]) throw new Error(`Missing --${key}=<path>`);
}

const png = PNG.sync.read(fs.readFileSync(args.screenshot));
const hierarchy = fs.readFileSync(args.hierarchy, 'utf8');

function nodeBounds(id) {
  const line = hierarchy.split('\n').find((entry) => entry.includes(`resource-id=${id};`));
  if (!line) throw new Error(`Missing hierarchy node: ${id}`);
  const match = line.match(/bounds=\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) throw new Error(`Missing bounds for hierarchy node: ${id}`);
  return match.slice(1).map(Number);
}

function nearly(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

const metricsMatch = hierarchy.match(
  /splash-metrics:(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?);bottom=(\d+(?:\.\d+)?)/,
);
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
const [expressionLeft, expressionTop, expressionRight, expressionBottom] =
  nodeBounds('splash-expression');
const [signatureLeft, , signatureRight, signatureBottom] = nodeBounds('splash-signature');

nearly(expressionRight - expressionLeft, 64 * scale, tolerance, 'Expression width');
nearly(expressionBottom - expressionTop, 64 * scale, tolerance, 'Expression height');
nearly(
  (expressionLeft + expressionRight) / 2,
  (rootLeft + rootRight) / 2,
  tolerance,
  'Expression horizontal center',
);
nearly(
  (expressionTop + expressionBottom) / 2,
  (rootTop + rootBottom) / 2,
  tolerance,
  'Expression vertical center',
);
nearly(
  (signatureLeft + signatureRight) / 2,
  (rootLeft + rootRight) / 2,
  tolerance,
  'Signature horizontal center',
);
nearly(
  rootBottom - bottomInsetDp * scale - signatureBottom,
  16 * scale,
  tolerance,
  'Signature safe-area gap',
);

let nonWhiteBackgroundPixels = 0;
for (let y = 0; y < png.height; y += Math.max(1, Math.floor(scale * 8))) {
  for (let x = 0; x < png.width; x += Math.max(1, Math.floor(scale * 8))) {
    const insideExpression =
      x >= expressionLeft &&
      x < expressionRight &&
      y >= expressionTop &&
      y < expressionBottom;
    const nearSignature = y >= signatureBottom - 24 * scale && y <= signatureBottom + 2 * scale;
    const insideSystemBars = y < rootTop + 24 * scale || y >= rootBottom - bottomInsetDp * scale;
    if (insideExpression || nearSignature || insideSystemBars) continue;
    const index = (png.width * y + x) * 4;
    const [red, green, blue, alpha] = png.data.subarray(index, index + 4);
    if (alpha !== 255 || red < 250 || green < 250 || blue < 250) {
      nonWhiteBackgroundPixels++;
    }
  }
}
if (nonWhiteBackgroundPixels > 0) {
  throw new Error(`Background contains ${nonWhiteBackgroundPixels} sampled non-white pixels`);
}

console.log(`Splash geometry valid at ${widthDp}x${heightDp} dp, scale ${scale.toFixed(2)}`);
