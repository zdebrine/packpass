"""Writes the app icon, Android adaptive icon, splash mark and web favicon into assets/ from the PackPass paw
(assets/brand/app-icon.png: a black paw with a ticket cut-out on cream, 1024 x 1024).
    python3 scripts/make-icons.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'
SOURCE = ASSETS / 'brand' / 'app-icon.png'
CREAM = (254, 255, 240)  # the source's background; also android.adaptiveIcon.backgroundColor in app.json


def paw(color, size: int, fill: float) -> Image.Image:
    """The paw alone in `color` on transparent, its larger side `fill` of a size x size canvas."""
    grey = Image.open(SOURCE).convert('L')
    ink, paper = 14, 254
    alpha = grey.point(lambda v: max(0, min(255, round((paper - v) * 255 / (paper - ink)))))
    alpha = alpha.crop(alpha.point(lambda v: 255 if v > 8 else 0).getbbox())
    scale = size * fill / max(alpha.size)
    alpha = alpha.resize((round(alpha.width * scale), round(alpha.height * scale)), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (*color, 0))
    layer = Image.new('RGBA', alpha.size, (*color, 255))
    layer.putalpha(alpha)
    out.alpha_composite(layer, ((size - alpha.width) // 2, (size - alpha.height) // 2))
    return out


def main():
    # iOS and the store listing: the artwork as given, no transparency (Apple rejects alpha in the 1024 icon).
    Image.open(SOURCE).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(ASSETS / 'icon.png')
    # Android adaptive foreground: the paw inside the 66% safe zone, on the cream background set in app.json.
    paw((14, 15, 14), 1024, 0.50).save(ASSETS / 'adaptive-icon.png')
    # Splash: a cream paw, drawn by expo-splash-screen on the app's near-black (#0e0f0e).
    paw(CREAM, 1024, 0.80).save(ASSETS / 'splash-icon.png')
    Image.open(SOURCE).convert('RGB').resize((48, 48), Image.LANCZOS).save(ASSETS / 'favicon.png')


if __name__ == '__main__':
    main()
