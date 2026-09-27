import glob
import re

html_files = glob.glob('*.html')
imgs = {}

for f in html_files:
    try:
        content = open(f, encoding='utf-8', errors='ignore').read()
    except:
        continue
    found = re.findall(r'''<img[^>]+src=["'](https?://[^"']+)["'][^>]*>''', content)
    for url in found:
        if url not in imgs:
            imgs[url] = []
        imgs[url].append(f)

for url, files in sorted(imgs.items()):
    print(f'{",".join(files)}  |  {url}')
