"""Builds the static Archivo instances in assets/fonts.

React Native can't set font-variation-settings, so the design system's widths are baked into separate files:
  ArchivoDisplay   width 112, weight 800  (.pk-display-*)
  ArchivoWide      width 125, weight 600  (.pk-wide, tags, wide buttons)
  ArchivoWideBold  width 125, weight 700  (wordmark)

Usage: pip install fonttools brotli && python3 scripts/make-fonts.py
"""
import io
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

# Latin subset of the Archivo variable font (wdth 62..125, wght 100..900) served by Google Fonts.
SRC = "https://fonts.gstatic.com/s/archivo/v25/k3kQo8UDI-1M0wlSfdnoLg.woff2"
OUT = "assets/fonts/"

data = urllib.request.urlopen(SRC).read()
for name, wdth, wght in [("ArchivoDisplay", 112, 800), ("ArchivoWide", 125, 600), ("ArchivoWideBold", 125, 700)]:
    f = instantiateVariableFont(TTFont(io.BytesIO(data)), {"wdth": wdth, "wght": wght})
    f.flavor = None
    names = f["name"]
    for rec in list(names.names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 25):
            names.removeNames(nameID=rec.nameID)
    for pid, eid, lid in [(3, 1, 0x409), (1, 0, 0)]:
        for nid, val in [(1, name), (2, "Regular"), (3, name + "-Regular"), (4, name), (6, name)]:
            names.setName(val, nid, pid, eid, lid)
    f["OS/2"].usWeightClass = 400
    f["OS/2"].fsSelection = (f["OS/2"].fsSelection & ~0b1100001) | 0x40
    f["head"].macStyle = 0
    f.save(OUT + name + ".ttf")
    print("wrote", OUT + name + ".ttf")
