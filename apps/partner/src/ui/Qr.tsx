import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** A scannable QR code (SVG). The member app reads "packpass:checkin:<session id>:<code>". */
export function Qr({ value, size = 252 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0e0f0e', light: '#ffffff' } }).then(setSvg).catch(() => setSvg(''));
  }, [value]);
  return <div role="img" aria-label="Check-in QR code" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg.replace('<svg', `<svg width="${size}" height="${size}"`) }} />;
}

export const checkInPayload = (sessionId: string, code: string) => `packpass:checkin:${sessionId}:${code}`;
