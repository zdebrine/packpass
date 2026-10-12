// Copies the QR decoder's WebAssembly into public/, so the web build serves it from its own origin
// (src/lib/qr-decoder.web.ts). Without it, browsers with no built-in BarcodeDetector (Safari, Firefox)
// fetch it from fastly.jsdelivr.net when the check-in scanner opens. Runs on npm install.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// The copy barcode-detector (expo-camera's web scanner) loads, so the file matches its decoder.
const from = require.resolve('zxing-wasm/reader/zxing_reader.wasm', { paths: [require.resolve('barcode-detector')] });
if (!existsSync(from)) throw new Error(`No QR decoder at ${from}`);
mkdirSync(join(root, 'public'), { recursive: true });
copyFileSync(from, join(root, 'public/zxing_reader.wasm'));
