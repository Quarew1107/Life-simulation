"""Art import: turns ChatGPT's large pixel-art sheets into small, clean game sprites.

Usage:  python -I tools/art-import.py <manifest.json> <folder with the PNGs> <output folder> [--palette tools/art/palette.json] [--make-palette]

For every sheet in the manifest it:
  1. removes the flat magenta background (and its pinkish fringe),
  2. finds the items and matches them, row by row and left to right, to the manifest's order,
  3. shrinks each item to game pixels (block majority, so 1-pixel lines survive),
  4. snaps colours to the game palette ("art" items) or to the mask colours ("mask" items, people that the game
     repaints per person),
  5. packs everything into one sheet with a frame table, writes it as a .js file (image embedded as data, so it
     works from file://), and writes a text report plus preview pictures.
Nothing here touches the game; the output folder is chosen by the caller.
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

# Mask colours (TECH_REVIEW D3): part -> [light, mid, dark]. 'line' and 'white' are fixed colours.
MASK = {
    'skin': ['#FF8080', '#FF0000', '#990000'],
    'hair': ['#80FF80', '#00CC00', '#006600'],
    'top': ['#8080FF', '#0000FF', '#000099'],
    'bottom': ['#FFFF80', '#E0E000', '#808000'],
    'shoes': ['#00FFFF', '#00FFFF', '#008080'],
    'head': ['#FFC080', '#FF8000', '#994C00'],
    'line': ['#3B2A1D'],
    'white': ['#F4F1E8'],
}
OUTLINE = '#3B2A1D'


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgbhex(c):
    return '#%02X%02X%02X' % tuple(int(v) for v in c[:3])


def background(a):
    """True where a pixel is the magenta background or its fringe."""
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (r - g > 70) & (b - g > 70) & (np.abs(r - b) < 80)


def nearest(pix, pal):
    """Index of the nearest palette colour for each pixel (weighted RGB distance)."""
    w = np.array([0.30, 0.59, 0.11]) * 3
    out = np.empty(len(pix), dtype=np.int32)
    for s in range(0, len(pix), 200000):
        d = (((pix[s:s + 200000, None, :] - pal[None, :, :]) ** 2) * w).sum(-1)
        out[s:s + 200000] = d.argmin(1)
    return out


def find_items(bg):
    """Bounding boxes of the items on a sheet: connected non-background areas, small gaps closed."""
    solid = ~bg
    small = ndimage.binary_closing(solid, structure=np.ones((9, 9)))
    lab, n = ndimage.label(small)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sl is None: continue
        ys, xs = sl
        if (ys.stop - ys.start) * (xs.stop - xs.start) < 400: continue  # specks
        boxes.append([xs.start, ys.start, xs.stop, ys.stop])
    return merge_bits(boxes)


def merge_bits(boxes):
    """Loose bits (steam puffs, sparkles, motion marks) join the nearest real item: anything smaller than a
    quarter of the typical item's area is merged into the closest bigger box."""
    if len(boxes) < 3: return boxes
    area = lambda b: (b[2] - b[0]) * (b[3] - b[1])
    med = float(np.median([area(b) for b in boxes]))
    big = [b for b in boxes if area(b) >= med * 0.25]
    for b in boxes:
        if area(b) >= med * 0.25: continue
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        gap = lambda o: max(o[0] - cx, 0, cx - o[2]) + max(o[1] - cy, 0, cy - o[3])
        t = min(big, key=gap)
        t[0], t[1], t[2], t[3] = min(t[0], b[0]), min(t[1], b[1]), max(t[2], b[2]), max(t[3], b[3])
    return big


def runs(solid_1d):
    """Runs of True in a 1-D mask: [(start, stop)]."""
    out, start = [], None
    for i, v in enumerate(solid_1d):
        if v and start is None: start = i
        if not v and start is not None: out.append([start, i]); start = None
    if start is not None: out.append([start, len(solid_1d)])
    return out


