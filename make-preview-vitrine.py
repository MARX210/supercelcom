#!/usr/bin/env python3
"""Gera dist-preview/Vitrine_preview.html (vitrine em UM arquivo, com dados de exemplo).
Uso: npm run build && python3 make-preview-vitrine.py"""
import base64, json, pathlib, re
D = pathlib.Path('dist')
MIME = {'.jpg':'image/jpeg','.woff2':'font/woff2','.mp4':'video/mp4','.webm':'video/webm'}
def uri(p):
    p = D / p.lstrip('/')
    return f"data:{MIME[p.suffix]};base64," + base64.b64encode(p.read_bytes()).decode()
html = (D/'vitrine.html').read_text()
css = ''.join((D/h.lstrip('/')).read_text() for h in re.findall(r'href="(/assets/[^"]+\.css)"', html))
js = (D/re.search(r'src="(/assets/vitrine-[^"]+\.js)"', html).group(1).lstrip('/')).read_text()
js = re.sub(r'import"\./style-[^"]+\.js";', '', js)
css = re.sub(r'url\((/(?:fonts|video)/[^)]+)\)', lambda m: f'url({uri(m.group(1))})', css)
js = re.sub(r'"(/images/[^"]+)"', lambda m: '"' + uri(m.group(1)) + '"', js)
data = json.loads(pathlib.Path('src/produtos-exemplo.json').read_text())
for p in data['produtos']: p['fotos'] = [uri(f) for f in p['fotos']]
html = re.sub(r'<link rel="(?:modulepreload|stylesheet)"[^>]*>\n?', '', html)
html = re.sub(r'<link rel="icon"[^>]*>', f'<link rel="icon" type="image/jpeg" href="{uri("/images/logo.jpg")}">', html)
html = re.sub(r'<script type="module"[^>]*src="[^"]+"></script>', '', html)
html = re.sub(r'src="(/images/[^"]+)"', lambda m: f'src="{uri(m.group(1))}"', html)
html = html.replace('</head>', '<style>' + css + '</style>\n</head>')
html = html.replace('</body>', '<script>window.__PRODUTOS__=' + json.dumps(data) + '</script>\n<script type="module">' + js.replace('</script', '<\\/script') + '</script>\n</body>')
out = pathlib.Path('dist-preview'); out.mkdir(exist_ok=True)
(out/'Vitrine_preview.html').write_text(html)
print('ok', round(len(html)/1e6, 2), 'MB')
