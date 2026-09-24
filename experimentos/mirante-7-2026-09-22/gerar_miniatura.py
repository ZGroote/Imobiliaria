"""Monta o ensaio isolado reutilizando o renderizador atual, sem alterar cadastros publicados."""
import json,math,time,sys,types
from pathlib import Path
B=Path(__file__).resolve().parent;ROOT=B.parents[1];sys.path.insert(0,str(ROOT));t=time.perf_counter()
from pipeline.mobiliar import mobilia
# Contornos interpretados da planta Solaris à esquerda de fotos/04.jpg.
rooms=[('Quarto casal',[(49,202),(182,202),(182,356),(49,356)],'madeira'),
 ('Quarto solteiro',[(310,204),(425,204),(425,362),(310,362)],'madeira'),
 ('Banheiro',[(49,356),(137,356),(137,441),(49,441)],'frio'),
 ('Sala de estar',[(182,225),(310,225),(310,362),(182,362)],'frio'),
 ('Cozinha e jantar',[(137,356),(182,356),(182,362),(425,362),(425,441),(137,441)],'frio'),
 ('Varanda',[(190,188),(308,188),(308,225),(190,225)],'frio')]
def area(poly):return abs(sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly)))/2)
scale=math.sqrt(sum(area(p) for _,p,_ in rooms)/37.21)
def point(p):return [round((p[0]-49)/scale,4),round((p[1]-188)/scale,4)]
comodos=[dict(nome=n,poly=[point(q) for q in p],area=round(area(p)/scale**2,2),piso=f) for n,p,f in rooms]
doors=[((162,356),.8),((325,362),.8),((137,379),.75),((230,362),2.3),((242,225),1.9),((213,441),.9)]
windows=[((112,202),1.5),((365,204),1.5),((79,441),.6)]
u=dict(id='mirante-7-solaris-37',cidade='sao-carlos',predio_id=None,andar=8,
 ficha=dict(titulo='Mirante 7 Solaris',empreendimento='Mirante 7',area_util=37.21,quartos=2,banheiros=1,preco=299000,tipo='venda',construtora='Grupo Plano',url='https://www.mariaaires.com.br/lancamentos/mirante-7',endereco='Av. Comendador Alfredo Maffei, 1369 · São Carlos'),
 planta=dict(origem='fotos/04.jpg — Solaris à esquerda',escala_conferida=False,pe_direito=2.6,comodos=comodos,portas=[dict(p=point(p),largura=w) for p,w in doors],janelas=[dict(p=point(p),largura=w) for p,w in windows]),
 lote=dict(predio=dict(largura_m=30,profundidade_m=9,pavimentos=24,blocos=[dict(principal=True,largura_m=30,profundidade_m=9,pavimentos=24,du=0,dv=0),dict(largura_m=9,profundidade_m=30,pavimentos=24,du=20,dv=19)])),
 cores=dict(parede='#E3DED4',piso_frio='#CFC9BD',piso_madeira='#A68159',porta='#F0EDE5',esquadria='#454A4D',vidro='#BFD4E2'))
furn,layout,errors,tight=mobilia(u)
(B/'layout-automatico.json').write_text(json.dumps(dict(moveis=furn,relato=layout,avisos=errors,apertos=tight),ensure_ascii=False,indent=2),encoding='utf8')
# Revisão assistida: ambiente integrado evita uma divisória inexistente no desenho.
u['planta']['comodos']=[c for c in comodos if c['nome'] not in ['Sala de estar','Cozinha e jantar']]
poly=[(182,225),(310,225),(310,362),(425,362),(425,441),(137,441),(137,356),(182,356)]
u['planta']['comodos'].append(dict(nome='Sala e cozinha',poly=[point(p) for p in poly],area=round(area(poly)/scale**2,2),piso='frio'))
u['planta']['portas']=[v for v in u['planta']['portas'] if v['p']!=point((230,362))]
def f(tipo,x,y,w,d,h,rot=0,cor=None):
 v=dict(tipo=tipo,p=point((x,y)),w=w,d=d,h=h,rot=rot)
 if cor:v['cor']=cor
 return v