def merge_to(rs, n):
    """Merge neighbouring runs across the smallest gaps until there are n."""
    rs = [list(r) for r in rs]
    while len(rs) > n:
        k = min(range(len(rs) - 1), key=lambda i: rs[i + 1][0] - rs[i][1])
        rs[k][1] = rs[k + 1][1]; del rs[k + 1]
    return rs


def cut_bands(bg, want):
    """Cut by empty lines: rows of items, then items within a row; the smallest gaps are merged until the
    counts match the list (for touching pictures and effects made of many loose pieces)."""
    solid = ~bg
    rows = merge_to(runs(solid.any(1)), len(want))
    if len(rows) != len(want): return None
    found = []
    for (y0, y1), n in zip(rows, [len(r) for r in want]):
        cols = runs(solid[y0:y1].any(0))
        cols = [c for c in cols if c[1] - c[0] > 2] or cols
        cols = merge_to(cols, n)
        if len(cols) != n: return None
        row = []
        for x0, x1 in cols:
            ys = np.where(solid[y0:y1, x0:x1].any(1))[0]
            row.append([x0, y0 + ys[0], x1, y0 + ys[-1] + 1])
        found.append(row)
    return found


def rows_of(boxes):
    """Group boxes into rows (vertical overlap), each row sorted left to right, rows top to bottom."""
    boxes = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    rows = []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        for r in rows:
            top = min(x[1] for x in r); bot = max(x[3] for x in r)
            if top <= cy <= bot: r.append(b); break
        else: rows.append([b])
    return [sorted(r, key=lambda b: b[0]) for r in rows]


def phase(img, alpha, step, axis):
    """Where the artist's pixel grid starts: the offset whose grid lines sit on the most colour changes."""
    a = img.astype(int) * alpha[..., None]
    d = np.abs(np.diff(a, axis=axis)).sum(-1).sum(1 - axis)  # change between neighbouring columns (or rows)
    n = len(d)
    best, bo = -1, 0.0
    for k in range(int(step * 4)):
        o = k / 4
        pos = np.round(np.arange(o - 1, n, step)).astype(int)
        pos = pos[(pos >= 0) & (pos < n)]
        s = d[pos].sum()
        if s > best: best, bo = s, o
    return bo


def shrink(idx, alpha, tw, th, inner=0.6, ox=0.0, oy=0.0):
    """Block majority: each game pixel takes the commonest palette index in the middle of its source block.
    ox/oy shift the blocks onto the artist's own pixel grid."""
    H, W = idx.shape
    out = np.full((th, tw), -1, dtype=np.int32)
    sy, sx = (H - oy) / th, (W - ox) / tw
    m = (1 - inner) / 2
    for j in range(th):
        y0 = int(round(oy + (j + m) * sy)); y1 = max(y0 + 1, int(round(oy + (j + 1 - m) * sy)))
        for i in range(tw):
            x0 = int(round(ox + (i + m) * sx)); x1 = max(x0 + 1, int(round(ox + (i + 1 - m) * sx)))
            a = alpha[y0:y1, x0:x1]
            if a.size == 0 or a.mean() < 0.5: continue
            v = idx[y0:y1, x0:x1][a]
            out[j, i] = np.bincount(v).argmax()
    return out


def fit_size(cw, ch, tw, th, scale=None):
    """Target size: with a sheet scale, keep the artist's proportions; otherwise fit inside the target box."""
    if scale: return max(1, round(cw / scale)), max(1, round(ch / scale))
    k = max(cw / tw, ch / th)
    return max(1, round(cw / k)), max(1, round(ch / k))


