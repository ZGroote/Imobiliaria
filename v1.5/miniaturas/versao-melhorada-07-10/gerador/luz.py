"""Luz calculada (lightmaps): leitura do RGBM aprovado, reempacotamento do atlas e
codificação para compressão de GPU (KTX2/Basis UASTC).

Nada aqui recalcula luz. Os números de irradiância são os do bake aprovado (Cycles +
OIDN, `padrao-atual/*/lightmap.rgbm.gz`); o que muda é COMO eles chegam à GPU:

1. REEMPACOTAMENTO (só o exterior). O atlas externo de 4096² tem 48.873 ilhas de UV, e
   só 11.806 recebem alguma luz: o resto são faces escondidas (topo de laje sob parede,
   fundo de caixilho encostado na alvenaria), que o Cycles devolve como zero. Elas ocupam
   ~80% da área útil. As ilhas iluminadas, com a margem de 4 texels do bake, são copiadas
   TEXEL A TEXEL (mesma densidade, sem reamostrar) para um atlas novo de 2048 x ~1672; as
   escuras passam a apontar para um bloco preto reservado. Mesma imagem, 1/5 dos texels.

2. CODIFICAÇÃO LOGARÍTMICA SEM ALFA. O RGBM guarda o multiplicador no alfa, e é por isso
   que não podia passar por decodificador de imagem nem por compressão em blocos (o alfa
   é pré-multiplicado ou destruído). Aqui cada canal vira t = log2(1 + k·v)/log2(1 + k·R):
   precisão RELATIVA constante (~2,7% por código no pior atlas, 0,5% de erro médio), sem
   alfa, e com faixa R = o máximo medido -- nada é cortado.

3. PREENCHIMENTO PUSH-PULL. Texels fora de qualquer ilha recebem a média suavizada das
   vizinhas. Assim o bloco 4x4 da compressão e os níveis de mipmap não misturam luz com
   preto nas bordas das ilhas.
"""
from pathlib import Path
import gzip, json, struct
import numpy as np
from PIL import Image, ImageDraw

K_LOG = 100.0          # abaixo de 1/K a curva é ~linear; acima, logarítmica
MARGEM = 4             # texels: a margem do bake (`render.bake.margin = 4`)


def le_rgbm(caminho):
    """RGBM do padrão aprovado: cabeçalho uint32 LE (w, h), RGBA8, linha 0 = v 0."""
    bruto = gzip.decompress(Path(caminho).read_bytes())
    w, h = struct.unpack('<II', bruto[:8])
    a = np.frombuffer(bruto, np.uint8, offset=8).reshape(h, w, 4).astype(np.float32)
    faixa = 16.0
    return a[..., :3] / 255 * (a[..., 3:4] / 255 * faixa)


def faixa_de(v):
    """Faixa da codificação: o máximo medido, arredondado para cima em 1/64."""
    return float(np.ceil(max(float(v.max()), 1e-3) * 64) / 64)


def codifica_log(v, faixa):
    t = np.log2(1 + K_LOG * np.clip(v, 0, faixa)) / np.log2(1 + K_LOG * faixa)
    return np.uint8(np.clip(t * 255 + 0.5, 0, 255))


def decodifica_log(u8, faixa):
    t = u8.astype(np.float32) / 255
    return (np.power(2.0, t * np.log2(1 + K_LOG * faixa)) - 1) / K_LOG


def push_pull(img, mascara):
    """Preenche texels fora da máscara com a média hierárquica das vizinhas."""
    niveis = [(img * mascara[..., None], mascara.astype(np.float32))]
    while min(niveis[-1][1].shape) > 1:
        c, w = niveis[-1]
        h2, w2 = (c.shape[0] + 1) // 2, (c.shape[1] + 1) // 2
        cp = np.zeros((h2 * 2, w2 * 2, img.shape[2]), np.float32); cp[:c.shape[0], :c.shape[1]] = c
        wp = np.zeros((h2 * 2, w2 * 2), np.float32); wp[:w.shape[0], :w.shape[1]] = w
        niveis.append((cp.reshape(h2, 2, w2, 2, -1).sum((1, 3)), wp.reshape(h2, 2, w2, 2).sum((1, 3))))
    cor = niveis[-1][0] / np.maximum(niveis[-1][1], 1e-8)[..., None]
    for c, w in reversed(niveis[:-1]):
        cima = np.repeat(np.repeat(cor, 2, 0), 2, 1)[:c.shape[0], :c.shape[1]]
        proprio = c / np.maximum(w, 1e-8)[..., None]
        a = np.clip(w, 0, 1)[..., None]
        cor = proprio * a + cima * (1 - a)
    return np.where(mascara[..., None], img, cor).astype(np.float32)


