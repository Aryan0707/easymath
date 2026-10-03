"""Draws the EasyMath ÷ icon as PNGs using only the standard library."""
import struct, zlib

def png(size, path):
    s = size / 512.0
    bg, fg = (47, 99, 235), (255, 255, 255)      # #2F63EB, the app accent (--accent in styles.css)
    def inside(x, y):
        # bar: rounded rectangle 146..366 x 238..274; dots: circles at (256,162) and (256,350), r=30 (in 512 space)
        X, Y = x / s, y / s
        if 146 <= X <= 366 and 238 <= Y <= 274:
            r = 18; cx = min(max(X, 146 + r), 366 - r)
            return (X - cx) ** 2 + (Y - 256) ** 2 <= r * r
        for cy in (162, 350):
            if (X - 256) ** 2 + (Y - cy) ** 2 <= 900: return True
        return False
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            # 4x4 supersampling for smooth edges
            q = (.125, .375, .625, .875)
            n = sum(inside(x + dx, y + dy) for dx in q for dy in q)
            t = n / 16
            row += bytes(int(bg[i] * (1 - t) + fg[i] * t) for i in range(3))
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

for n in (180, 192, 512): png(n, f"icon-{n}.png")
print("ok")
