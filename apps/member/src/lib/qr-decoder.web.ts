import { setZXingModuleOverrides } from 'barcode-detector';

/**
 * Browsers without a built-in BarcodeDetector (Safari, Firefox) scan with expo-camera's zxing fallback.
 * Load its WebAssembly from this site (copied to public/ by scripts/copy-zxing.mjs) instead of a CDN.
 */
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? `/${path}` : prefix + path),
});
