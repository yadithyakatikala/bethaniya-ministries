"""Joins the screenshots qa-onboarding-screen.mjs wrote into one labelled sheet per scenario.

    python3 contact-sheets.py                 # every scenario
    python3 contact-sheets.py chapter-light   # one scenario
    python3 contact-sheets.py chapter-light 6 # ... with 6 columns
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).parent
shots = here / "out" / "onboarding-shots"
sheets = here / "out" / "onboarding-sheets"
sheets.mkdir(parents=True, exist_ok=True)

want = sys.argv[1] if len(sys.argv) > 1 else None
cols_arg = int(sys.argv[2]) if len(sys.argv) > 2 else None
groups = {}
for f in sorted(shots.glob("*.png")):
    scenario, _, name = f.stem.partition("__")
    groups.setdefault(scenario, []).append((name, f))

try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
except OSError:
    font = ImageFont.load_default()

for scenario, items in groups.items():
    if want and scenario != want:
        continue
    cols = cols_arg or min(6, len(items))
    first = Image.open(items[0][1])
    thumb_w = 300 if len(items) > 8 else 340
    scale = thumb_w / first.width
    thumb_h = int(first.height * scale)
    pad, label_h = 10, 24
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (thumb_w + pad) + pad, rows * (thumb_h + label_h + pad) + pad), (118, 118, 122))
    draw = ImageDraw.Draw(sheet)
    for i, (name, f) in enumerate(items):
        im = Image.open(f).convert("RGB")
        im = im.resize((thumb_w, int(im.height * thumb_w / im.width)), Image.LANCZOS)
        x = pad + (i % cols) * (thumb_w + pad)
        y = pad + (i // cols) * (thumb_h + label_h + pad)
        draw.text((x, y + 3), name, fill=(255, 255, 255), font=font)
        sheet.paste(im, (x, y + label_h))
    out = sheets / f"{scenario}.png"
    sheet.save(out)
    print(out, sheet.size)
