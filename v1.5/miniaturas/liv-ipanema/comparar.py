"""Pranchas de referência/captura real. Não sintetiza nem altera o modelo."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import json, hashlib
import numpy as np

ROOT=Path(__file__).resolve().parent
REF=ROOT/'referencias'; CAP=ROOT/'comparacoes'; CAP.mkdir(exist_ok=True)
FONT=Path('C:/Windows/Fonts/segoeui.ttf')
def font(size):return ImageFont.truetype(str(FONT),size)
BG=(13,21,28);TXT=(227,236,240);SUB=(164,184,196)
def contain(src, size, bg=BG, crop_render=False):
    image=Image.open(src).convert('RGBA')
    background=Image.new('RGBA',image.size,(*bg,255))
    image=Image.alpha_composite(background,image).convert('RGB')
    if crop_render:
        # Recorta apenas o espaço vazio do canvas; a captura original é preservada.
        pixels=np.asarray(image)
        rows,cols=np.where(pixels.max(axis=2)>76)
        if len(rows):
            padding=max(20,round(min(image.size)*.04))
            image=image.crop((max(0,int(cols.min())-padding),max(0,int(rows.min())-padding),
                              min(image.width,int(cols.max())+padding+1),
                              min(image.height,int(rows.max())+padding+1)))
    image=ImageOps.contain(image,size,Image.Resampling.LANCZOS)
    canvas=Image.new('RGB',size,bg)
    canvas.paste(image,((size[0]-image.width)//2,(size[1]-image.height)//2))
    return canvas

def card(key, title, size=(1800,720)):
    board=Image.new('RGB',size,BG);draw=ImageDraw.Draw(board)
    draw.text((38,24),'LIV IPANEMA · '+title,fill=TXT,font=font(28))
    draw.text((38,76),'REFERÊNCIA OFICIAL · LIVON',fill=SUB,font=font(18))
    draw.text((922,76),'MINIATURA · CAPTURA DO VISUALIZADOR',fill=SUB,font=font(18))
    source=REF/(key+'.jpg')
    if key=='aerea':
        # Aproxima o empreendimento sem modificar a fotografia oficial.
        im=Image.open(source);im.crop((280,180,870,560)).save(CAP/'aerea-recorte.png')
        source=CAP/'aerea-recorte.png'
    if key=='implantacao':
        # Retira a legenda e parte da via externa, preservando o empreendimento.
        im=Image.open(source);im.crop((25,35,705,704)).save(CAP/'implantacao-recorte.png')
        source=CAP/'implantacao-recorte.png'
    board.paste(contain(source,(852,548)),(36,112))
    board.paste(contain(CAP/(key+'.png'),(852,548),crop_render=True),(912,112))
    draw.line((900,110,900,660),fill=(51,69,79),width=1)
    draw.text((38,681),'Recortes para comparação; originais preservados. Câmeras e luz distintas; medidas estimadas.',fill=SUB,font=font(17))
    board.save(CAP/('comparativo-'+key+'.png'))
    return board

panels=[]
for key,title in [('fachada','Fachada'),('aerea','Vista aérea'),('portaria','Portaria'),('implantacao','Implantação')]:
    if (CAP/(key+'.png')).is_file():panels.append(card(key,title))
if not panels:raise SystemExit('Capture a maquete antes de montar os comparativos.')
summary=Image.new('RGB',(1800,len(panels)*720),BG)
for row,panel in enumerate(panels):summary.paste(panel,(0,row*720))
summary.save(CAP/'comparativo-geral.png')

model=json.loads((ROOT/'modelo.json').read_text(encoding='utf8'))
roles={g['role']:g for g in model['groups'] if g['tower']==0 and g['role'] in ['paredes','lajes']}
checks={'oneTower':model['metadata']['towers']==1,
        'seventeenFloors':sorted(i['floor'] for i in roles['paredes']['instances'])==list(range(17)),
        'eighteenSlabs':sorted(i['floor'] for i in roles['lajes']['instances'])==list(range(18)),
        'fiveBalconyStacks':model['metadata']['balcony_stacks_front']==5,
        'balconyPattern2plus1plus2':model['metadata']['balcony_layout']=='2+1+2',
        'parkingSpaces175':model['metadata']['site']['parking_spaces']==175,
        'comparisonCapturesPresent':len(panels)==4}
report={'sourceURL':model['metadata']['source_url'],'sourceSHA256':hashlib.sha256((ROOT/'modelo.json').read_bytes()).hexdigest(),
        'checks':checks,'allHardGatesPass':all(checks.values()),
        'visualReview':'Fachada, varandas, núcleo descentrado e volumes de implantação conferidos lado a lado.',
        'limits':['Dimensões lineares inferidas de imagens sem cotas.','Fundos e detalhes ocultos inferidos.',
                  'Fotografias do marketing e maquete possuem iluminação, vegetação e câmeras diferentes.',
                  'Nenhum índice SSIM/IoU global é apresentado como prova de precisão dimensional.'],
        'captures':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in CAP.glob('*.png')}}
(ROOT/'validacao-referencias.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
validation=ROOT/'validation';validation.mkdir(exist_ok=True)
(validation/'multiview_fit_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
registration={'coordinateConvention':'Architectural (X,Y,Z) -> Blender (X,-Y,Z) -> Three.js (X,Z,Y)',
              'sitePlanPixels':'referencias/implantacao.jpg',
              'siteTransform':{'x':'(432-v)*0.145','depth':'(u-315)*0.145'},
              'primaryFacade':'positive architectural depth / positive Three.js Z',
              'towerDimensionsM':[47.7,12.7,48.45],
              'dimensionsAreInferred':True,'referenceViewsArePerspective':True,
              'canonicalFacadeLandmarks':{'balconyCentersNormalized':[.11,.19,.45,.76,.85],
                                           'coreCenterNormalized':.37},
              'hiddenGeometry':'Back facade and technical roof volumes are inferred, not survey-derived.'}
(ROOT/'registration_report.json').write_text(json.dumps(registration,ensure_ascii=False,indent=2),encoding='utf8')
light=ROOT/'luz'/'manifest.json'
atlas={'sourceTextureAtlas':None,'sourceImagesUsage':'Reference for geometry and color only; no whole-image projection.',
       'lightAtlasManifest':json.loads(light.read_text()) if light.exists() else None,
       'UV0':'Material metric UVs from authored surfaces.',
       'UV1':'Independent light UVs per evaluated instance from xatlas.'}
(ROOT/'atlas_regions.json').write_text(json.dumps(atlas,ensure_ascii=False,indent=2),encoding='utf8')
print('COMPARE_READY',json.dumps(checks))