furn=[f('cama',110,272,1.38,1.88,1.05),f('guardaroupa',110,337,1.8,.5,2.3,2),
 f('cama',345,274,.9,1.88,1.05),f('mesa',395,257,.7,.5,.76,3),f('guardaroupa',368,344,1.55,.45,2.3,2),
 f('pia',77,378,.65,.45,.92,1),f('vaso',113,416,.4,.66,.8,2),f('box',72,419,.78,.78,2),
 f('sofa',285,280,1.65,.76,.85,3,'#6D8B83'),f('rack',198,281,1.4,.26,.7,1),f('tv',193,281,1.05,.10,1.6,1),
 f('pia',288,421,1.0,.55,.92,2,'#AE8962'),f('fogao',333,421,.55,.55,.9,2),f('balcao',365,421,.60,.55,.92,2),f('geladeira',401,418,.60,.65,1.85,2),
 f('aereo',288,423,1.0,.30,2.15,2),f('mesa',234,370,.75,.65,.76),f('cadeira',212,370,.4,.4,.85,1),f('cadeira',254,370,.4,.4,.85,3)]
u['planta']['moveis']=furn
(B/'ajustes-layout.json').write_text(json.dumps(dict(metodo='Ajuste assistido após avisos do layout automático, baseado nas perspectivas e na planta',mudancas=['Sala e cozinha unidas sem divisória','Cama casal conforme referência','Segundo dormitório com uma cama e mesa de apoio, arranjo ilustrativo','Sofá acrescentado pois o automático não o posicionou','Cozinha alinhada à parede inferior'],moveis=furn),ensure_ascii=False,indent=2),encoding='utf8')
(B/'unidade.json').write_text(json.dumps(u,ensure_ascii=False,indent=2),encoding='utf8')
(B/'hipoteses.json').write_text(json.dumps(dict(pixels_por_metro=scale,area_calibrada_m2=37.21,contornos_px=rooms,altura_pavimento_m=3.15,pe_direito_m=2.6,pavimentos_representados=24,andar_demonstrativo=8,observacao='Altura, quantidade de pisos, envelope exterior e posição da unidade não confirmados. Área calibra o desenho, não verifica medidas reais.'),ensure_ascii=False,indent=2),encoding='utf8')
from pipeline.build import blocos
original=blocos.bloco_unidades;blocos.bloco_unidades=lambda cidade:json.dumps([u])
source=ROOT/'v1.5/miniaturas/pagina_maquete.py';code=source.read_text(encoding='utf8')
# Habilita a mesma biblioteca de edição para a unidade deste ensaio.
code=code.replace("if imovel.get('_id') == 'monte-dos-cedros-37' else ''","if imovel.get('_id') == 'mirante-7-solaris-37' else ''")
m=types.ModuleType('pagina_ensaio');m.__file__=str(source);exec(compile(code,str(source),'exec'),m.__dict__)
m.UNIDADE=u['id'];m.SAIDA=str(B/'miniatura.html');m.MODELOS_BLENDER[u['id']]=str(B/'modelo');m.botao_mapa=lambda imovel=None:''
base_read=m.le
def read(p):
 s=base_read(p)
 if str(p).endswith('editor_cedros.js'):s=s.replace('miniaturas:cedros:moveis:v1','miniaturas:mirante7:moveis:v1')
 return s
m.le=read
# Conjunto opcional e nota de procedência visível nos quatro modos.
m.PAGINA=m.PAGINA.replace("var modeloMontes = /^monte-d[ao]s-/.test(D._id || '');","var modeloMontes = true;")
m.PAGINA=m.PAGINA.replace("'Maquete ilustrativa baseada nas imagens da MRV • dimensões e implantação aproximadas.'","'Estudo Mirante 7 · fachada e altura aproximadas · planta Solaris calibrada pela área, sem cotas · andar demonstrativo.'")
m.PAGINA=m.PAGINA.replace('</style>','\n#fStats b{white-space:normal;overflow-wrap:anywhere}\n@media(max-width:640px){#fStats{grid-template-columns:repeat(2,minmax(0,1fr))}}\n</style>',1)
# Corte a 1,20 m: vergas não podem fechar visualmente as portas no desenho 2D.
m.PAGINA=m.PAGINA.replace('if (q.y0 > 0.06 && q.y1 < PD - 0.06) continue;', 'if (q.y0 >= 1.20 || q.y1 < 1.20) continue;')
base=m.do_cadastro
def cadastro(uid,city):
 d=base(uid,city);d['unidade']='Solaris · 37,21 m²';d['ficha']=[x for x in d['ficha'] if x[0] not in ['Pavimento','Pé-direito']];d['ficha'] += [('Escala da planta','Estimada pela área'),('Altura e andar','Ilustrativos')];return d
m.do_cadastro=cadastro
m.main();blocos.bloco_unidades=original
(B/'tempo-montagem.json').write_text(json.dumps(dict(segundos=time.perf_counter()-t,moveis=len(furn),bytes=(B/'miniatura.html').stat().st_size),indent=2))
print('LAYOUT',layout,'AVISOS',errors,'APERTOS',tight)
