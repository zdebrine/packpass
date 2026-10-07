"""Writes the app icon, Android adaptive icon, splash mark and web favicon into assets/.

An interim mark until PackPass has a designed logo: "PP" in Archivo Display (the app's display face) over a
short Agility-yellow bar, on the app's near-black. Replace the PNGs (same names and sizes) to change it.
    python3 scripts/make-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'
INK = (14, 15, 14, 255)        # inverse / dark bg (#0e0f0e)
PAPER = (244, 245, 241, 255)   # onPitch (#f4f5f1)
AGILITY = (242, 194, 48, 255)  # agility (#f2c230)
FONT = ASSETS / 'fonts' / 'ArchivoDisplay.ttf'


def mark(size: int, scale: float, bg) -> Image.Image:
    """The mark centred on a size x size canvas, its letters `scale` of the canvas wide."""
    im = Image.new('RGBA', (size, size), bg)
    d = ImageDraw.Draw(im)
    text = 'PP'
    # Find the font size that makes the letters `scale` of the canvas wide.
    px = 10
    font = ImageFont.truetype(str(FONT), px)
    while True:
        nxt = ImageFont.truetype(str(FONT), px + 4)
        l, t, r, b = d.textbbox((0, 0), text, font=nxt)
        if r - l > size * scale:
            break
        px, font = px + 4, nxt
    # Measure the inked letters (textbbox includes side bearings) by drawing them once on a scratch layer.
    probe = Image.new('L', (size * 2, size * 2), 0)
    ImageDraw.Draw(probe).text((size / 2, size / 2), text, font=font, fill=255)
    l, t, r, b = probe.getbbox()
    l, t, r, b = l - size / 2, t - size / 2, r - size / 2, b - size / 2
    w, h = r - l, b - t
    bar_h = round(h * 0.13)
    gap = round(h * 0.16)
    total = h + gap + bar_h
    left, top = (size - w) / 2, (size - total) / 2
    d.text((left - l, top - t), text, font=font, fill=PAPER)
    by0 = top + h + gap
    d.rounded_rectangle([left, by0, left + w * 0.42, by0 + bar_h], radius=bar_h / 2, fill=AGILITY)
    return im


def main():
    # iOS and the store listing: full bleed, no transparency (Apple rejects alpha in the 1024 icon).
    mark(1024, 0.56, INK).convert('RGB').save(ASSETS / 'icon.png')
    # Android adaptive foreground: transparent, kept inside the 66% safe zone; background colour is in app.json.
    mark(1024, 0.40, (0, 0, 0, 0)).save(ASSETS / 'adaptive-icon.png')
    # Splash: the mark alone; expo-splash-screen draws it at imageWidth on the app.json background colour.
    mark(1024, 0.70, (0, 0, 0, 0)).save(ASSETS / 'splash-icon.png')
    mark(48, 0.62, INK).save(ASSETS / 'favicon.png')


if __name__ == '__main__':
    main()
