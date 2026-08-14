"""Punch the chroma-green CRT screen out of the shack plate."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parent.parent / "assets" / "shack-plate.png"
OUT = Path(__file__).resolve().parent.parent / "assets" / "shack.png"


def is_key(r: int, g: int, b: int) -> bool:
    return g > 150 and g > r + 55 and g > b + 55 and r < 140 and b < 140


def key_amount(r: int, g: int, b: int) -> float:
    if not is_key(r, g, b):
        return 0.0
    strength = (g - max(r, b)) / 255.0
    return min(1.0, max(0.35, strength * 1.8))


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    pix = img.load()
    seen = bytearray(w * h)
    q = deque([(w // 2, h // 2)])
    min_x, max_x, min_y, max_y = w, 0, h, 0
    count = 0

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        k = y * w + x
        if seen[k]:
            continue
        seen[k] = 1
        r, g, b, a = pix[x, y]
        if not is_key(r, g, b):
            continue
        count += 1
        min_x, max_x = min(min_x, x), max(max_x, x)
        min_y, max_y = min(min_y, y), max(max_y, y)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # Grow the hole a couple of pixels so chroma fringe doesn't glow on the bezel.
    dilated = bytearray(seen)
    for y in range(h):
        for x in range(w):
            if not seen[y * w + x]:
                continue
            for dy in (-2, -1, 0, 1, 2):
                for dx in (-2, -1, 0, 1, 2):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        dilated[ny * w + nx] = 1

    for y in range(h):
        for x in range(w):
            if not dilated[y * w + x]:
                continue
            r, g, b, a = pix[x, y]
            amt = key_amount(r, g, b)
            if amt <= 0 and not seen[y * w + x]:
                # Near-green leftover on the lip.
                if g > 90 and g > r + 20 and g > b + 20:
                    amt = 0.85
                else:
                    continue
            if amt <= 0:
                continue
            pix[x, y] = (12, 16, 14, 0) if seen[y * w + x] else (r, g, b, int(a * (1.0 - amt)))

    img.save(OUT, "PNG")
    print(
        {
            "size": [w, h],
            "pixels": count,
            "frac": {
                "x": round(min_x / w, 5),
                "y": round(min_y / h, 5),
                "w": round((max_x - min_x + 1) / w, 5),
                "h": round((max_y - min_y + 1) / h, 5),
            },
            "out": str(OUT),
        }
    )


if __name__ == "__main__":
    main()
