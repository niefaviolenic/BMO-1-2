#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let sharp;
try {
  sharp = require('sharp');
} catch {
  try {
    const fallbackPath = '/opt/joy/worktrees/bmo-device-readiness/backend/node_modules/sharp';
    sharp = require(fallbackPath);
  } catch (err) {
    console.error('Failed to import sharp. Please ensure sharp is installed.', err);
    process.exit(1);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    width: 320,
    height: 240,
    profile: 'core', // 'core', 'battery', 'all'
    svgDir: path.resolve(__dirname, '../../../BMO_Screen_SVG'),
    outDir: path.resolve(__dirname, '../main/face_assets_generated'),
    colorOrder: 'bgr', // 'bgr' for ILI9341 panel on BMO, 'rgb' standard
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--width' && args[i + 1]) options.width = parseInt(args[++i], 10);
    else if (args[i] === '--height' && args[i + 1]) options.height = parseInt(args[++i], 10);
    else if (args[i] === '--profile' && args[i + 1]) options.profile = args[++i];
    else if (args[i] === '--svg-dir' && args[i + 1]) options.svgDir = path.resolve(args[++i]);
    else if (args[i] === '--out' && args[i + 1]) options.outDir = path.resolve(args[++i]);
    else if (args[i] === '--color-order' && args[i + 1]) options.colorOrder = args[++i];
  }
  return options;
}

const opts = parseArgs();

const PROFILE_ASSETS = {
  core: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14],
  battery: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15],
  all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
};

const targetAssets = PROFILE_ASSETS[opts.profile] || PROFILE_ASSETS.core;

fs.mkdirSync(opts.outDir, { recursive: true });
const previewDir = path.join(opts.outDir, 'previews');
fs.mkdirSync(previewDir, { recursive: true });

function toColor565(r, g, b, colorOrder) {
  if (colorOrder === 'bgr') {
    // BGR 565: High bits B, middle G, low R
    return (((b & 0xF8) << 8) | ((g & 0xFC) << 3) | (r >> 3)) & 0xFFFF;
  }
  // RGB 565: High bits R, middle G, low B
  return (((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)) & 0xFFFF;
}

async function processAssets() {
  console.log(`Rendering BMO face assets: width=${opts.width}, height=${opts.height}, profile=${opts.profile}, order=${opts.colorOrder}`);
  console.log(`SVG directory: ${opts.svgDir}`);
  console.log(`Output directory: ${opts.outDir}`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    width: opts.width,
    height: opts.height,
    profile: opts.profile,
    colorOrder: opts.colorOrder,
    assets: [],
  };

  const assetDescriptors = [];

  for (const assetId of targetAssets) {
    const filename = `Asset ${assetId}.svg`;
    const svgPath = path.join(opts.svgDir, filename);

    if (!fs.existsSync(svgPath)) {
      console.error(`Error: SVG file not found: ${svgPath}`);
      process.exit(1);
    }

    const svgContent = fs.readFileSync(svgPath);
    const hash = crypto.createHash('sha256').update(svgContent).digest('hex');

    // 1. Render SVG proportionally centered on #bae0ce background
    const bg = { r: 186, g: 224, b: 206, alpha: 1 };
    const imagePipeline = sharp(svgContent, { density: 150 })
      .resize(opts.width, opts.height, {
        fit: 'contain',
        background: bg,
      });

    // Save PNG preview
    await imagePipeline.clone().png().toFile(path.join(previewDir, `Asset_${assetId}.png`));

    // Get raw RGBA pixels
    const { data } = await imagePipeline.raw().toBuffer({ resolveWithObject: true });

    // 2. Encode to per-row RLE (runLength, color565)
    const rleData = []; // pairs of [runLen, color565]
    let totalEntries = 0;

    for (let y = 0; y < opts.height; y++) {
      let curColor = -1;
      let runLen = 0;
      for (let x = 0; x < opts.width; x++) {
        const idx = (y * opts.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const color = toColor565(r, g, b, opts.colorOrder);

        if (color === curColor && runLen < 65535) {
          runLen++;
        } else {
          if (runLen > 0) {
            rleData.push(runLen, curColor);
            totalEntries++;
          }
          curColor = color;
          runLen = 1;
        }
      }
      if (runLen > 0) {
        rleData.push(runLen, curColor);
        totalEntries++;
      }
    }

    const totalBytes = rleData.length * 2;
    console.log(`Asset ${assetId}: ${totalEntries} runs, ${totalBytes} bytes (${(totalBytes / 1024).toFixed(1)} KB)`);

    manifest.assets.push({
      assetId,
      filename,
      sha256: hash,
      runs: totalEntries,
      bytes: totalBytes,
    });

    assetDescriptors.push({
      assetId,
      totalEntries,
      totalBytes,
      data: rleData,
    });
  }

  // 3. Generate C++ header
  const headerContent = `#ifndef FACE_ASSETS_H
#define FACE_ASSETS_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint8_t asset_id;
    uint16_t width;
    uint16_t height;
    bool is_rle;
    size_t run_count;
    const uint16_t *data; // (run_length, color565) pairs
} face_asset_t;

const face_asset_t *face_assets_get(uint8_t asset_id);
size_t face_assets_get_count(void);

#ifdef __cplusplus
}
#endif

#endif // FACE_ASSETS_H
`;

  fs.writeFileSync(path.join(opts.outDir, 'face_assets.h'), headerContent);

  // 4. Generate C++ source
  let cppContent = `#include "face_assets.h"\n\n`;

  for (const desc of assetDescriptors) {
    cppContent += `// Asset ${desc.assetId}: ${desc.totalEntries} runs, ${desc.totalBytes} bytes\n`;
    cppContent += `static const uint16_t s_asset_${desc.assetId}_data[${desc.data.length}] = {\n`;
    for (let i = 0; i < desc.data.length; i += 16) {
      const slice = desc.data.slice(i, i + 16);
      cppContent += `    ${slice.map((val) => '0x' + val.toString(16).padStart(4, '0')).join(', ')},\n`;
    }
    cppContent += `};\n\n`;
  }

  cppContent += `static const face_asset_t s_face_assets[] = {\n`;
  for (const desc of assetDescriptors) {
    cppContent += `    { ${desc.assetId}, ${opts.width}, ${opts.height}, true, ${desc.totalEntries}, s_asset_${desc.assetId}_data },\n`;
  }
  cppContent += `};\n\n`;

  cppContent += `const face_asset_t *face_assets_get(uint8_t asset_id)\n{\n`;
  cppContent += `    for (size_t i = 0; i < sizeof(s_face_assets) / sizeof(s_face_assets[0]); ++i) {\n`;
  cppContent += `        if (s_face_assets[i].asset_id == asset_id) return &s_face_assets[i];\n`;
  cppContent += `    }\n`;
  cppContent += `    return &s_face_assets[2]; // Default fallback to Asset 3\n`;
  cppContent += `}\n\n`;

  cppContent += `size_t face_assets_get_count(void)\n{\n`;
  cppContent += `    return sizeof(s_face_assets) / sizeof(s_face_assets[0]);\n`;
  cppContent += `}\n`;

  fs.writeFileSync(path.join(opts.outDir, 'face_assets.cpp'), cppContent);
  fs.writeFileSync(path.join(opts.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`Generated face_assets.h, face_assets.cpp, and manifest.json successfully!`);
}

processAssets().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