def reduz_metade(img):
    """Meia resolução por média 2x2 (em irradiância linear, não no código)."""
    h, w = img.shape[:2]
    h2, w2 = h // 2, w // 2
    return img[:h2 * 2, :w2 * 2].reshape(h2, 2, w2, 2, -1).mean((1, 3)).astype(np.float32)


def uv_por_canto(registro):
    return np.asarray(registro['uv1'], np.float64).reshape(-1, 2)


def ilhas(compacto):
    """Ilha (chart) de cada triângulo: cantos com a mesma UV, na mesma entrada, são o mesmo
    vértice do xatlas; triângulos que se tocam por eles são a mesma ilha."""
    por_entrada, total = [], 0
    for e in compacto:
        uv = uv_por_canto(e)
        chave = np.round(uv * 1e7).astype(np.int64)
        _, inv = np.unique(chave[:, 0] * 20_000_000 + chave[:, 1], return_inverse=True)
        pai = np.arange(inv.max() + 1)

        def raiz(x):
            r = x
            while pai[r] != r:
                r = pai[r]
            while pai[x] != r:
                pai[x], x = r, pai[x]
            return r
        tri = inv.reshape(-1, 3)
        for a, b, c in tri:
            ra = raiz(a)
            pai[raiz(b)] = ra
            pai[raiz(c)] = ra
        raizes = np.array([raiz(x) for x in tri[:, 0]])
        _, ilha = np.unique(raizes, return_inverse=True)
        por_entrada.append(ilha + total)
        total += int(ilha.max()) + 1
    return por_entrada, total


def rasteriza_ilhas(compacto, ilha_tri, n):
    """Imagem n x n com o número da ilha em cada texel coberto (-1 fora)."""
    rot = Image.new('I', (n, n), -1)
    d = ImageDraw.Draw(rot)
    for e, ids in zip(compacto, ilha_tri):
        uv = uv_por_canto(e).reshape(-1, 3, 2) * n
        for tri, i in zip(uv, ids):
            d.polygon([tuple(p) for p in tri], fill=int(i), outline=int(i))
    return np.asarray(rot, dtype=np.int32)


def empacota_prateleiras(itens, largura):
    """Empacotamento em prateleiras, por altura decrescente: 93-95% de ocupação aqui."""
    x = y = prat = 0
    pos = {}
    for chave, w, h in itens:
        if x + w > largura:
            y += prat; x = 0; prat = 0
        pos[chave] = (x, y)
        x += w
        prat = max(prat, h)
    return pos, y + prat


