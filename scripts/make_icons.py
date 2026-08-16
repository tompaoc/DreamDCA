"""Generate the PWA icon set — pixel art, on-palette, nearest-neighbour upscaled.

The icon is authored at 32x32 logical pixels and scaled by whole multiples, so
the home-screen icon is the same art language as the game. Anti-aliasing would
make it the one blurry thing the user sees before the app even opens.

    python scripts/make_icons.py
"""

from __future__ import annotations

import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "icons")

P = {
    "ink": ["#140F14", "#241A21", "#3A2B33"],
    "grass": ["#2E5227", "#3F6E2E", "#57913A", "#77B24A", "#9CCB63"],
    "foliage": ["#16351F", "#20502C", "#2F6E38", "#478C42"],
    "dirt": ["#3A2410", "#573418", "#7A4C22", "#9C6A34", "#C08F51"],
    "wood": ["#3B2109", "#5B3311", "#7E4A1B", "#A3682B", "#C68F45"],
    "gold": ["#5C3405", "#96600C", "#D2951A", "#F5C13C", "#FFE79A"],
    "accent": ["#701B2E", "#C4383F", "#EE8A55"],
    "water": ["#0E2E52", "#17497F", "#2470B4", "#3E9BD8", "#8CD3EE"],
}


def rgb(h: str) -> tuple[int, int, int, int]:
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


def draw_cottage(px, ox: int, oy: int) -> None:
    """A 24x22 symmetric cottage, drawn on an explicit pixel grid so it stays
    legible at 48x48 (the smallest home-screen size Android actually shows).

    The roof's left edge at each row is computed once (`roof_left`) and every
    other roof feature — the lit-ridge highlight, the chimney base — reads
    from that same function, so nothing can end up floating off the slope
    the way a second, independently-guessed x coordinate did before.
    """
    r = lambda x, y, w, h, c: [  # noqa: E731
        px.__setitem__((ox + x + i, oy + y + j), rgb(c))
        for i in range(w)
        for j in range(h)
        if 0 <= ox + x + i < 32 and 0 <= oy + y + j < 32
    ]

    apex = 12  # local x of the roof peak
    rows = 8  # roof rows, local y = 4..11

    def roof_left(row_i: int) -> int:
        return apex - (row_i + 1)

    # Chimney: sits ON the left slope at row 2, its base flush with the roof
    # pixel directly below it, so it can never read as a disconnected pole.
    chim_row = 2
    chim_x = roof_left(chim_row) + 1
    chim_top = 4 + chim_row - 5
    r(chim_x, chim_top, 2, 5 + 1, P["ink"][1])
    r(chim_x, chim_top, 1, 5 + 1, P["ink"][2])
    r(chim_x - 1, chim_top - 1, 4, 1, P["ink"][0])  # chimney cap, wider than the flue

    # Symmetric gable roof, widening by 1px per row on each side.
    for i in range(rows):
        half = i + 1
        left = roof_left(i)
        r(left, 4 + i, half * 2, 1, P["accent"][1] if i < rows - 2 else P["accent"][0])
        r(left, 4 + i, 1, 1, P["accent"][2])  # top-left lit pixel, ON the slope itself
    r(1, 12, 22, 1, P["ink"][1])  # hard 1px eave shadow

    # Walls.
    r(3, 13, 18, 10, P["wood"][2])
    r(3, 13, 1, 10, P["wood"][3])  # lit left edge
    r(20, 13, 1, 10, P["wood"][0])  # shaded right edge

    # Door, centred.
    r(10, 17, 4, 6, P["wood"][0])
    r(12, 19, 1, 1, P["gold"][3])  # handle

    # Windows, symmetric either side of the door.
    r(6, 16, 3, 3, P["gold"][2])
    r(15, 16, 3, 3, P["gold"][2])
    r(6, 16, 3, 1, P["gold"][4])
    r(15, 16, 3, 1, P["gold"][4])


def build_base() -> Image.Image:
    """The 32x32 master. Everything else is an integer upscale of this."""
    img = Image.new("RGBA", (32, 32), rgb(P["grass"][1]))
    px = img.load()

    # Ground texture: a couple of darker tufts so it is not a flat field.
    for x, y in [(2, 26), (7, 29), (24, 27), (29, 24), (13, 30), (19, 28)]:
        px[x, y] = rgb(P["grass"][0])
    for x, y in [(5, 24), (26, 30), (11, 27)]:
        px[x, y] = rgb(P["grass"][3])

    # Dirt path leading to the door.
    for y in range(23, 32):
        for x in range(14, 18):
            px[x, y] = rgb(P["dirt"][2])
        px[14, y] = rgb(P["dirt"][3])

    draw_cottage(px, 3, 3)

    # Gold coin, bottom-right — the one signal this is a savings app, not a
    # generic cottage icon. Kept clear of the roofline instead of overlapping it.
    coin = [
        "..111..",
        ".11111.",
        "1112111",
        "1121211",
        "1112111",
        ".11111.",
        "..111..",
    ]
    for j, row in enumerate(coin):
        for i, ch in enumerate(row):
            if ch == ".":
                continue
            x, y = 22 + i, 22 + j
            if 0 <= x < 32 and 0 <= y < 32:
                px[x, y] = rgb(P["gold"][3] if ch == "1" else P["gold"][0])

    return img


def save(img: Image.Image, size: int, name: str, pad_ratio: float = 0.0) -> None:
    """Upscale by a whole multiple, then pad if the platform needs a safe zone."""
    inner = round(size * (1 - pad_ratio))
    factor = max(1, inner // img.width)
    scaled = img.resize((img.width * factor, img.height * factor), Image.NEAREST)

    canvas = Image.new("RGBA", (size, size), rgb(P["grass"][1]))
    off = ((size - scaled.width) // 2, (size - scaled.height) // 2)
    canvas.paste(scaled, off)
    canvas.save(os.path.join(OUT, name))
    print(f"  {name}  {size}x{size}  (x{factor} of 32px master)")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    base = build_base()
    save(base, 192, "icon-192.png")
    save(base, 512, "icon-512.png")
    # Maskable icons are cropped to a circle by Android; 20% padding keeps the
    # cottage inside the safe zone instead of losing its roof.
    save(base, 512, "icon-maskable-512.png", pad_ratio=0.2)
    save(base, 180, "apple-touch-icon.png")
    # Browser-tab favicon: the 32px master at 1x, no upscale — a real pixel icon
    # rather than the browser's own (usually blurry) downscale of a bigger one.
    base.save(os.path.join(OUT, "favicon-32.png"))
    print(f"  favicon-32.png  32x32  (native, unscaled)")
    print(f"wrote icons to {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
