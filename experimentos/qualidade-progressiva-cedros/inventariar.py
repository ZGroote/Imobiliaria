"""Auditoria local somente leitura das entradas; escreve apenas nesta pasta.

Executar da raiz: python experimentos/qualidade-progressiva-cedros/inventariar.py
Python 3.14.4, somente biblioteca padrão. Não executa geradores ou runtimes.
"""
from pathlib import Path
import csv, gzip, hashlib, json, re, struct
from collections import Counter

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
MINI = ROOT / 'v1.5/miniaturas'
SRC = MINI / 'padrao-atual'
NAME = 'maquete-monte-dos-cedros-37.html'
CATS = ['runtime', 'geometria', 'texturas', 'UV', 'lightmaps', 'materiais/dados', 'outros']
SCRIPT = re.compile(rb'<script\b([^>]*)>(.*?)</script\s*>', re.S | re.I)

def sha(b):
    return hashlib.sha256(b).hexdigest()

def dump(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')

def csvout(name, rows):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)

def partition(path):
    """Fatias exatas e disjuntas; não normaliza bytes para declarar igualdade."""
    data = path.read_bytes(); parts = []; cursor = 0
    def add(start, end, category, label):
        if end > start:
            b = data[start:end]
            parts.append(dict(path=path.relative_to(ROOT).as_posix(), recurso=label,
                              inicio=start, fim_exclusivo=end, bytes=len(b), sha256=sha(b), categoria=category))
    for i, m in enumerate(SCRIPT.finditer(data)):
        add(cursor, m.start(2), 'outros', f'HTML/CSS/envelope-{i}')
        attrs, body = m.group(1), m.group(2)
        label = re.search(rb'id="([^"]+)"', attrs)
        label = label[1].decode() if label else f'script-{i}'
        category = 'runtime'
        if b'__moveis' in attrs: category = 'geometria'
        elif b'__luzue' in attrs: category = 'lightmaps'
        elif b'application/json' in attrs: category = 'materiais/dados'
        elif b'/* Creates the nine shared interior maps' in body or b'/* Interior materials and ceiling shader' in body:
            category = 'materiais/dados'
        geo = re.search(rb'var CASTANHEIRAS_BLENDER = (\{[^\r\n]+\});', body)
        if geo:
            a, z = m.start(2) + geo.start(1), m.start(2) + geo.end(1)
            add(m.start(2), a, category, label + '-antes')
            add(a, z, 'geometria', 'CASTANHEIRAS_BLENDER')
            add(z, m.end(2), category, label + '-depois')
        else: add(m.start(2), m.end(2), category, label)
        cursor = m.end(2)
    add(cursor, len(data), 'outros', 'HTML-final')
    assert sum(p['bytes'] for p in parts) == len(data)
    assert parts[0]['inicio'] == 0 and parts[-1]['fim_exclusivo'] == len(data)
    assert all(a['fim_exclusivo'] == b['inicio'] for a,b in zip(parts, parts[1:]))
    return parts

def compare(base, premium):
    available = Counter((x['sha256'], x['categoria']) for x in base)
    table = {c: dict(LEVE=0, PREMIUM=0, Comum=0, So_PREMIUM=0) for c in CATS}
    for x in base: table[x['categoria']]['LEVE'] += x['bytes']
    for x in premium:
        row = table[x['categoria']]; row['PREMIUM'] += x['bytes']; k = x['sha256'], x['categoria']
        if available[k]: row['Comum'] += x['bytes']; available[k] -= 1
        else: row['So_PREMIUM'] += x['bytes']
    table['TOTAL'] = {k:sum(v[k] for v in table.values()) for k in ['LEVE','PREMIUM','Comum','So_PREMIUM']}
    return table

