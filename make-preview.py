#!/usr/bin/env python3
"""Gera dist-preview/Super_Cell_preview.html: a página inteira em UM arquivo (CSS, JS, fontes, fotos e vídeos embutidos).
Uso: npm run build && python3 make-preview.py"""
import base64, mimetypes, pathlib, re
D = pathlib.Path('dist')
MIME = {'.mp4':'video/mp4','.webm':'video/webm','.jpg':'image/jpeg','.woff2':'font/woff2'}
def uri(p):
    p = D / p.lstrip('/')
    return f"data:{MIME[p.suffix]};base64," + base64.b64encode(p.read_bytes()).decode()
html = (D/'index.html').read_text()
css_f = re.search(r'href="(/assets/[^"]+\.css)"', html).group(1)
js_f  = re.search(r'src="(/assets/[^"]+\.js)"', html).group(1)
css = (D/css_f.lstrip('/')).read_text(); js = (D/js_f.lstrip('/')).read_text()
css = re.sub(r'url\((/(?:fonts|video)/[^)]+)\)', lambda m: f'url({uri(m.group(1))})', css)
js = re.sub(r'import"\./style-[^"]+\.js";','',js)
js = re.sub(r'"(/images/[^"]+)"', lambda m: '"' + uri(m.group(1)) + '"', js)
js = re.sub(r'`url\(/video/hero-\$\{(\w+)\}-start\.jpg\)`', lambda m: '`url(${U[%s]})`' % m.group(1), js)
js = re.sub(r'new Image\(\)\.src=`/video/hero-\$\{(\w+)\}-start\.jpg`', lambda m: 'new Image().src=U[%s]' % m.group(1), js)
assert '/video/hero-${' not in js, 'referência de vídeo não substituída'
js = 'const U={m:"%s",d:"%s"};\n' % (uri('/video/hero-m-start.jpg'), uri('/video/hero-d-start.jpg')) + js
html = re.sub(r'<link rel="preload"[^>]*>\n?', '', html)
html = re.sub(r'<link rel="icon"[^>]*>', f'<link rel="icon" type="image/jpeg" href="{uri("/images/logo.jpg")}">', html)
html = re.sub(r'<script type="module"[^>]*src="[^"]+"></script>', '', html)
html = re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
html = re.sub(r'(data-[md]-(?:mp4|webm))="(/video/[^"]+)"', lambda m: f'{m.group(1)}="{uri(m.group(2))}"', html)
html = re.sub(r'src="(/images/[^"]+)"', lambda m: f'src="{uri(m.group(1))}"', html)
html = html.replace('</head>', '<style>' + css + '</style>\n</head>')
html = html.replace('</body>', '<script type="module">' + js.replace('</script', '<\\/script') + '</script>\n</body>')
out = pathlib.Path('dist-preview'); out.mkdir(exist_ok=True)
(out/'Super_Cell_preview.html').write_text(html)
print('ok', round(len(html)/1e6, 1), 'MB')
