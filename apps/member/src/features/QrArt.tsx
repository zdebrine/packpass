import { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

/** A QR-looking matrix (finder patterns + timing + seeded noise), ported from the design. Decorative only. */
function qrMatrix(n: number, seed: number) {
  let h = seed;
  const rnd = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  const finders = [[0, 0], [0, n - 7], [n - 7, 0]];
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      const f = finders.find(([a, b]) => r >= a - 1 && r <= a + 7 && c >= b - 1 && c <= b + 7);
      if (f) {
        const y = r - f[0];
        const x = c - f[1];
        if (y < 0 || x < 0 || y > 6 || x > 6) return 0;
        return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4) ? 1 : 0;
      }
      if (r === 6) return c % 2 === 0 ? 1 : 0;
      if (c === 6) return r % 2 === 0 ? 1 : 0;
      return rnd() > 0.52 ? 1 : 0;
    }),
  );
}

export function QrArt({ size, seed = 31 }: { size: number; seed?: number }) {
  const m = useMemo(() => qrMatrix(25, seed), [seed]);
  return (
    <Svg width={size} height={size} viewBox="0 0 25 25">
      {m.flatMap((row, r) => row.map((v, c) => (v ? <Rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0e0f0e" /> : null)))}
    </Svg>
  );
}