def build_palette(images, n=63):
    pix = np.concatenate(images)
    img = Image.fromarray(pix[None, :, :].astype(np.uint8), 'RGB')
    q = img.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:n * 3]).reshape(-1, 3)
    cols = sorted({rgbhex(c) for c in pal} | {OUTLINE}, key=lambda h: sum(hexrgb(h)))
    return cols


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    man_path, src_dir, out_dir = args[:3]
    flags = sys.argv[1:]
    pal_path = flags[flags.index('--palette') + 1] if '--palette' in flags else os.path.join(os.path.dirname(man_path), 'palette.json')
    man = json.load(open(man_path, encoding='utf-8'))
    os.makedirs(out_dir, exist_ok=True)
    report, items, art_pixels = [], [], []
    mask_cols = [(part, k, hexrgb(c)) for part, cs in MASK.items() for k, c in enumerate(cs)]
    mask_pal = np.array([c for _, _, c in mask_cols], dtype=float)

    # Pass 1: find and crop every item.
    for sh in man['sheets']:
        im = np.array(Image.open(os.path.join(src_dir, sh['file'])).convert('RGB'))
        bg = background(im)
        want = sh['rows']
        if sh.get('boxes'):  # the artist's own boxes (x, y, w, h), in list order: exact cuts, nothing guessed
            it_ = iter(sh['boxes']); found = [[(lambda q: [q[0], q[1], q[0] + q[2], q[1] + q[3]])(next(it_)) for _ in r] for r in want]
        else: found = cut_bands(bg, want) if sh.get('cut') == 'bands' else rows_of(find_items(bg))
        if found is None: found = []
        report.append(f"{sh['file']}: {im.shape[1]}x{im.shape[0]}, rows found {len(found)} (wanted {len(want)}), items per row found {[len(r) for r in found]} (wanted {[len(r) for r in want]})")
        if [len(r) for r in found] != [len(r) for r in want]:
            report.append('  !! the items do not match the list; nothing from this sheet is used'); continue
        for r_want, r_found in zip(want, found):
            for spec, (x0, y0, x1, y1) in zip(r_want, r_found):
                crop, cbg = im[y0:y1, x0:x1], bg[y0:y1, x0:x1]
                items.append(dict(spec=spec, crop=crop, alpha=~cbg, box=(x0, y0, x1, y1), sheet=sh['file'], px=sh.get('px'), remap=sh.get('remap')))
                if spec['type'] == 'art': art_pixels.append(crop[~cbg].reshape(-1, 3))

    # The palette: fixed once made (tools/art/palette.json); the pilot makes it from the furniture.
    if '--make-palette' in flags or not os.path.exists(pal_path):
        cols = build_palette(art_pixels)
        json.dump({'note': 'Game art palette (made from the P1A pilot furniture)', 'colours': cols}, open(pal_path, 'w'), indent=1)
        report.append(f'palette: made {len(cols)} colours -> {pal_path}')
    cols = json.load(open(pal_path))['colours']
    pal = np.array([hexrgb(c) for c in cols], dtype=float)
    # "colours": "own" (manifest): pictures keep their own colours instead of snapping to the game palette
    # (the town's buildings: blue windows, painted walls; ChatGPT already limits each sheet's colours).
    own = man.get('colours') == 'own'
    if own:
        allp = np.concatenate(art_pixels).astype(np.int64) if art_pixels else np.zeros((0, 3), np.int64)
        packed = np.unique((allp[:, 0] << 16) | (allp[:, 1] << 8) | allp[:, 2])
        base = len(cols)
        cols = cols + ['#%06X' % int(v) for v in packed]
        report.append(f'colours: the pictures keep their own {len(packed)} colours')

    # One pixel scale for the furniture of a sheet (the artist draws everything at one scale).
    scales = {}
    for sh in man['sheets']:
        art = [it for it in items if it['spec']['type'] == 'art' and it['sheet'] == sh['file']]
        ratios = [((it['box'][2] - it['box'][0]) / it['spec']['w'] + (it['box'][3] - it['box'][1]) / it['spec']['h']) / 2 for it in art]
        if ratios:
            scales[sh['file']] = float(np.median(ratios))
            report.append(f"{sh['file']}: scale {scales[sh['file']]:.2f} source px per game px")

    # Pass 2: shrink and snap.
    for it in items:
        s, crop, alpha = it['spec'], it['crop'], it['alpha']
        if s.get('fit') == 'cover':  # crop the middle to the target shape (backdrops: a little ceiling and floor go)
            ch, cw = alpha.shape
            if cw / ch < s['w'] / s['h']:
                nh = round(cw * s['h'] / s['w']); y0 = (ch - nh) // 2; crop, alpha = crop[y0:y0 + nh], alpha[y0:y0 + nh]
            else:
                nw = round(ch * s['w'] / s['h']); x0 = (cw - nw) // 2; crop, alpha = crop[:, x0:x0 + nw], alpha[:, x0:x0 + nw]
            it['crop'], it['alpha'] = crop, alpha
        ch, cw = alpha.shape
        flat = crop.reshape(-1, 3).astype(float)
        if s['type'] == 'art' and own:
            c = crop.reshape(-1, 3).astype(np.int64)
            idx = (base + np.minimum(np.searchsorted(packed, (c[:, 0] << 16) | (c[:, 1] << 8) | c[:, 2]), len(packed) - 1)).reshape(ch, cw)
            tw, th = fit_size(cw, ch, s['w'], s['h'], None if man.get('fit') == 'box' else scales.get(it['sheet']))
        elif s['type'] == 'art':
            idx = nearest(flat, pal).reshape(ch, cw)
            tw, th = fit_size(cw, ch, s['w'], s['h'], None if man.get('fit') == 'box' else scales.get(it['sheet']))
        else:
            idx = nearest(flat, mask_pal).reshape(ch, cw)
            for src, dst in (it.get('remap') or {}).items():  # e.g. skin drawn in natural colours: orange -> skin
                si = [k for k, (part, _, _) in enumerate(mask_cols) if part == src]
                di = [k for k, (part, _, _) in enumerate(mask_cols) if part == dst]
                for a_, b_ in zip(si, di): idx[idx == a_] = b_
            tw, th = fit_size(cw, ch, s['w'], s['h'])
        if it.get('px'):  # the sheet's own pixel size is known: keep the artist's exact size
            tw, th = max(1, round(cw / it['px'])), max(1, round(ch / it['px']))
            ox, oy = phase(crop, alpha, it['px'], 1), phase(crop, alpha, it['px'], 0)
            tw, th = max(1, round((cw - ox) / it['px'])), max(1, round((ch - oy) / it['px']))
            small = shrink(idx, alpha, tw, th, 0.5, ox, oy)
        elif s.get('fit') == 'stretch':  # pieces that must line up exactly (wall strips, doors): stretched to size
            tw, th = s['w'], s['h']
            small = shrink(idx, alpha, tw, th, 0.5)
        else:
            step = (cw / tw + ch / th) / 2
            ox, oy = phase(crop, alpha, step, 1), phase(crop, alpha, step, 0)
            tw, th = max(1, round((cw - ox) / step)), max(1, round((ch - oy) / step))
            small = shrink(idx, alpha, tw, th, 0.5, ox, oy)
        it['small'], it['size'] = small, (tw, th)
        dev = abs(th - s['h']) / s['h'] if s['type'] == 'mask' else max(abs(tw - s['w']) / s['w'], abs(th - s['h']) / s['h'])  # people: height counts (the frame is wider than the body)
        line = f"  {s['id']:<24} wanted {s['w']}x{s['h']}  got {tw}x{th}  {'OK' if dev <= 0.15 else 'SIZE OFF by %d%%' % round(dev * 100)}"
        if s['type'] == 'mask':
            parts = {mask_cols[v][0] for v in small[small >= 0].ravel()}
            miss = [p for p in s.get('parts', ['skin', 'hair', 'top', 'bottom', 'shoes']) if p not in parts]
            eyes = face_has_eyes(small, mask_cols)
            line += f"  parts {'all found' if not miss else 'MISSING ' + ','.join(miss)}  eyes {'yes' if eyes else 'NO'}"
        report.append(line)

    write_outputs(items, cols, mask_cols, out_dir, man['batch'], report)
    open(os.path.join(out_dir, f"report-{man['batch']}.txt"), 'w', encoding='utf-8').write('\n'.join(report) + '\n')
    print('\n'.join(report))


