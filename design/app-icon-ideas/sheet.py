#!/usr/bin/env python3
"""Render SVG icons to a contact sheet PNG (large + iOS sizes on light/dark wallpaper).
Usage: python3 -I sheet.py OUT.png a.svg b.svg ...
Also: python3 -I sheet.py --png OUT.png icon.svg   (single 1024px render)"""
import sys, os, base64, subprocess, tempfile, glob
CHROME = sorted(glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')))[-1]
def uri(f): return 'data:image/svg+xml;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
def shot(html, out, w, h):
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as t:
        t.write(html); p = t.name
    subprocess.run([CHROME, '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
                    f'--window-size={w},{h}', f'--screenshot={os.path.abspath(out)}', 'file://' + p],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.unlink(p); print('wrote', out)
args = sys.argv[1:]
if args[0] == '--png':
    out, f = args[1], args[2]
    shot(f'<body style="margin:0"><img src="{uri(f)}" width=1024 height=1024 style="display:block">', out, 1024, 1024)
    sys.exit()
out, files = args[0], args[1:]
n = len(files); col = 300; w = n * col + 20
cells = ''.join(f'<div class=c><img class=b src="{uri(f)}"><div class=n>{os.path.basename(f)}</div>'
                f'<div class="r l">' + ''.join(f'<img style="width:{s}px;height:{s}px;border-radius:{s*.224:.1f}px" src="{uri(f)}">' for s in (120, 60, 40, 29)) + '</div>'
                f'<div class="r d">' + ''.join(f'<img style="width:{s}px;height:{s}px;border-radius:{s*.224:.1f}px" src="{uri(f)}">' for s in (120, 60, 40, 29)) + '</div></div>'
                for f in files)
html = f'''<!doctype html><style>body{{margin:0;padding:10px;background:#fff;font:600 13px system-ui,sans-serif;color:#333;display:flex}}
.c{{width:{col-10}px;margin-right:10px;display:flex;flex-direction:column;align-items:center;gap:6px}}
.b{{width:200px;height:200px;border-radius:44.8px}}.r{{display:flex;gap:6px;align-items:flex-end;padding:8px;border-radius:10px;width:100%;box-sizing:border-box;justify-content:center}}
.r img{{flex:none}}.l{{background:#e6e3dc}}.d{{background:#1b1c1f}}</style>{cells}'''
shot(html, out, w, 560)
