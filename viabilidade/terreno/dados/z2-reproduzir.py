"""Reproduz geometria e evidências do piloto Z2; não escolhe zona por cor.
python -I viabilidade/terreno/dados/z2-reproduzir.py
"""
import hashlib,importlib.util,json,site,sys
from pathlib import Path
sys.path.append(site.getusersitepackages())
import numpy as np
import shapely as sh
from shapely.geometry import shape,Polygon,LineString
from pyproj import Transformer
from PIL import Image,ImageDraw
B=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('lotes',B.parent/'gerar_lotes.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
IDS=[75352,75353,75354]
f=g.ler(g.BASES[1])['features'];gs=sh.transform(np.array([shape(x['geometry']) for x in f],dtype=object),g.UTM.transform,interleaved=False)
parts=[gs[k] for k in IDS];p=sh.union_all(parts)
assert p.geom_type=='Polygon' and p.is_valid and not p.interiors and 1200<=p.area<=3000
assert len({f[k]['properties']['quadra'] for k in IDS})==1
assert abs(sum(x.area for x in parts)-p.area)<.001
assert all(parts[j].intersection(parts[j+1]).length>1 for j in range(len(parts)-1))
malha,_=g.ruas();rt=sh.STRtree(malha);rua=sh.union_all(malha[rt.query(p.buffer(12),predicate='intersects')]);tree=sh.STRtree(gs)
other=[int(k) for k in tree.query(p,predicate='intersects') if k not in IDS]
maxover=max((p.intersection(gs[k]).area for k in other if gs[k].is_valid),default=0); invasion=p.intersection(rua).area
assert maxover<=.1 and invasion/p.area<=.02
coords=[[round(x,6),round(y,6)] for x,y in p.exterior.coords];fronts=[]
inspecionado='850d757338e609a8dd098920625cf9bf96450207e474c1d491513f2ee8aa8724'
assert hashlib.sha256(json.dumps(coords,separators=(',',':')).encode()).hexdigest()==inspecionado, 'Geometria mudou: repetir leitura manual dos anexos.'
for j,(a,b) in enumerate(zip(coords,coords[1:])):
 side=LineString([a,b]);dd=[side.interpolate(t,normalized=True).distance(rua) for t in (.15,.5,.85)]
 if side.length>=8 and max(dd)<=6:fronts.append({'aresta':j,'pontos':[a,b],'comprimento_m':round(side.length,3),'distancia_max_asfalto_m':round(max(dd),3)})
fronts.sort(key=lambda x:-x['comprimento_m']);assert fronts
pilotos=g.ler('viabilidade/terreno/lotes-piloto.json')
originais={'SC-completo-30516','SC-completo-37607','SC-completo-22426','SC-completo-22421','SC-completo-25297'}
overlap={x['id']:p.intersection(Polygon(x['poligono_utm'])).area for x in pilotos if x['id'] in originais}
assert set(overlap)==originais
assert all(p.intersection(Polygon(x['poligono_utm'])).area<.1 for x in pilotos if x['id']!='SC-completo-remembramento-75352-75354')
assert max(overlap.values())<.1
q={'frentes':fronts,'sobreposicao_asfalto_m2':round(invasion,6),'maior_sobreposicao_vizinho_m2':round(maxover,6),'ocupacao_retangulo_minimo':round(p.area/p.minimum_rotated_rectangle.area,5),'esquina_indicada_pela_malha':False,'sobreposicao_pilotos_m2':overlap,'uniao_sem_buffer_ou_simplificacao':True,'area_soma_componentes_m2':sum(x.area for x in parts),'area_acrescentada_em_gaps_m2':0,'divisas_compartilhadas_m':[parts[j].intersection(parts[j+1]).length for j in range(len(parts)-1)]}
lote={'id':'SC-completo-remembramento-75352-75354','lid':None,'poligono_utm':coords,'frente':fronts[0]['pontos'],'area_m2':round(Polygon(coords).area,3),'zona_id':'SC-Z2','zona_origem':'anotada_a_mao','zona_conferida':False,'relevo':None,'areas_especiais':[],'crs':'EPSG:31983','categoria':'z2','centroide_lonlat':list(g.GEO.transform(p.centroid.x,p.centroid.y)),'distancia_centro_referencia_m':round(p.centroid.distance(g.CENTRO),1),'fonte':{'arquivo':g.BASES[1],'sha256':hashlib.sha256((g.ROOT/g.BASES[1]).read_bytes()).hexdigest(),'indices_feicoes_zero_based':IDS,'quadra':f[IDS[0]]['properties']['quadra'],'propriedades_componentes':[f[k]['properties'] for k in IDS],'operacao':'União exata das geometrias lon/lat convertidas para EPSG:31983; sem buffer, fechamento de gaps ou simplificação.'},'qualidade':q,'conferido':False,'observacoes':'Remembramento de ensaio de três feições sintéticas contíguas da mesma quadra da maquete. Não representa três lotes cadastrais confirmados nem disponibilidade ou viabilidade de remembramento real. Zona lida manualmente nos anexos, sem certidão. Frente inferida da malha de asfalto. Matrículas, loteamento e consulta urbanística pendentes.'}
g.gravar(B/'novo-z2.json',lote)
# Os controles existentes são reaplicados; as matrizes não são alteradas.
tr=Transformer.from_crs(31983,29183,always_xy=True);poses=g.ler('viabilidade/terreno/dados/zonas-posicionamento.json'); report={}
for n in ('02','05','06','07'):
 pos=poses[n];coef=np.array(pos['afim_utm_menos_origem_para_pixel']);origin=np.array(pos['origem_utm'])
 world=np.array([tr.transform(*xy) for xy in coords]);pixels=np.column_stack([world-origin,np.ones(len(world))])@coef
 im=Image.open(B/f'zonas-mapas/anexo{n}.jpg');assert im.size==(8858,12746);im.load();draw=ImageDraw.Draw(im);draw.line([tuple(v) for v in pixels],fill='magenta',width=4);x,y=pixels[:-1].mean(axis=0);draw.ellipse((x-35,y-35,x+35,y+35),outline='magenta',width=3)
 im.crop((int(x)-600,int(y)-500,int(x)+600,int(y)+500)).save(B/f'z2-anexo{n}.jpg',quality=92)
 report[n]={'pixels':pixels.tolist(),'afim_utm_menos_origem_para_pixel':coef.tolist(),'origem_utm':origin.tolist(),'rmse_controles_m':pos['rmse_controles_m'],'residuos_controles_m':pos['residuos_controles_m']}
g.gravar(B/'z2-posicionamento.json',report)
# Desenho auditável de componentes e asfalto em coordenadas métricas.
im=Image.new('RGB',(1000,850),'white');d=ImageDraw.Draw(im);xmin,ymin,xmax,ymax=p.buffer(25).bounds;scale=min(950/(xmax-xmin),750/(ymax-ymin))
def xy(c):return (25+(c[0]-xmin)*scale,800-(c[1]-ymin)*scale)
for t in malha[rt.query(p.buffer(25),predicate='intersects')]:d.polygon([xy(c) for c in t.exterior.coords],fill='#cccccc')
for k,c,col in zip(IDS,parts,('#cdeaca','#d3ddff','#ffe3bc')):
 d.polygon([xy(v) for v in c.exterior.coords],fill=col,outline='black',width=3);d.text(xy(c.centroid.coords[0]),str(k),fill='black')
d.line([xy(c) for c in lote['frente']],fill='red',width=6);d.text((20,20),'Z2: componentes exatos; asfalto cinza; frente vermelha. EPSG:31983',fill='black');im.save(B/'z2-componentes.png')
print(json.dumps({'id':lote['id'],'area':lote['area_m2'],'qualidade':q},ensure_ascii=False))

# Traço Z1/Z2 identificado manualmente no recorte 02, sem classificação automática.
pixels=np.array(report['02']['pixels']);center=pixels[:-1].mean(axis=0)
crop_origin=np.array([int(center[0])-600,int(center[1])-500])
divisa=np.array([[425,35],[431,764],[218,769]])+crop_origin
escala=np.sqrt(abs(np.linalg.det(np.array(report['02']['afim_utm_menos_origem_para_pixel'])[:2])))
distancia=Polygon(pixels).distance(LineString(divisa))/escala
assert distancia>180
base=g.ler('viabilidade/terreno/dados/anotacoes-zonas.json')[0]
anotacao={
 'id':lote['id'],'poligono_sha256':inspecionado,'zona_id':'SC-Z2',
 'zona_origem':'anotada_a_mao','zona_conferida':False,'conferido':False,
 'data_anotacao':'2026-11-14','fontes':base['fontes']+[{'lei':'Lei 18.053/2016','artigo':'11','url':'https://servico.saocarlos.sp.gov.br/consultaleis/index.php?acao=14&lei=1_2257','data':'2026-11-14'}],
 'evidencia_zoneamento':'Polígono inteiro na mancha amarela Z2, a leste da divisa Z1/Z2 e a oeste da Rua Dona Maria Izabel de Oliveira Botelho, entre Major José Inácio e Conde do Pinhal. Afastamento aproximado de 200 m do traço divisório mais próximo. A rua inferida para a frente não consta no art. 11; nenhum Eixo desenhado toca o polígono.',
 'areas_especiais':[],
 'areas_especiais_verificacao':{'05':'Fora das manchas ambientais e AIA do Gregório/Lazarini. Mancha verde isolada ao norte, sem interseção.','06':'Fora da poligonal histórica, subárea de 9 m, Observatório, áreas industriais e demais manchas especiais visíveis.','07':'A leste da borda da superfície de aproximação/decolagem em tracejado roxo; nenhuma incidência rural desenhada.'},
 'metodo':base['metodo'],'controles':'dados/zonas-controles.json','posicionamento':'dados/z2-posicionamento.json',
 'evidencias':[f'dados/z2-anexo{n}.jpg' for n in ('02','05','06','07')]+['dados/z2-componentes.png'],
 'rmse_controles_anexo02_m':round(report['02']['rmse_controles_m'],3),'incerteza_posicional_total_m':None,
 'afastamento_divisa':{'anexo':'02','distancia_aproximada_m':round(distancia),'linha_pixels_original':divisa.tolist(),'metodo':'Distância do polígono projetado ao traço local Z1/Z2 marcado manualmente no JPEG. Não é distância cadastral nem levantamento de toda a zona.'},
 'limitacoes':[
 'Três feições de origem sintetico: são parcelas de ensaio da maquete. A união exata comprova contiguidade apenas nessa base; não demonstra lotes reais, matrícula ou possibilidade legal de remembramento.',
 'Triagem de componentes planta até 3,5 km do centro não encontrou remembramento exato que passasse os filtros adotados; não é inventário exaustivo de imóveis disponíveis.',
 'Frente registrada é somente o segmento de 8,391 m que passou o teste de três pontos junto ao asfalto; a malha tem lacunas. Não tratar esse segmento como testada cadastral total nem usar para certificar lote mínimo. A testada e os recuos exigem cadastro.',
 'Ausência visual de incidência nos anexos não afasta APP, inundação, servidão, patrimônio individual, contaminação ou restrições do loteamento. Consulta específica ao DECEA continua necessária para altura.',
 'Anotação manual para simulação. Resíduos do ajuste não representam acurácia cadastral nem erro total; não há certidão municipal.'
 ]}
g.gravar(B/'anotacao-z2.json',anotacao)
print('Anotação manual vinculada ao hash; afastamento aproximado da divisa:',round(distancia),'m')
