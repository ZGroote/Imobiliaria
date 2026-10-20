"""Compara imagem pública e dados exportados pelo construtor; não renderiza um 3D fictício."""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
reg = json.loads((ROOT / 'referencia.json').read_text(encoding='utf-8'))
leitura = json.loads((ROOT / 'leitura.json').read_text(encoding='utf-8'))
editor = json.loads((ROOT / 'projeto-planta.json').read_text(encoding='utf-8'))
unit = json.loads((ROOT / 'previa/unidade.json').read_text(encoding='utf-8'))
source = Image.open(ROOT / '../referencias/planta-47-59.jpg').convert('RGB')
scale = reg['registro']['mmPorPixel']
x0, y0 = reg['registro']['origemPx']
pt = lambda x, y: (x0+x*1000/scale, y0+y*1000/scale)

overlay = Image.blend(source, Image.new('RGB', source.size, 'white'), .65)
draw = ImageDraw.Draw(overlay)
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 17)
font_small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13)
colors = ['#078A73', '#2E6EAC', '#AE651C', '#AD4373', '#674EB5', '#507B46']
for cm, color in zip(unit['planta']['comodos'], colors):
    poly = [pt(*p) for p in cm['poly']]
    draw.line(poly+[poly[0]], fill=color, width=5)
    # Identificação fica no centro de uma parte, sem pressupor centróide dentro do L.
    labelpt = poly[0]
    draw.text((labelpt[0]+8,labelpt[1]+8),cm['nome'],font=font,fill=color,stroke_width=2,stroke_fill='white')

for f in editor['floors'][0]['furniture']:
    px, py = x0+f['xMm']/scale, y0+f['yMm']/scale
    w, h = f['widthMm']/scale, f['depthMm']/scale
    if f['rotDegrees'] % 180:
        w,h=h,w
    draw.rectangle((px-w/2,py-h/2,px+w/2,py+h/2),outline='#8C4F2D',width=2)
    draw.ellipse((px-3,py-3,px+3,py+3), fill='#8C4F2D')

for key,color in [('portas','#F47912'),('janelas','#0097D6')]:
    for op in unit['planta'][key]:
        cx,cy=pt(*op['p'])
        half=op['largura']*1000/scale/2
        along_x=op['wallId'].endswith(('south','north'))
        a=(cx-half,cy) if along_x else (cx,cy-half)
        b=(cx+half,cy) if along_x else (cx,cy+half)
        draw.line([a,b],fill=color,width=7)
overlay.save(ROOT / 'tracado-exportado.png')
canvas=Image.new('RGB',(2040,1120),'#F4F4F1')
d=ImageDraw.Draw(canvas)
title=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',27)
caption=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',21)
d.text((20,15),'Planta oficial · LIV Ipanema 47,59 m²',font=title,fill='#202B2E')
d.text((1040,15),'Captura exportada pelo construtor',font=title,fill='#202B2E')
canvas.paste(source,(20,55))
canvas.paste(overlay,(1040,55))
d.text((20,1070),'Imagem publicitária sem cotas.',font=caption,fill='#475459')
d.text((1040,1070),'Contornos, vãos e móveis • grade 5 cm • medidas inferidas',font=caption,fill='#475459')
canvas.save(ROOT / 'comparativo-captura.png')
print('Comparativo geométrico da captura salvo.')
