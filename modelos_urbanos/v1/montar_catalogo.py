"""Contact sheets from actual Blender renders; no synthetic preview imagery."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, re

ROOT=Path(__file__).resolve().parent
fontroot=Path('C:/Windows/Fonts')
def font(size,bold=False):
    return ImageFont.truetype(str(fontroot/('segoeuib.ttf' if bold else 'segoeui.ttf')),size)

src=(ROOT/'gerar.py').read_text(encoding='utf-8')
import ast
tree=ast.parse(src);names={}
for node in tree.body:
    if isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Name) and node.targets[0].id in ('HOUSE_NAMES','SOB_NAMES','TOWER_NAMES'):
        names[dict(HOUSE_NAMES='casas',SOB_NAMES='sobrados',TOWER_NAMES='predios')[node.targets[0].id]]=ast.literal_eval(node.value)

def sheet(category,title,back=False,only_available=False):
    suffix='-verso' if back else ''
    items=[(i,ROOT/'previas'/f'{category}-{i+1:02}{suffix}.png') for i in range(20)]
    if only_available:items=[p for p in items if p[1].exists()]
    if not items:return
    cols=5;rows=(len(items)+cols-1)//cols;cw=350;ch=365
    im=Image.new('RGB',(cols*cw+64,rows*ch+164),'#eeeae3');draw=ImageDraw.Draw(im)
    draw.text((32,24),title,font=font(33,True),fill='#263631')
    draw.text((34,74),'BIBLIOTECA URBANA  /  EXTERIORES ILUSTRATIVOS  /  V1',font=font(14),fill='#62736d')
    for idx,(i,p) in enumerate(items):
        x=32+(idx%cols)*cw;y=122+(idx//cols)*ch
        draw.rounded_rectangle((x+5,y,x+cw-7,y+ch-12),radius=7,fill='#f8f6f1')
        if p.exists():
            tile=Image.open(p).convert('RGBA');tile.thumbnail((cw-25,295))
            im.paste(tile,(x+(cw-tile.width)//2,y+4+(295-tile.height)//2),tile)
        draw.text((x+18,y+304),f'{category[:-1].upper()} {i+1:02}',font=font(13,True),fill='#8b613e')
        draw.text((x+18,y+325),names[category][i],font=font(16),fill='#263631')
    draw.text((34,im.height-29),'Modelos conceituais em metros. Escalas de enquadramento individuais; não comparar alturas pela miniatura.',font=font(13),fill='#62736d')
    path=ROOT/f'{category}{suffix}-catalogo.jpg';im.save(path,quality=94)
    print(path)

for cat,title in [('casas','20 casas térreas'),('sobrados','20 sobrados'),('predios','20 prédios residenciais')]:
    sheet(cat,title,only_available=True)
    sheet(cat,title+' / amostra de 5 fachadas posteriores',back=True,only_available=True)

def overview():
    samples=[('casas',0),('casas',4),('casas',6),('sobrados',2),('sobrados',3),('sobrados',17),('predios',5),('predios',11),('predios',17)]
    if not all((ROOT/'previas'/f'{c}-{i+1:02}.png').exists() for c,i in samples):return
    im=Image.new('RGB',(1320,1370),'#eeeae3');dr=ImageDraw.Draw(im)
    dr.text((40,26),'60 arquiteturas para o entorno',font=font(38,True),fill='#263631')
    dr.text((42,85),'20 CASAS   /   20 SOBRADOS   /   20 PRÉDIOS',font=font(18),fill='#8b613e')
    for j,(cat,i) in enumerate(samples):
        x=30+(j%3)*430;y=136+(j//3)*390
        tile=Image.open(ROOT/'previas'/f'{cat}-{i+1:02}.png').convert('RGBA');tile.thumbnail((400,335))
        im.paste(tile,(x+(420-tile.width)//2,y),tile)
        dr.text((x+25,y+340),f'{cat[:-1].upper()} {i+1:02}  ·  {names[cat][i]}',font=font(16),fill='#263631')
    dr.text((43,1330),'Prévia de 9 dos 60 modelos. Geometria externa · Dois níveis de detalhe · Arquivos editáveis',font=font(17),fill='#62736d')
    im.save(ROOT/'visao-geral.jpg',quality=95)
overview()
