"""Puts the approved onboarding stills (design phase) next to the app's real screen, for a visual diff.

    python3 compare-approved.py <approved-dir> out.png name:approved_still:my_shot [...]

A pair is   label=approved.png,mine.png   (mine is read from out/onboarding-shots/).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).parent
shots = here / "out" / "onboarding-shots"
approved_dir = Path(sys.argv[1])
out = Path(sys.argv[2])
pairs = [a.split("=", 1) for a in sys.argv[3:]]
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
W = 380
cols = len(pairs)
H = int(W * 844 / 390)
sheet = Image.new("RGB", (cols * (W * 2 + 30) + 10, H + 44), (118, 118, 122))
d = ImageDraw.Draw(sheet)
for i, (label, files) in enumerate(pairs):
    a, m = files.split(",")
    x = 10 + i * (W * 2 + 30)
    d.text((x, 6), f"{label}:  approved  |  built", fill=(255, 255, 255), font=font)
    ia = Image.open(approved_dir / a).convert("RGB").resize((W, H), Image.LANCZOS)
    im = Image.open(shots / m).convert("RGB").resize((W, H), Image.LANCZOS)
    sheet.paste(ia, (x, 30))
    sheet.paste(im, (x + W + 10, 30))
sheet.save(out)
print(out, sheet.size)