def reempacota_exterior(v, compacto, largura=2048):
    """Devolve (atlas_novo, mascara_util, uv1_por_entrada, relatorio)."""
    n = v.shape[0]
    ilha_tri, n_ilhas = ilhas(compacto)
    rot = rasteriza_ilhas(compacto, ilha_tri, n)
    brilho = v.max(-1)
    idx = np.nonzero(rot >= 0)
    ids = rot[idx]
    ordem = np.argsort(ids, kind='stable')
    ids_o, ys, xs, vals = ids[ordem], idx[0][ordem], idx[1][ordem], brilho[idx][ordem]
    lim = np.searchsorted(ids_o, np.arange(n_ilhas + 1))
    acesa = np.zeros(n_ilhas, bool)
    retangulo = {}
    for c in range(n_ilhas):
        s, f = lim[c], lim[c + 1]
        if s == f:
            # ilha menor que um texel: conserva-se, com a margem, pela UV média
            continue
        acesa[c] = vals[s:f].max() > 0
        if acesa[c]:
            retangulo[c] = (int(xs[s:f].min()) - MARGEM, int(ys[s:f].min()) - MARGEM,
                            int(xs[s:f].max()) + MARGEM + 1, int(ys[s:f].max()) + MARGEM + 1)
    # ilhas sem texel próprio: retângulo pela caixa da UV
    for e, ids_e in zip(compacto, ilha_tri):
        uv = uv_por_canto(e).reshape(-1, 3, 2) * n
        for tri, c in zip(uv, ids_e):
            if lim[c] == lim[c + 1] and c not in retangulo:
                x0, y0 = np.floor(tri.min(0)).astype(int); x1, y1 = np.ceil(tri.max(0)).astype(int)
                bloco = brilho[max(0, y0 - 1):y1 + 1, max(0, x0 - 1):x1 + 1]
                if bloco.size and bloco.max() > 0:
                    acesa[c] = True
                    retangulo[c] = (x0 - MARGEM, y0 - MARGEM, x1 + MARGEM, y1 + MARGEM)
    itens = sorted(((c, r[2] - r[0], r[3] - r[1]) for c, r in retangulo.items()), key=lambda t: (-t[2], -t[1]))
    # Bloco preto reservado (8x8) para todas as ilhas apagadas.
    itens.insert(0, ('preto', 8, 8))
    pos, altura = empacota_prateleiras(itens, largura)
    altura = (altura + 3) // 4 * 4
    novo = np.zeros((altura, largura, 3), np.float32)
    util = np.zeros((altura, largura), bool)
    px, py = pos['preto']; util[py:py + 8, px:px + 8] = True
    for c, (dx, dy) in pos.items():
        if c == 'preto':
            continue
        x0, y0, x1, y1 = retangulo[c]
        sx0, sy0, sx1, sy1 = max(0, x0), max(0, y0), min(n, x1), min(n, y1)
        novo[dy + sy0 - y0:dy + sy1 - y0, dx + sx0 - x0:dx + sx1 - x0] = v[sy0:sy1, sx0:sx1]
        util[dy:dy + y1 - y0, dx:dx + x1 - x0] = True
    preto_uv = ((px + 4) / largura, (py + 4) / altura)
    uv_novo = []
    for e, ids_e in zip(compacto, ilha_tri):
        uv = uv_por_canto(e) * n
        out = np.empty_like(uv)
        canto_ilha = np.repeat(ids_e, 3)
        for c in np.unique(canto_ilha):
            sel = canto_ilha == c
            if c in retangulo:
                x0, y0 = retangulo[c][:2]
                dx, dy = pos[c]
                out[sel, 0] = (uv[sel, 0] - x0 + dx) / largura
                out[sel, 1] = (uv[sel, 1] - y0 + dy) / altura
            else:
                out[sel] = preto_uv
        uv_novo.append(out)
    rel = {'ilhas': int(n_ilhas), 'ilhasAcesas': int(acesa.sum()), 'origem': [n, n], 'atlas': [largura, altura],
           'texelsOrigem': n * n, 'texelsAtlas': largura * altura,
           'ocupacao': round(float(util.mean()), 4), 'margem': MARGEM}
    return novo, util, uv_novo, rel


def mascara_cobertura(compacto, n, dilata=2):
    """Texels cobertos pelas ilhas (dilatados): o que o filtro bilinear pode ler."""
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    for e in compacto:
        for tri in uv_por_canto(e).reshape(-1, 3, 2) * n:
            d.polygon([tuple(p) for p in tri], fill=255, outline=255)
    m = np.asarray(img) > 0
    for _ in range(dilata):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


def prepara(v, mascara, faixa, destino_base):
    """Grava os RGBA8 (log) de resolução cheia e metade, prontos para o codificador KTX2."""
    cheio = push_pull(v, mascara | (v.max(-1) > 0))
    metade = reduz_metade(cheio)
    saidas = {}
    for nome, img in [('cheia', cheio), ('metade', metade)]:
        t = codifica_log(img, faixa)
        rgba = np.dstack([t, np.full(t.shape[:2], 255, np.uint8)])
        caminho = Path(f'{destino_base}-{nome}.rgba')
        caminho.write_bytes(rgba.tobytes())
        saidas[nome] = {'arquivo': caminho.name, 'largura': int(t.shape[1]), 'altura': int(t.shape[0])}
    return saidas
