"""Formato binário dos dados da miniatura (MBN1), lido por `fonte/binario.js`.

Antes, a geometria do prédio (1,4 MB), as UVs de luz do exterior (15,7 MB) e as do
interior (6,7 MB) iam como TEXTO JSON: o celular baixava, fazia `JSON.parse` de milhões
de números e depois os copiava um a um com `push`. Aqui eles viajam como arrays tipados
(o navegador os usa sem conversão), quantizados onde a precisão sobra, e comprimidos com
gzip -- que o próprio navegador descompacta (`DecompressionStream`).

    'MBN1' | uint32 tamanho do cabeçalho | cabeçalho JSON (UTF-8, alinhado a 4) | dados

O cabeçalho descreve cada array (`tipo`, `inicio` em bytes, `n` elementos) e leva os
metadados de quem o lê. Tudo little-endian; cada array começa alinhado a 4 bytes.
"""
import gzip, json, struct
import numpy as np

TIPOS = {'u8': np.uint8, 'i8': np.int8, 'u16': np.uint16, 'i16': np.int16, 'u32': np.uint32, 'f32': np.float32}


class Escritor:
    def __init__(self):
        self.arrays, self.partes, self.pos = {}, [], 0

    def poe(self, nome, dados, tipo, delta=0):
        """`delta` > 0 grava a DIFERENÇA para o valor `delta` posições antes (zigue-zague):
        índices em sequência e UVs vizinhas viram números pequenos, que o gzip comprime
        muito melhor (UVs do interior: 402 KB -> 142 KB). O leitor refaz a soma."""
        a = np.ascontiguousarray(np.asarray(dados, dtype=TIPOS[tipo]))
        info = {'tipo': tipo, 'inicio': self.pos, 'n': int(a.size)}
        if delta:
            v = a.astype(np.int64).reshape(-1)
            d = v.copy()
            d[delta:] = v[delta:] - v[:-delta]
            z = (d << 1) ^ (d >> 63)
            guarda = 'u16' if z.max(initial=0) < 65536 else 'u32'
            a = z.astype(TIPOS[guarda])
            info.update(tipo=guarda, final=tipo, delta=delta)
        b = a.tobytes()
        self.arrays[nome] = info
        pad = (-len(b)) % 4
        self.partes.append(b + b'\0' * pad)
        self.pos += len(b) + pad
        return nome

    def grava(self, caminho, meta):
        cab = json.dumps({'arrays': self.arrays, **meta}, separators=(',', ':'), ensure_ascii=False).encode()
        cab += b' ' * ((-len(cab)) % 4)
        bruto = b'MBN1' + struct.pack('<I', len(cab)) + cab + b''.join(self.partes)
        # mtime=0: o mesmo conteúdo gera o mesmo arquivo (e o mesmo hash no nome).
        dados = gzip.compress(bruto, compresslevel=9, mtime=0)
        with open(caminho, 'wb') as f:
            f.write(dados)
        return {'bytes': len(dados), 'bytesBrutos': len(bruto)}


def le(caminho):
    bruto = gzip.decompress(open(caminho, 'rb').read())
    assert bruto[:4] == b'MBN1'
    n = struct.unpack('<I', bruto[4:8])[0]
    cab = json.loads(bruto[8:8 + n])
    base = 8 + n
    arrays = {}
    for k, d in cab['arrays'].items():
        a = np.frombuffer(bruto, TIPOS[d['tipo']], d['n'], base + d['inicio'])
        if d.get('delta'):
            z = a.astype(np.int64)
            dif = (z >> 1) ^ -(z & 1)
            out = dif.copy()
            for i in range(d['delta']):
                out[i::d['delta']] = np.cumsum(dif[i::d['delta']])
            a = out.astype(TIPOS[d['final']])
        arrays[k] = a
    return cab, arrays


def uv16(uv):
    """UV em [0,1] -> uint16 normalizado (1/65535: 0,03 texel num atlas de 2048)."""
    return np.round(np.clip(np.asarray(uv, np.float64), 0, 1) * 65535).astype(np.uint16)


