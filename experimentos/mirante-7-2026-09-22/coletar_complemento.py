"""Repete a coleta da galeria pública complementar identificada pela pesquisa."""
import json,re,time,urllib.request,hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
B=Path(__file__).resolve().parent
URL='https://www.iplano.com.br/lancamentos/mirante-7'
def main():
 t=time.perf_counter();h=urllib.request.urlopen(URL,timeout=30).read().decode()
 (B/'iplano.html').write_text(h,encoding='utf8')
 d=json.loads(re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',h,re.S).group(1))
 a=d['props']['initialProps']['pageProps']['template']['data']['launch']
 (B/'iplano.json').write_text(json.dumps(a,ensure_ascii=False,indent=2),encoding='utf8')
 p=B/'fotos-iplano';p.mkdir(exist_ok=True)
 def one(v):
  i,x=v;raw=urllib.request.urlopen(x['src'],timeout=30).read();f=p/f'{i:02d}.jpg';f.write_bytes(raw)
  with Image.open(f) as im:im.verify()
  return dict(arquivo=f'fotos-iplano/{i:02d}.jpg',sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),**x)
 with ThreadPoolExecutor(max_workers=4) as pool:r=list(pool.map(one,enumerate(a['images'],1)))
 # Preserva a medição original e grava a nova execução em arquivo separado.
 (B/'coleta-iplano-repeticao.json').write_text(json.dumps(dict(url=URL,segundos=time.perf_counter()-t,fotos=r),ensure_ascii=False,indent=2),encoding='utf8')
 print(len(r),'imagens coletadas')
if __name__=='__main__':main()
