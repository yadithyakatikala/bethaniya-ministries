#!/usr/bin/env python3
"""
Derives every Maranatha launcher, splash and icon asset from the ONE
source portrait, so the whole set can never drift apart.

---------------------------------------------------------------------
SOURCE
---------------------------------------------------------------------
    mobile/assets/brand/maranatha-portrait-source.jpg
    sha256 7607cbbd5d2cb2a928de5b505a59ebb934f96dcb470cfc357ff40d95f594ee54
    1136 x 1385, JPEG, black-and-white studio portrait

The hash is asserted on every run. If the source is replaced, the run
FAILS rather than silently producing a different identity -- and the new
hash has to be pasted in deliberately, which is the point.

The photograph itself is never retouched: no grading, no sharpening, no
skin work. Every output below is a crop, a resize, an alpha mask, or (for
the Android monochrome layer only) a documented threshold. Nothing is
painted in and nothing is generated.

---------------------------------------------------------------------
GEOMETRY, MEASURED NOT GUESSED
---------------------------------------------------------------------
Measured off the source by sampling luminance against the per-column
studio-backdrop value:

    head spans      x 257..894   (width 637, centred on x=575)
    hair top        y 145
    neck shadow     y ~988       (so the head box is ~637 x 815)
    backdrop        L 121..136   (a slight left-to-right gradient)
    face            L 169..205   -- BRIGHTER than the backdrop
    hair / eyes     L  94..109   -- DARKER than the backdrop

That last pair is why the monochrome layer cannot be a simple threshold:
the backdrop sits BETWEEN the face and the hair, so any single cut turns
part of the backdrop into ink. See MONOCHROME below.

---------------------------------------------------------------------
THE ANDROID ADAPTIVE-ICON CONSTRAINT
---------------------------------------------------------------------
An adaptive icon is authored at 1080x1080 but launchers mask it to a
circle, squircle or rounded square, and only the centre 66% -- a 713x713
region -- is guaranteed visible. A rectangular photo crop pasted into
that canvas reads as a grey square with a face in it once masked.

So the foreground is a CIRCULAR portrait exactly 713px across, centred.
Under a circular mask it fills the icon edge to edge; under a squircle it
sits as a deliberate disc on the flat background. Either way the face is
never clipped, which a rectangular crop could not promise.

Verified by rendering at 48px (roughly launcher size on a phone): the
circular portrait stays recognisable, which is the whole test.

Usage:
    python3 scripts/generate-brand-assets.py            # write assets
    python3 scripts/generate-brand-assets.py --check     # verify only

Requires Pillow. Idempotent: same source in, same bytes out.
"""
import hashlib
import statistics
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    sys.exit("This script needs Pillow:  pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "mobile/assets/brand"
ASSETS = ROOT / "mobile/assets"
ADMIN_PUBLIC = ROOT / "admin/public"
SOURCE = BRAND / "maranatha-portrait-source.jpg"

EXPECTED_SHA256 = "7607cbbd5d2cb2a928de5b505a59ebb934f96dcb470cfc357ff40d95f594ee54"

# Measured head geometry -- see the module docstring.
HEAD_CENTRE_X, HEAD_CENTRE_Y = 575, 552

# The circular crop: a 905px square, so the 815px-tall head fills ~90% of
# the circle's diameter. Any tighter clips the hair; any looser and the
# face is too small to read at launcher size.
CIRCLE_SQUARE = 905

# The square crop for the full-bleed iOS/Expo icon: head and shoulders
# with ~8% headroom above the hair.
SQUARE_CROP = (50, 61, 1100, 1111)  # 1050 x 1050

# Adaptive icon canvas, and the 66% safe zone inside it.
ADAPTIVE = 1080
SAFE_ZONE = 713

# Flat background for the adaptive icon. Black, per the black-and-white
# identity -- deliberately NOT the V1 navy (#273456), which belonged to
# the previous church logo.
BACKGROUND = (0, 0, 0)

# MONOCHROME threshold. Ink wherever a pixel differs from the backdrop by
# more than this, which captures the bright face AND the dark hair while
# leaving the backdrop clear -- the one cut that works given the measured
# luminances above. 26 was chosen by rendering 22 / 26 / 32 at 48, 72 and
# 144px and comparing; all three are similar, and 26 keeps the most hair
# detail without speckling the jaw.
MONO_THRESHOLD = 26
MONO_DESPECKLE = 5  # median filter window


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def backdrop_by_column(grey: Image.Image) -> list[float]:
    """The studio backdrop's luminance per column, read above the head."""
    width, _ = grey.size
    pixels = grey.load()
    return [statistics.mean(pixels[x, y] for y in range(5, 80)) for x in range(width)]


def circle_box() -> tuple[int, int, int, int]:
    half = CIRCLE_SQUARE // 2
    return (
        HEAD_CENTRE_X - half,
        HEAD_CENTRE_Y - half,
        HEAD_CENTRE_X - half + CIRCLE_SQUARE,
        HEAD_CENTRE_Y - half + CIRCLE_SQUARE,
    )


def circular_portrait(source: Image.Image, size: int) -> Image.Image:
    """The head, cropped square and masked to a circle, on transparency."""
    face = source.crop(circle_box()).resize((size, size), Image.LANCZOS).convert("RGB")
    # Draw the mask oversized and downsample it, so the circle's edge is
    # antialiased rather than stair-stepped.
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(face, (0, 0), mask)
    return out


def monochrome_layer(source: Image.Image, size: int) -> Image.Image:
    """
    The Android 13+ themed-icon layer: a high-contrast reduction of the
    same portrait, as alpha, which the system tints with one colour.

    Ink is "differs from the backdrop", not "is dark" -- the face is
    brighter than the backdrop and the hair is darker, so thresholding on
    darkness alone would ink the backdrop. Eyes, brows and the moustache
    shadow fall close to the backdrop's own value and so read as gaps in
    the tinted shape, which is what makes it legible as a face.
    """
    grey = source.convert("L")
    width, height = grey.size
    pixels = grey.load()
    backdrop = backdrop_by_column(grey)

    ink = Image.new("L", (width, height), 0)
    ink_pixels = ink.load()
    for y in range(height):
        for x in range(width):
            ink_pixels[x, y] = 255 if abs(pixels[x, y] - backdrop[x]) > MONO_THRESHOLD else 0
    ink = ink.filter(ImageFilter.MedianFilter(MONO_DESPECKLE))

    alpha = ink.crop(circle_box()).resize((size, size), Image.LANCZOS)
    white = Image.new("L", (size, size), 255)
    return Image.merge("RGBA", (white, white, white, alpha))


def centre_on_canvas(layer: Image.Image, canvas: int) -> Image.Image:
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    offset = (canvas - layer.width) // 2
    out.paste(layer, (offset, offset), layer)
    return out


def main() -> None:
    check_only = "--check" in sys.argv

    if not SOURCE.exists():
        sys.exit(f"missing source portrait: {SOURCE.relative_to(ROOT)}")

    actual = sha256(SOURCE)
    if actual != EXPECTED_SHA256:
        sys.exit(
            f"source portrait has changed.\n"
            f"  expected sha256 {EXPECTED_SHA256}\n"
            f"  found    sha256 {actual}\n"
            f"If this is intended, update EXPECTED_SHA256 in this script "
            f"deliberately and regenerate."
        )

    source = Image.open(SOURCE)
    source.load()
    if source.size != (1136, 1385):
        sys.exit(f"expected a 1136x1385 source, found {source.size[0]}x{source.size[1]}")

    outputs: dict[Path, Image.Image] = {}

    # iOS / Expo icon: full-bleed square, head and shoulders, opaque.
    outputs[ASSETS / "icon.png"] = (
        source.crop(SQUARE_CROP).resize((1024, 1024), Image.LANCZOS).convert("RGB")
    )

    # Android adaptive icon: circular portrait in the safe zone, flat
    # background, and the tintable monochrome layer.
    outputs[ASSETS / "android-icon-foreground.png"] = centre_on_canvas(
        circular_portrait(source, SAFE_ZONE), ADAPTIVE
    )
    outputs[ASSETS / "android-icon-background.png"] = Image.new(
        "RGB", (ADAPTIVE, ADAPTIVE), BACKGROUND
    )
    outputs[ASSETS / "android-icon-monochrome.png"] = centre_on_canvas(
        monochrome_layer(source, SAFE_ZONE), ADAPTIVE
    )

    # Splash: drawn at imageWidth 240 by expo-splash-screen, so 720 gives
    # 3x headroom for the densest screens without carrying weight nothing
    # can see. Transparent, so it composites on the light and dark splash
    # backgrounds alike.
    outputs[ASSETS / "splash-icon.png"] = circular_portrait(source, 720)

    # Web favicon for the Expo web target.
    outputs[ASSETS / "favicon.png"] = (
        source.crop(SQUARE_CROP).resize((48, 48), Image.LANCZOS).convert("RGB")
    )

    # The admin dashboard's browser-tab icon. It previously shipped the
    # generic purple Vite starter mark, which was neither Maranatha nor
    # black-and-white; admin/index.html now points at this instead.
    outputs[ADMIN_PUBLIC / "favicon.png"] = (
        source.crop(SQUARE_CROP).resize((64, 64), Image.LANCZOS).convert("RGB")
    )

    for path, image in outputs.items():
        if check_only:
            status = "exists" if path.exists() else "MISSING"
            print(f"  {status:>7}  {path.relative_to(ROOT)}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, "PNG", optimize=True)
        print(
            f"  wrote {path.relative_to(ROOT)}  "
            f"{image.width}x{image.height} {image.mode}"
        )

    if not check_only:
        print(f"\n  source sha256 {actual}  (verified)")


if __name__ == "__main__":
    main()
