from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,html
root=Path(__file__).resolve().parent
assets=json.loads((root/'catalogo.json').read_text(encoding='utf-8'))['assets']
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',16)
for category,start,end in [('muros',0,25),('quintais',0,20),('quintais',20,40)]:
    rows=[a for a in assets if a['category']==category][start:end]
    sheet=Image.new('RGB',(1500,((len(rows)+4)//5)*325),(233,231,222));draw=ImageDraw.Draw(sheet)
    for i,a in enumerate(rows):
        im=Image.open(root/'previas'/(a['id']+'.png')).convert('RGBA');im.thumbnail((290,280))
        x=(i%5)*300;y=(i//5)*325
        sheet.paste(im,(x+(300-im.width)//2,y),im)
        draw.text((x+12,y+280),a['id'],fill=(39,53,44),font=font)
        draw.text((x+12,y+301),a['name'],fill=(39,53,44),font=font)
    sheet.save(root/f'{category}-{start+1:02}-{end:02}.jpg',quality=92)
cards=''.join(f'<article><a href="glb/{a["id"]}.glb"><img loading="lazy" src="previas/{a["id"]}.png" alt="{html.escape(a["name"])}"></a><small>{a["id"]} · {a["triangles"]:,} triângulos</small><h2>{html.escape(a["name"])}</h2><p>{" × ".join(str(v) for v in a["dimensions_m"])} m</p></article>' for a in assets)
(root/'catalogo.html').write_text('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Muros e quintais | 65 modelos</title><style>body{background:#e9e7de;color:#27352c;font:16px system-ui;margin:0;padding:32px}h1{font-size:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}article{background:#f7f5ee;padding:16px;border-radius:12px}img{width:100%;aspect-ratio:1}h2{font-size:18px;margin:8px 0}small,p{font-size:13px}a{color:inherit}</style><h1>25 muros + 40 quintais</h1><p>Biblioteca ilustrativa modelada no Blender. Clique na imagem para baixar o GLB.</p><p><a href="biblioteca_65.blend">Abrir biblioteca Blender</a></p><main>'+cards+'</main></html>',encoding='utf-8')
print('Catalogo e tres folhas de contato criados')
