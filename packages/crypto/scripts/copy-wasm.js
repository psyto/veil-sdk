#!/usr/bin/env node

/**
 * Copy WASM files for Light Protocol hasher
 *
 * This script copies the necessary WASM files for the Light Protocol
 * hasher to work correctly in browser environments (like Next.js).
 */

const fs = require('fs');
const path = require('path');

const wasmFiles = [
  {
    src: 'node_modules/@lightprotocol/hasher.rs/dist/hasher_wasm_simd_bg.wasm',
    dest: 'node_modules/@lightprotocol/hasher.rs/dist/browser-fat/es/hasher_wasm_simd_bg.wasm',
  },
  {
    src: 'node_modules/@lightprotocol/hasher.rs/dist/light_wasm_hasher_bg.wasm',
    dest: 'node_modules/@lightprotocol/hasher.rs/dist/browser-fat/es/light_wasm_hasher_bg.wasm',
  },
];

function copyWasmFiles() {
  for (const { src, dest } of wasmFiles) {
    const srcPath = path.resolve(process.cwd(), src);
    const destPath = path.resolve(process.cwd(), dest);

    // Check if source exists
    if (!fs.existsSync(srcPath)) {
      console.log(`Source file not found: ${src} (skipping)`);
      continue;
    }

    // Create destination directory if needed
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy file
    try {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${src} -> ${dest}`);
    } catch (error) {
      console.error(`Failed to copy ${src}: ${error.message}`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  copyWasmFiles();
}

module.exports = { copyWasmFiles };