def main():
    release = json.loads((SRC / 'release.json').read_bytes())
    leve = MINI / 'publicado' / NAME
    premium = MINI / 'publicado-atual' / NAME
    template = SRC / 'anterior/v2.html'
    refs = re.findall(rb'assets/cedros/[^"\s<>]+\.(?:json|gz)', premium.read_bytes())
    assets = [premium.parent / r.decode() for r in sorted(set(refs))]
    assert len(assets) == 4
    assert all(release['release'] in str(p) for p in assets)
    for p in assets:
        folder='piloto-v3' if p.name.startswith('interior') else 'exterior-v3'
        source=SRC/folder/('lightmap.rgbm.gz' if p.suffix=='.gz' else 'geometry-compact.json')
        assert sha(p.read_bytes())==sha(source.read_bytes()),(p,'published asset diverged')
    def resource(p):
        b=p.read_bytes(); return dict(path=p.relative_to(ROOT).as_posix(), recurso=p.name,
          inicio=0, fim_exclusivo=len(b), bytes=len(b), sha256=sha(b),
          categoria='lightmaps' if p.suffix=='.gz' else 'UV')
    lp=partition(leve); pp=partition(premium)+[resource(p) for p in assets]; tp=partition(template)
    allparts = [dict(padrao=n, **p) for n,ps in [('LEVE-provisorio',lp),('PREMIUM',pp),('template-V2',tp)] for p in ps]
    csvout('conteudos-embutidos.csv',allparts)
    table=compare(lp, pp); alternate=compare(tp,pp)
    dump('bytes.json',dict(unidade='bytes de arquivos locais; não é transferência HTTP medida',
        LEVE_provisorio=leve.relative_to(ROOT).as_posix(), PREMIUM=premium.relative_to(ROOT).as_posix(),
        release=release['release'], arquivos_inteiros=dict(peso_LEVE=leve.stat().st_size,
            peso_PREMIUM=sum(p.stat().st_size for p in [premium,*assets]),bytes_comuns=0,
            bytes_exclusivos_PREMIUM=sum(p.stat().st_size for p in [premium,*assets])),
        fatias_exatas=table, controle_template_V2=alternate))
    csvout('tabela-bytes.csv',[dict(categoria=k,**v) for k,v in table.items()])
    files=[]
    for label,paths in [('LEVE',[leve]),('PREMIUM',[premium,*assets])]:
        other=[premium,*assets] if label=='LEVE' else [leve]
        hashes={sha(p.read_bytes()) for p in other}
        for p in paths:
            b=p.read_bytes(); same=sha(b) in hashes
            counterpart=(premium if label=='LEVE' else leve) if p.suffix=='.html' else None
            files.append(dict(padrao=label,path=p.relative_to(ROOT).as_posix(),bytes=len(b),sha256=sha(b),
                tipo='HTML/JS misto' if p.suffix=='.html' else ('lightmap' if p.suffix=='.gz' else 'UV/remapeamento/correcoes'),
                funcao='runtime e cena embutidos' if p.suffix=='.html' else ('atlas RGBM' if p.suffix=='.gz' else 'indices, uv1, grupos e correcoes'),
                existe_LEVE=label=='LEVE' or counterpart is not None,
                existe_PREMIUM=label=='PREMIUM' or counterpart is not None,
                conteudo_identico=same,pode_compartilhar='parcial: ver fatias' if p.suffix=='.html' else 'nao existe no LEVE',
                regeneravel='sim; fidelidade byte a byte do rebake nao verificada',
                antes_primeiro_frame='HTML sim; blocos internos podem ser diferidos' if p.suffix=='.html' else 'nao bloqueia frame basico; necessario para modo com bake',
                gzip_estimado_bytes=len(gzip.compress(b,mtime=0)) if p.suffix!='.gz' else len(b)))
    csvout('inventario-arquivos.csv',files)
    ancillary=[]
    sources=[SRC/p for p in release['sources']]
    sources += [MINI/'padrao_atual.py',MINI/'pagina_maquete.py',MINI/'preparar_publicacao.py',SRC/'release.json']
    sources += list(SRC.glob('*.py'))
    sources += [SRC/folder/name for folder in ['piloto-v3','exterior-v3'] for name in ['source.json','uv.json','unwrap.json','bake.json','encoding.json']]
    for p in sorted(set(sources)):
        b=p.read_bytes(); relative=p.relative_to(ROOT).as_posix()
        key=p.relative_to(SRC).as_posix() if p.is_relative_to(SRC) else None
        expected=release['sources'].get(key)
        if expected: assert sha(b)==expected,(p,'source hash diverged')
        ancillary.append(dict(path=relative,bytes=len(b),sha256=sha(b),escopo='fonte/geracao; excluido da carga online',hash_release_confere=sha(b)==expected if expected else 'nao listado'))
    for p in [*premium.parent.glob('*cedros*offline*'), *premium.parent.glob('monte-dos-cedros_blender/*'), *premium.parent.glob(f'assets/cedros/{release["release"]}/*.webp'), leve.parent/'index.html', premium.parent/'index.html']:
        b=p.read_bytes();ancillary.append(dict(path=p.relative_to(ROOT).as_posix(),bytes=len(b),sha256=sha(b),escopo='download offline/modelo ou galeria; excluido da carga direta',hash_release_confere='nao aplicavel'))
    csvout('fontes-e-exclusoes.csv',ancillary)
    geometry={}
    for folder in ['piloto-v3','exterior-v3']:
        p=SRC/folder/'geometry-compact.json'; raw=p.read_bytes(); d=json.loads(raw)
        source=json.loads((SRC/folder/'source.json').read_bytes())
        no_uv=[{k:v for k,v in row.items() if k!='uv1'} for row in d]
        canonical=lambda a:json.dumps(a,separators=(',',':'),ensure_ascii=True).encode()
        assert canonical(d)==raw,'serialization differs'
        texture=gzip.decompress((SRC/folder/'lightmap.rgbm.gz').read_bytes());w,h=struct.unpack('<II',texture[:8])
        assert len(texture)==8+w*h*4
        objects={(o['slot'],o['instance']):o for o in source['objects']}
        for row in d:
            g=source['geometries'][objects[row['slot'],row['instance']]['geometry']]
            assert len(g['position'])//3==row['sourceVertexCount']
            assert len(row['uv1'])==2*len(row['indices'])
            assert min(row['indices'])>=0 and max(row['indices'])<row['sourceVertexCount']
        geometry[folder]=dict(classificacao='TRANSFORMAVEL; fonte de bake validada, runtime LEVE nao medido',
            registros=len(d),slots=len({x['slot'] for x in d}),instancias=sum(x['instance'] is not None for x in d),
            vertices_finais=sum(len(x['indices']) for x in d),indices_finais=0,
            vertices_fonte_unicos_por_slot=sum(next(x['sourceVertexCount'] for x in d if x['slot']==s) for s in sorted({x['slot'] for x in d})),
            correcoes_posicao=sum('correctedPosition' in x for x in d),correcoes_matriz=sum('correctedWorldMatrix' in x for x in d),
            uv_float32_bytes=sum(len(x['uv1'])*4 for x in d),
            uv_serializado_incremental_bytes=len(raw)-len(canonical(no_uv)),
            remapeamento_sem_uv_bytes=len(canonical(no_uv)),
            correcoes_posicao_float32_bytes=sum(len(x.get('correctedPosition',[]))*4 for x in d),
            atlas_largura=w,atlas_altura=h,atlas_RGBA8_bytes=w*h*4,
            atlas_gzip_bytes=(SRC/folder/'lightmap.rgbm.gz').stat().st_size)
    dump('estrutura.json',geometry)
    # Compare Three.js without line-ending differences, but never add normalized bytes to exact-common totals.
    runtime={}
    for label,p in [('LEVE',leve),('templateV2',template),('PREMIUM',premium)]:
        body=next(SCRIPT.finditer(p.read_bytes())).group(2)
        runtime[label]=dict(sha256=sha(body),sha256_normalizado_LF=sha(body.replace(b'\r\n',b'\n')),bytes=len(body))
    dump('runtime.json',runtime)
    manifest={a['path']:a['sha256'] for a in ancillary}
    manifest.update({a['path']:a['sha256'] for a in files})
    assert all(sha((ROOT/p).read_bytes())==h for p,h in manifest.items())
    dump('entradas-sha256.json',manifest)
    print(json.dumps(dict(tabela=table,template=alternate['TOTAL'],estrutura=geometry),ensure_ascii=False,indent=2))

if __name__=='__main__': main()
