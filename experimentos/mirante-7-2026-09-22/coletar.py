"""Coleta reproduzível do anúncio público e da galeria declarada em __NEXT_DATA__."""
import json,re,time,hashlib,urllib.request
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageDraw
B=Path(__file__).resolve().parent
URL='https://www.mariaaires.com.br/lancamentos/mirante-7'
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read()
def main():
    start=time.perf_counter(); h=get(URL).decode();(B/'pagina-origem.html').write_text(h,encoding='utf8')
    d=json.loads(re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',h,re.S).group(1))
    a=d['props']['initialProps']['pageProps']['template']['data']['launch']
    (B/'dados-anuncio.json').write_text(json.dumps(a,ensure_ascii=False,indent=2),encoding='utf8')
    urls=list(dict.fromkeys(x['src'] for x in a['images']))
    def photo(item):
        i,url=item;raw=get(url);p=B/'fotos'/f'{i:02d}.jpg';p.parent.mkdir(exist_ok=True);p.write_bytes(raw)
        with Image.open(p) as im:im.verify()
        with Image.open(p) as im:size=im.size
        return dict(url=url,arquivo=str(p.relative_to(B)),bytes=len(raw),dimensoes=size,sha256=hashlib.sha256(raw).hexdigest())
    with ThreadPoolExecutor(max_workers=4) as pool: photos=list(pool.map(photo,enumerate(urls,1)))
    report=dict(url=URL,coletado_em=datetime.now(timezone.utc).isoformat(),segundos=time.perf_counter()-start,fotos=photos)
    (B/'coleta.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    sheet=Image.new('RGB',(1200,450*((len(photos)+2)//3)),'white');draw=ImageDraw.Draw(sheet)
    for i,p in enumerate(photos):
        im=Image.open(B/p['arquivo']);im.thumbnail((390,410));x=i%3*400;y=i//3*450;sheet.paste(im,(x,y));draw.text((x+8,y+418),p['arquivo'],fill='black')
    sheet.save(B/'contato.jpg');print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
