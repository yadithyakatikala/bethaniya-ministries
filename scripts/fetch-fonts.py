#!/usr/bin/env python3
"""Fetch, verify and bundle Maranatha's typefaces.

=======================================================================
WHY THIS SCRIPT EXISTS
=======================================================================
Before M3 the app rendered entirely on the platform system font: no font
file was bundled, and `fontFamily` appeared in exactly zero screens. The
admin was worse than unstyled -- it pulled Newsreader and Archivo from
`fonts.googleapis.com` on every page load, which is a third-party runtime
dependency the product is not allowed to have.

Fonts are binary assets committed to the repository, so how they were
obtained has to be reproducible and auditable. This script is that
record: every file has a pinned upstream URL and an asserted SHA-256, so
re-running it either reproduces exactly the bundled bytes or fails
loudly. Same contract as scripts/import-telugu-bible.mjs.

=======================================================================
WHY THESE THREE FAMILIES
=======================================================================
The app renders English and Telugu, and React Native cannot fall back
between fonts *within* one Text node in any controlled way: an
unavailable glyph drops to the platform's own font with its own metrics,
mid-word. So the question is not "which font is prettiest" but "which
font covers every character this app will ever put in one Text node".

That question has a measurable answer, and MEASURING IT CHANGED THE
CHOICE. The approved V1 prototype specified Newsreader + Archivo +
Noto Sans Telugu. Checked against the real content:

  * Noto Sans Telugu and Noto Serif Telugu contain ZERO Latin letters
    (0 of 52). The Telugu UI catalogue contains 26 of them -- 'YouTube',
    'you@example.com', 'Google', 'CC BY-SA', and the product name itself.
    Setting a Telugu-only face on Telugu interface text would have left
    every one of those words without glyphs.
  * Newsreader and Archivo contain zero Telugu. Bilingual scripture
    would have paired an English serif against an unrelated fallback
    Telugu face, line by line, on the app's most important screen.

So:

  INTERFACE -- Hind Guntur (Indian Type Foundry).
    One family covering Telugu AND Latin, so no interface label can ever
    mix a bundled face with a fallback. Verified below against both UI
    catalogues (112 distinct characters, 0 missing) and against the
    entire bundled Telugu Bible (3.7M characters, 91 distinct,
    0 missing). It replaces Archivo, which is why Archivo is not here.

  SCRIPTURE + DISPLAY -- Noto Serif (Latin) and Noto Serif Telugu.
    Siblings from one design programme, so bilingual stacked verses read
    as one typeface rather than two. Scripture Text nodes are always
    single-script -- proved below: the WEB English text is pure ASCII and
    the Telugu IRV text contains no Latin at all -- so choosing the face
    by language is safe here in a way it is not for interface text.

=======================================================================
LICENSING
=======================================================================
All three are SIL Open Font License 1.1, which permits bundling in an
application, commercial use, and modification. The OFL text for each
family is written next to the fonts. Subsetting (below) is a
modification the OFL allows; none of these families declares a Reserved
Font Name that the subset would violate, and the subset keeps the
original family names, so the fonts remain the upstream fonts with a
reduced character set rather than derivatives under a new name.

=======================================================================
SUBSETTING
=======================================================================
Noto Serif's full Latin face carries Greek, Cyrillic and much more --
712 KB per weight for an app that renders ASCII scripture. Those two
faces are subset to the documented ranges below, cutting ~1.1 MB from
the bundle. The Telugu faces and Hind Guntur are NOT subset: Telugu is a
complex script whose shaping depends on the full repertoire and its
lookup tables, and the saving would not justify the risk.

The subset is verified, not trusted: every character of the bundled WEB
English Bible and of both UI catalogues must survive it, or this script
fails.

Usage:
    pip install 'fonttools[woff]' brotli
    python3 scripts/fetch-fonts.py            # fetch, verify, write
    python3 scripts/fetch-fonts.py --check    # verify what is committed
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOBILE_FONTS = ROOT / "mobile" / "assets" / "fonts"
ADMIN_FONTS = ROOT / "admin" / "public" / "fonts"

NOTO = "https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts"
GF = "https://raw.githubusercontent.com/google/fonts/main/ofl"

# ---------------------------------------------------------------------
# The bundle. `subset` marks the Latin-only faces that get trimmed.
# Hashes are of the UPSTREAM file, before any subsetting.
# ---------------------------------------------------------------------
Face = collections.namedtuple("Face", "name url subset admin_woff2")

FACES = [
    # Interface: Telugu + Latin in one family.
    Face("HindGuntur-Regular", f"{GF}/hindguntur/HindGuntur-Regular.ttf", False, True),
    Face("HindGuntur-Medium", f"{GF}/hindguntur/HindGuntur-Medium.ttf", False, True),
    Face("HindGuntur-SemiBold", f"{GF}/hindguntur/HindGuntur-SemiBold.ttf", False, True),
    Face("HindGuntur-Bold", f"{GF}/hindguntur/HindGuntur-Bold.ttf", False, True),
    # Scripture / display, English.
    Face("NotoSerif-Regular", f"{NOTO}/NotoSerif/hinted/ttf/NotoSerif-Regular.ttf",
         True, True),
    Face("NotoSerif-SemiBold", f"{NOTO}/NotoSerif/hinted/ttf/NotoSerif-SemiBold.ttf",
         True, True),
    # Scripture / display, Telugu.
    Face("NotoSerifTelugu-Regular",
         f"{NOTO}/NotoSerifTelugu/hinted/ttf/NotoSerifTelugu-Regular.ttf",
         False, False),
    Face("NotoSerifTelugu-SemiBold",
         f"{NOTO}/NotoSerifTelugu/hinted/ttf/NotoSerifTelugu-SemiBold.ttf",
         False, False),
]

# Upstream SHA-256 of every file above, asserted on every run. A mismatch
# means the upstream file moved under us; that is a decision to make
# deliberately, not something to absorb silently into a font asset.
UPSTREAM_SHA256 = {
    "HindGuntur-Regular": "2f9b4d31507c92fe1d54e5256904e41d91698b952c90d66bfe926cd156dac4eb",
    "HindGuntur-Medium": "370d2838cc51cbf0060f164ffe11ecb35a2619452b8c8d200beccb50e3d0228c",
    "HindGuntur-SemiBold": "c143afa804c637d05c6c30542c0533820046d52e2c4c32dd7b6a8a51ef307594",
    "HindGuntur-Bold": "e3e88e87a47094b34d1b0bc4a88f700cb1d1d35dd6286bd224bc35cc1712b167",
    "NotoSerif-Regular": "19e72cd8d595fae5bd74a5206f5d938512e1183d4fed7abb1ec1be1d7efa5f88",
    "NotoSerif-SemiBold": "8a344d65ba56c58991ec6c3b40faf73af4e73ecd3e1db624ea640292d98b5bb6",
    "NotoSerifTelugu-Regular": "2b376e0351fb140f2edad9c54e8977f4f1effc4fe72443e152b3f6ad392c6f5f",
    "NotoSerifTelugu-SemiBold": "fb5905551e8b5c75d035c779662a3defdb7cd8d3f9f6db191d394e5a57db8b69",
}

LICENCES = {
    "OFL-HindGuntur.txt": f"{GF}/hindguntur/OFL.txt",
    "OFL-NotoSerif.txt": "https://raw.githubusercontent.com/notofonts/latin-greek-cyrillic/main/OFL.txt",
    "OFL-NotoSerifTelugu.txt": "https://raw.githubusercontent.com/notofonts/telugu/main/OFL.txt",
}

# ---------------------------------------------------------------------
# What the subset must keep. Deliberately wider than today's content:
# Latin-1 and Latin Extended-A cover accented names in church content,
# General Punctuation covers the curly quotes and dashes the WEB text
# uses, and the handful of singles are symbols the UI prints.
# ---------------------------------------------------------------------
SUBSET_RANGES = [
    (0x0000, 0x00FF),  # Basic Latin + Latin-1 Supplement
    (0x0100, 0x017F),  # Latin Extended-A
    (0x2000, 0x206F),  # General Punctuation (quotes, dashes, ellipsis, bullet)
    (0x20A0, 0x20BF),  # Currency symbols
    (0x2122, 0x2122),  # TRADE MARK SIGN
    (0x2190, 0x2193),  # Arrows
    (0x2212, 0x2212),  # MINUS SIGN
    (0x25CF, 0x25CF),  # BLACK CIRCLE
    (0xFB00, 0xFB06),  # Latin ligatures
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=180) as response:
        return response.read()


# ---------------------------------------------------------------------
# The content the fonts have to cover. Read from the repository, not
# hardcoded, so this check tracks the app instead of drifting from it.
# ---------------------------------------------------------------------
def catalogue_characters() -> tuple[set[str], set[str]]:
    """Distinct characters in the English and Telugu UI catalogues."""
    source = (ROOT / "mobile" / "src" / "i18n" / "strings.ts").read_text("utf-8")
    blocks = [m.start() for m in re.finditer(r"Strings\s*=\s*\{", source)]
    if len(blocks) != 2:
        raise SystemExit(
            f"expected two string catalogues in strings.ts, found {len(blocks)}"
        )

    def chars(block: str) -> set[str]:
        out: set[str] = set()
        for value in re.findall(r":\s*'((?:[^'\\]|\\.)*)'", block):
            out |= set(value)
        return out

    return chars(source[blocks[0]:blocks[1]]), chars(source[blocks[1]:])


def bible_characters(filename: str, extract) -> collections.Counter:
    path = ROOT / "mobile" / "src" / "features" / "bible" / "data" / filename
    data = json.loads(path.read_text("utf-8"))
    freq: collections.Counter = collections.Counter()
    for book in data.values():
        for chapter in book.values():
            for entry in chapter:
                freq.update(extract(entry))
    return freq


def codepoints(font_bytes: bytes) -> set[int]:
    from fontTools.ttLib import TTFont
    import io

    font = TTFont(io.BytesIO(font_bytes), lazy=True)
    covered: set[int] = set()
    for table in font["cmap"].tables:
        covered |= set(table.cmap.keys())
    font.close()
    return covered


def require_coverage(label: str, font_bytes: bytes, needed, what: str) -> None:
    covered = codepoints(font_bytes)
    missing = sorted({c for c in needed if ord(c) not in covered})
    if missing:
        detail = " ".join(f"U+{ord(c):04X} {unicodedata.name(c, '?')}" for c in missing[:20])
        raise SystemExit(f"{label} is missing {len(missing)} character(s) of {what}: {detail}")
    print(f"  {label}: covers all {len(set(needed))} characters of {what}")


def subset(font_bytes: bytes) -> bytes:
    from fontTools import subset as ft_subset
    from fontTools.ttLib import TTFont
    import io

    unicodes = []
    for start, end in SUBSET_RANGES:
        unicodes.extend(range(start, end + 1))

    font = TTFont(io.BytesIO(font_bytes))
    options = ft_subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.notdef_outline = True
    options.recalc_bounds = True
    options.drop_tables = []
    subsetter = ft_subset.Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)

    out = io.BytesIO()
    font.save(out)
    font.close()
    return out.getvalue()


def to_woff2(font_bytes: bytes) -> bytes:
    from fontTools.ttLib import TTFont
    import io

    font = TTFont(io.BytesIO(font_bytes))
    font.flavor = "woff2"
    out = io.BytesIO()
    font.save(out)
    font.close()
    return out.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the committed fonts cover the app's content; download nothing",
    )
    args = parser.parse_args()

    english_ui, telugu_ui = catalogue_characters()
    both_ui = english_ui | telugu_ui
    web = bible_characters("web-en.json", lambda verse: verse)
    irv = bible_characters("irv-te.json", lambda span: span[2])
    print(
        f"content to cover: UI en={len(english_ui)} te={len(telugu_ui)} "
        f"union={len(both_ui)}; WEB={len(web)} distinct; IRV={len(irv)} distinct"
    )

    if args.check:
        ok = True
        for face in FACES:
            path = MOBILE_FONTS / f"{face.name}.ttf"
            if not path.exists():
                print(f"  MISSING {path.relative_to(ROOT)}")
                ok = False
                continue
            data = path.read_bytes()
            try:
                if face.name.startswith("HindGuntur"):
                    require_coverage(face.name, data, both_ui, "both UI catalogues")
                    require_coverage(face.name, data, set(irv), "the Telugu Bible")
                elif face.name.startswith("NotoSerifTelugu"):
                    require_coverage(face.name, data, set(irv), "the Telugu Bible")
                else:
                    require_coverage(face.name, data, set(web), "the English WEB Bible")
                    require_coverage(face.name, data, english_ui, "the English UI catalogue")
            except SystemExit as error:
                print(f"  {error}")
                ok = False
        print("fonts are current." if ok else "fonts are NOT current.")
        return 0 if ok else 1

    MOBILE_FONTS.mkdir(parents=True, exist_ok=True)
    ADMIN_FONTS.mkdir(parents=True, exist_ok=True)

    total_mobile = 0
    for face in FACES:
        raw = fetch(face.url)
        digest = sha256(raw)
        expected = UPSTREAM_SHA256.get(face.name)
        if expected and digest != expected:
            raise SystemExit(
                f"{face.name}: upstream file changed.\n"
                f"  expected {expected}\n  got      {digest}\n"
                f"  url      {face.url}\n"
                "Refusing to bundle an unverified font. Review the change, then "
                "update UPSTREAM_SHA256 deliberately."
            )
        print(f"{face.name}: {len(raw):,} bytes upstream, sha256 {digest}")

        data = subset(raw) if face.subset else raw
        if face.subset:
            print(f"  subset to {len(data):,} bytes "
                  f"({100 * len(data) / len(raw):.0f}% of upstream)")

        # Verify AFTER any subsetting -- the point is that the bundled
        # bytes cover the content, not that the upstream file did.
        if face.name.startswith("HindGuntur"):
            require_coverage(face.name, data, both_ui, "both UI catalogues")
            require_coverage(face.name, data, set(irv), "the Telugu Bible")
        elif face.name.startswith("NotoSerifTelugu"):
            require_coverage(face.name, data, set(irv), "the Telugu Bible")
        else:
            require_coverage(face.name, data, set(web), "the English WEB Bible")
            require_coverage(face.name, data, english_ui, "the English UI catalogue")

        (MOBILE_FONTS / f"{face.name}.ttf").write_bytes(data)
        total_mobile += len(data)

        if face.admin_woff2:
            woff2 = to_woff2(data)
            (ADMIN_FONTS / f"{face.name}.woff2").write_bytes(woff2)
            print(f"  admin woff2: {len(woff2):,} bytes")

    for filename, url in LICENCES.items():
        text = fetch(url)
        (MOBILE_FONTS / filename).write_bytes(text)
        print(f"{filename}: {len(text):,} bytes")

    print(f"\nmobile font payload: {total_mobile / 1024:.0f} KB across {len(FACES)} faces")
    print("Record the printed sha256 values in UPSTREAM_SHA256.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