def grava_predio(asset, caminho):
    """Malhas do Blender do exterior (antes `CASTANHEIRAS_BLENDER`, 1,4 MB de texto)."""
    w = Escritor()
    geos = {}
    for nome, g in asset['geometries'].items():
        d = {'position': w.poe(nome + '/p', g['position'], 'f32'),
             'normal': w.poe(nome + '/n', g['normal'], 'f32'),
             'uv': w.poe(nome + '/uv', g['uv'], 'f32')}
        if g.get('index'):
            d['index'] = w.poe(nome + '/i', g['index'], 'u16' if max(g['index']) < 65536 else 'u32')
        geos[nome] = d
    meta = {'source': asset['source'], 'geometries': geos, 'materials': asset['materials'],
            'groups': asset['groups'], 'metadata': asset.get('metadata')}
    return w.grava(caminho, meta)


def grava_uv_exterior(compacto, uv_novo, asset, caminho):
    """UVs de luz do exterior JÁ INDEXADAS.

    No original cada triângulo trazia os três cantos expandidos (367.380 cantos para
    122.460 triângulos) e o navegador montava uma malha sem índice. Aqui cada canto vira
    (vértice de origem, UV de luz); pares repetidos são o mesmo vértice e entram uma vez.
    O navegador recebe a lista de vértices únicos e o índice dos triângulos: a mesma malha,
    com menos vértices para copiar, enviar e transformar."""
    w = Escritor()
    entradas = []
    src_all, uv_all, tri_all = [], [], []
    so = uo = to = 0
    for e, uv in zip(compacto, uv_novo):
        idx = np.asarray(e['indices'], np.int64)
        q = uv16(uv).astype(np.int64)
        chave = idx * (1 << 32) + q[:, 0] * 65536 + q[:, 1]
        unicos, primeiro, inverso = np.unique(chave, return_index=True, return_inverse=True)
        # ordem de primeira ocorrência: preserva a localidade dos vértices
        ordem = np.argsort(primeiro, kind='stable')
        novo_de = np.empty_like(ordem); novo_de[ordem] = np.arange(len(ordem))
        tri = novo_de[inverso]
        src_all.append(idx[primeiro[ordem]]); uv_all.append(q[primeiro[ordem]]); tri_all.append(tri)
        entradas.append({'slot': e['slot'], 'instance': e['instance'], 'sourceVertexCount': e['sourceVertexCount'],
                         'groups': e['groups'], 'nUnicos': int(len(ordem)), 'nCantos': int(len(tri)),
                         'src': so, 'uv': uo, 'tri': to})
        so += len(ordem); uo += len(ordem); to += len(tri)
    src = np.concatenate(src_all); tri = np.concatenate(tri_all)
    w.poe('src', src, 'u16' if src.max() < 65536 else 'u32', delta=1)
    w.poe('uv1', np.concatenate(uv_all).reshape(-1), 'u16', delta=2)
    w.poe('tri', tri, 'u16' if max(x['nUnicos'] for x in entradas) < 65536 else 'u32', delta=1)
    info = w.grava(caminho, {'entradas': entradas, 'uvNormalizado': 65535})
    info.update(cantos=int(to), unicos=int(so))
    return info


def grava_uv_interior(compacto, caminho):
    """UVs de luz do interior. A malha fica sem índice, como no original: o navegador vira
    normais por TRIÂNGULO (`flipped` do bake), e um vértice compartilhado não pode virar
    para um triângulo e não para o vizinho."""
    w = Escritor()
    entradas = []
    ind, uvs = [], []
    io = 0
    for e in compacto:
        n = len(e['indices'])
        x = {'slot': e['slot'], 'instance': e['instance'], 'sourceVertexCount': e['sourceVertexCount'],
             'groups': e['groups'], 'nCantos': n, 'ind': io}
        if e.get('correctedWorldMatrix'):
            x['correctedWorldMatrix'] = e['correctedWorldMatrix']
        if e.get('correctedPosition'):
            x['correctedPosition'] = w.poe(f"cp{len(entradas)}", e['correctedPosition'], 'f32')
        entradas.append(x)
        ind.append(np.asarray(e['indices'], np.int64)); uvs.append(np.asarray(e['uv1'], np.float64))
        io += n
    todos = np.concatenate(ind)
    w.poe('ind', todos, 'u16' if todos.max() < 65536 else 'u32', delta=1)
    w.poe('uv1', uv16(np.concatenate(uvs)), 'u16', delta=2)
    return w.grava(caminho, {'entradas': entradas, 'uvNormalizado': 65535})