def face_has_eyes(small, mask_cols):
    """Eyes = dark 'line' pixels surrounded by skin in the upper half of the sprite."""
    th = small.shape[0]
    for y in range(1, th // 2):
        for x in range(1, small.shape[1] - 1):
            v = small[y, x]
            if v >= 0 and mask_cols[v][0] == 'line':
                l, r = small[y, x - 1], small[y, x + 1]
                if l >= 0 and r >= 0 and mask_cols[l][0] == 'skin' and mask_cols[r][0] == 'skin': return True
    return False


def to_rgba(small, colours):
    th, tw = small.shape
    out = np.zeros((th, tw, 4), dtype=np.uint8)
    for j in range(th):
        for i in range(tw):
            v = small[j, i]
            if v >= 0: out[j, i] = (*colours[v], 255)
    return out


def shades(base):
    c = np.array(hexrgb(base), dtype=float)
    return [tuple(np.minimum(255, c + (255 - c) * 0.35).astype(int)), tuple(c.astype(int)), tuple((c * 0.62).astype(int))]


def paint(small, mask_cols, look):
    """Repaint a mask sprite with one person's colours (what the game will do per person)."""
    cols = []
    for part, k, rgb in mask_cols:
        if part in look: cols.append(shades(look[part])[min(k, 2)])
        else: cols.append(rgb)
    return to_rgba(small, cols)


LOOKS = [
    dict(skin='#D9A066', hair='#2B1D14', top='#3E8E7E', bottom='#4A4E69', shoes='#2B2B2B', head='#C9A0DC'),
    dict(skin='#F1C9A5', hair='#1E1A18', top='#E07A5F', bottom='#3D405B', shoes='#5B3A1D', head='#E9C46A'),
    dict(skin='#8D5A3B', hair='#141010', top='#F2CC8F', bottom='#264653', shoes='#2B2B2B', head='#81B29A'),
]


def write_outputs(items, cols, mask_cols, out_dir, batch, report):
    pal_rgb = [hexrgb(c) for c in cols]
    mask_rgb = [c for _, _, c in mask_cols]
    sprites = []
    for it in items:
        rgba = to_rgba(it['small'], pal_rgb if it['spec']['type'] == 'art' else mask_rgb)
        it['rgba'] = rgba
        if not it['spec'].get('skip'): sprites.append((it['spec']['id'], rgba))  # 'skip': cut and previewed, not packed

    # Packed sheet + frame table (id: [x, y, w, h, anchorX, anchorY]; anchor = middle of the bottom edge).
    W, x, y, rowh, frames = 256, 1, 1, 0, {}
    for sid, a in sprites:
        h, w = a.shape[:2]
        if x + w + 1 > W: x, y, rowh = 1, y + rowh + 1, 0
        frames[sid] = [x, y, w, h, w // 2, h]
        x += w + 1; rowh = max(rowh, h)
    sheet = np.zeros((y + rowh + 1, W, 4), dtype=np.uint8)
    for sid, a in sprites:
        fx, fy, w, h = frames[sid][:4]
        sheet[fy:fy + h, fx:fx + w] = a
    img = Image.fromarray(sheet, 'RGBA')
    img.save(os.path.join(out_dir, f'atlas-{batch}.png'))
    buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
    data = base64.b64encode(buf.getvalue()).decode()
    js = f"// Made by tools/art-import.py (batch {batch}). Do not edit by hand.\n(function (LES) {{\n  (LES.ArtPacks = LES.ArtPacks || []).push({{ id: '{batch}', src: 'data:image/png;base64,{data}',\n    frames: {json.dumps(frames)} }});\n}})(window.LES = window.LES || {{}});\n"
    open(os.path.join(out_dir, f'art-{batch}.js'), 'w').write(js)
    report.append(f'packed sheet {W}x{sheet.shape[0]}, {len(buf.getvalue())} bytes PNG, {len(js)} bytes as .js')

    preview_items(items, mask_cols, out_dir, batch)
    preview_room(items, mask_cols, out_dir, batch)


def preview_items(items, mask_cols, out_dir, batch, k=4):
    """Each item: the artist's picture (left) and the cleaned game sprite at 4x (right); people also repainted."""
    rows = []
    for it in items:
        cells = [it['rgba']]
        if it['spec']['type'] == 'mask': cells += [paint(it['small'], mask_cols, lk) for lk in LOOKS]
        rows.append((it, cells))
    H = sum(max(c.shape[0] for c in cells) * k + 12 for _, cells in rows) + 10
    canvas = Image.new('RGBA', (900, H), (231, 222, 205, 255))
    d = ImageDraw.Draw(canvas)
    y = 6
    for it, cells in rows:
        h = max(c.shape[0] for c in cells) * k
        src = Image.fromarray(it['crop']).convert('RGBA')
        src.putalpha(Image.fromarray((it['alpha'] * 255).astype(np.uint8)))
        src.thumbnail((h * 2, h))
        canvas.alpha_composite(src, (6, y))
        x = 6 + h * 2 + 14
        for c in cells:
            big = Image.fromarray(c, 'RGBA').resize((c.shape[1] * k, c.shape[0] * k), Image.NEAREST)
            canvas.alpha_composite(big, (x, y)); x += big.width + 10
        d.text((x + 6, y + 4), it['spec']['id'], fill=(40, 30, 20, 255))
        y += h + 12
    canvas.save(os.path.join(out_dir, f'preview-{batch}-items.png'))


def preview_room(items, mask_cols, out_dir, batch, k=4):
    """A rough 12x9-tile test room using the cleaned sprites (floor and wall drawn plainly by this tool)."""
    by = {it['spec']['id']: it for it in items}
    W, H = 192, 144
    room = np.zeros((H, W, 4), dtype=np.uint8)
    room[:, :] = (168, 108, 62, 255)
    for yy in range(32, H):
        if (yy - 32) % 8 == 0: room[yy, :] = (138, 86, 48, 255)
        else:
            off = 24 if ((yy - 32) // 8) % 2 else 0
            for xx in range(off, W, 48): room[yy, xx] = (138, 86, 48, 255)
    room[:32, :] = (122, 74, 42, 255)
    for xx in range(0, W, 6): room[:32, xx] = (98, 58, 32, 255)
    room[30:32, :] = (80, 50, 30, 255)
    img = Image.fromarray(room, 'RGBA')

    def put(sid, x, y, look=None):
        it = by.get(sid)
        if not it: return
        a = paint(it['small'], mask_cols, look) if look else it['rgba']
        img.alpha_composite(Image.fromarray(a, 'RGBA'), (x, y - a.shape[0]))  # y = bottom (feet / floor line)

    put('home.bed_double', 6, 66)
    put('home.stove_counter', 104, 44)
    put('home.fridge', 140, 44)
    put('home.fan_standing', 170, 60)
    put('home.table_dining', 120, 104)
    put('home.sofa_rattan', 40, 130)
    put('person.child.sleep_head', 16, 46, LOOKS[2])
    put('person.adult.stand', 114, 60, LOOKS[0])
    put('person.adult.sit', 104, 112, LOOKS[1])
    put('person.child.stand', 96, 132, LOOKS[1])
    put('person.child.sit', 150, 112, LOOKS[2])
    img.resize((W * k, H * k), Image.NEAREST).save(os.path.join(out_dir, f'preview-{batch}-room.png'))


if __name__ == '__main__':
    main()
