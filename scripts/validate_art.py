"""Art CI gate — ASSET_SPEC.md §4.

Every rule here failed on the AI-generated sheets that were rejected in AUDIT.md §1
(max alpha 254, 62k-650k unique colours). This script is what stops that class of
asset from ever reaching the repo again.

    python scripts/validate_art.py            # check art/**/*.png
    python scripts/validate_art.py --self-test # prove the validator actually fails

Exit code 1 on any violation.
"""

from __future__ import annotations

import argparse
import glob
import os
import sys
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GPL = os.path.join(ROOT, "art", "dreamdca-48.gpl")
EXPECTED_PALETTE_SIZE = 48


def load_palette(path: str = GPL) -> set[tuple[int, int, int]]:
    """Parse a GIMP .gpl. The palette is the contract; a short read is a hard error."""
    colours: set[tuple[int, int, int]] = set()
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith(("GIMP", "Name:", "Columns:")):
                continue
            parts = line.split()
            if len(parts) < 3:
                continue
            colours.add(tuple(int(p) for p in parts[:3]))  # type: ignore[arg-type]
    if len(colours) != EXPECTED_PALETTE_SIZE:
        raise SystemExit(
            f"FATAL {path}: parsed {len(colours)} colours, expected {EXPECTED_PALETTE_SIZE}"
        )
    return colours


def check_png(path: str, palette: set[tuple[int, int, int]]) -> list[str]:
    """Return a list of violations for one PNG. Empty list means it passes."""
    problems: list[str] = []
    a = np.array(Image.open(path).convert("RGBA"))
    alpha = a[..., 3]

    # Rule 1 — alpha is binary. Partial alpha renders as a grey halo in-engine.
    partial = int(((alpha > 0) & (alpha < 255)).sum())
    if partial:
        problems.append(f"{partial} partial-alpha pixels (alpha must be 0 or 255)")

    # Rule 2 — palette-locked. Only fully opaque pixels carry colour.
    opaque = a[..., :3][alpha == 255]
    if opaque.size:
        used = {tuple(int(v) for v in c) for c in np.unique(opaque.reshape(-1, 3), axis=0)}
        off = used - palette
        if off:
            sample = ", ".join("#%02X%02X%02X" % c for c in sorted(off)[:4])
            problems.append(f"{len(off)} off-palette colours (e.g. {sample})")

    return problems


def _self_test(palette: set[tuple[int, int, int]]) -> int:
    """The sign-off checklist requires proof the validator fails on a bad PNG."""
    with tempfile.TemporaryDirectory() as tmp:
        halo = os.path.join(tmp, "halo.png")
        Image.new("RGBA", (4, 4), (46, 82, 39, 128)).save(halo)  # on-palette, half alpha
        halo_problems = check_png(halo, palette)

        offpal = os.path.join(tmp, "offpal.png")
        Image.new("RGBA", (4, 4), (255, 0, 255, 255)).save(offpal)  # opaque magenta
        offpal_problems = check_png(offpal, palette)

        good = os.path.join(tmp, "good.png")
        Image.new("RGBA", (4, 4), (46, 82, 39, 255)).save(good)  # grass[0], opaque
        clean = check_png(good, palette)

    ok = (
        len(halo_problems) == 1
        and "partial-alpha" in halo_problems[0]
        and len(offpal_problems) == 1
        and "off-palette" in offpal_problems[0]
        and not clean
    )
    print(f"self-test halo.png   -> {halo_problems}")
    print(f"self-test offpal.png -> {offpal_problems}")
    print(f"self-test good.png   -> {clean}")
    print("SELF-TEST PASS" if ok else "SELF-TEST FAIL")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--dir", default=os.path.join(ROOT, "art"))
    args = ap.parse_args()

    palette = load_palette()
    if args.self_test:
        return _self_test(palette)

    files = sorted(glob.glob(os.path.join(args.dir, "**", "*.png"), recursive=True))
    # palette.png is the palette swatch sheet itself, not an asset.
    files = [f for f in files if os.path.basename(f) != "palette.png"]
    if not files:
        print(f"no PNGs under {args.dir} yet — nothing to validate")
        return 0

    failed = 0
    for f in files:
        problems = check_png(f, palette)
        rel = os.path.relpath(f, ROOT)
        if problems:
            failed += 1
            for p in problems:
                print(f"FAIL {rel}: {p}")
        else:
            print(f"ok   {rel}")

    print(f"\n{len(files) - failed}/{len(files)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
