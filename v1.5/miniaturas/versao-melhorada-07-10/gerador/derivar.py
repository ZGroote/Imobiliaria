"""Deriva, de um imóvel PREMIUM já aprovado, os dados no formato da v4.

Entrada (nada disto é alterado): o template aprovado (`v2.html`, só pelos blocos de
dados), os lightmaps RGBM e as UVs de luz (`geometry-compact.json`). Saída, em
`derivados/<imovel>/` (versionada no git, para publicar não exigir codificador):

    predio.bin            malhas do Blender do exterior        (gerador/binario.py)
    exterior-uv.bin       UVs de luz do exterior, indexadas, no atlas reempacotado
    interior-uv.bin       UVs de luz do interior
    exterior-luz-{cheia,metade}.ktx2, interior-luz-{cheia,metade}.ktx2   (UASTC)
    imovel.json, moveis.json, luzue.json                       (os blocos do template)
    luz.json              faixa e constante da codificação, para o shader
    relatorio.json        tamanhos, ocupação do atlas e erro medido da compressão

É idempotente e tem cache: se nenhuma entrada nem o código do gerador mudou
(`fontes.json`), não refaz nada. A etapa cara é a codificação UASTC (~1 min por atlas).
"""
from pathlib import Path
import hashlib, json, re, shutil, subprocess, sys, time
import numpy as np

AQUI = Path(__file__).resolve().parent
PASTA = AQUI.parent
sys.path.insert(0, str(AQUI))
import luz, binario  # noqa: E402

NODE = shutil.which('node') or 'node'


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def bloco_json(html, ident):
    m = re.search(r'<script id="%s" type="application/json">(.*?)</script>' % re.escape(ident), html, re.S)
    if not m:
        raise SystemExit(f'template sem o bloco {ident}')
    return m.group(1)


def asset_blender(html):
    i = html.index('var CASTANHEIRAS_BLENDER = ') + len('var CASTANHEIRAS_BLENDER = ')
    obj, _ = json.JSONDecoder().raw_decode(html, i)
    return obj


def codifica_ktx2(raw, w, h, destino):
    r = subprocess.run([NODE, str(AQUI / 'codificar_ktx2.mjs'), str(raw), str(w), str(h), str(destino)],
                       cwd=PASTA, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-2000:])
    return json.loads(r.stdout.strip().splitlines()[-1])


def erro_ktx2(ktx, v_ref, mascara, faixa, tmp):
    """Decodifica o nível 0 com o MESMO transcodificador do navegador (three r168) e mede o
    erro contra a irradiância de origem, na tela: códigos sRGB depois do ACES."""
    saida = Path(tmp)
    r = subprocess.run([NODE, str(AQUI / 'decodificar_ktx2.mjs'), str(ktx), str(saida)], cwd=PASTA,
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-2000:])
    info = json.loads(r.stdout.strip().splitlines()[-1])
    dec = np.fromfile(saida, np.uint8).reshape(info['altura'], info['largura'], 4)[..., :3]
    saida.unlink()
    if dec.shape[:2] != v_ref.shape[:2]:
        return {'formato': info['formato']}
    vv = luz.decodifica_log(dec, faixa)
    ref = np.clip(v_ref, 0, faixa)

    def tela(x):
        a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
        x = x * np.pi * 0.7 * 1.02
        y = np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1)
        return np.round(np.where(y <= 0.0031308, 12.92 * y, 1.055 * np.power(y, 1 / 2.4) - 0.055) * 255)
    m = mascara
    dif = np.abs(tela(vv) - tela(ref))[m]
    rel = np.abs(vv - ref)[m] / np.maximum(ref[m], 0.02)
    return {'formatoDecodificado': info['formato'], 'codigosTelaMedio': round(float(dif.mean()), 3),
            'codigosTelaP99': float(np.percentile(dif, 99)), 'codigosTelaP999': float(np.percentile(dif, 99.9)),
            'erroRelativoMedio': round(float(rel.mean()), 4), 'texelsMedidos': int(m.sum())}


# Saídas da derivação. As duas de resolução cheia passam de 1 MiB e não são versionadas
# (trava de tamanho do repositório); `conferencia.json` guarda o SHA-256 de todas, e a
# codificação é determinística: regenerar dá os mesmos bytes, e isto confere.
SAIDAS = ['predio.bin', 'exterior-uv.bin', 'interior-uv.bin', 'exterior-luz-cheia.ktx2', 'exterior-luz-metade.ktx2',
          'interior-luz-cheia.ktx2', 'interior-luz-metade.ktx2', 'imovel.json', 'moveis.json', 'luzue.json', 'luz.json']


def confere(destino):
    arq = destino / 'conferencia.json'
    atual = {f: sha(destino / f) for f in SAIDAS if (destino / f).exists()}
    if arq.exists():
        antes = json.loads(arq.read_text())
        dif = sorted(f for f in atual if f in antes and antes[f] != atual[f])
        if dif:
            print('ATENÇÃO: saída diferente da versionada em conferencia.json:', ', '.join(dif),
                  '\n  (mudou a entrada ou a versão do codificador; confira e versione a conferência nova)')
        else:
            print('conferência: todas as saídas iguais às versionadas', flush=True)
    arq.write_text(json.dumps(atual, indent=2), encoding='utf8')


def derivar(config_path, forcar=False):
    cfg = json.loads(Path(config_path).read_text(encoding='utf8'))
    base = Path(config_path).resolve().parent.parent
    fonte = lambda rel: (base / rel).resolve()
    destino = PASTA / 'derivados' / cfg['id']
    destino.mkdir(parents=True, exist_ok=True)
    entradas = {k: fonte(v) for k, v in [('modelo', cfg['modelo']), ('exteriorLuz', cfg['exterior']['luz']),
                ('exteriorUV', cfg['exterior']['uv']), ('interiorLuz', cfg['interior']['luz']),
                ('interiorUV', cfg['interior']['uv'])]}
    codigo = {p.name: sha(p) for p in [AQUI / 'luz.py', AQUI / 'binario.py', AQUI / 'derivar.py',
                                       AQUI / 'codificar_ktx2.mjs']}
    marca = {'entradas': {k: sha(p) for k, p in entradas.items()}, 'codigo': codigo,
             'config': hashlib.sha256(json.dumps(cfg, sort_keys=True).encode()).hexdigest()}
    marca_arq = destino / 'fontes.json'
    faltando = [f for f in SAIDAS if not (destino / f).exists()]
    if not forcar and not faltando and marca_arq.exists() and json.loads(marca_arq.read_text()) == marca:
        print('derivados em dia:', destino)
        return destino
    if faltando:
        print('faltam (não versionados ou apagados):', ', '.join(faltando), flush=True)
    t0 = time.time()
    rel_arq = destino / 'relatorio.json'
    rel_antigo = json.loads(rel_arq.read_text(encoding='utf8')) if rel_arq.exists() else {}
    rel = {'imovel': cfg['id'], 'padrao': cfg.get('padrao')}
    html = entradas['modelo'].read_text(encoding='utf8')
    (destino / 'imovel.json').write_text(bloco_json(html, '__imovel'), encoding='utf8')
    (destino / 'moveis.json').write_text(bloco_json(html, '__moveis'), encoding='utf8')
    (destino / 'luzue.json').write_text(bloco_json(html, '__luzue'), encoding='utf8')
    asset = asset_blender(html)
    rel['predio'] = binario.grava_predio(asset, destino / 'predio.bin')
    meta_luz = {}
    tmp = destino / '_tmp'
    tmp.mkdir(exist_ok=True)
    try:
        for parte in ['exterior', 'interior']:
            print(f'[{parte}] lendo luz e UVs...', flush=True)
            v = luz.le_rgbm(entradas[parte + 'Luz'])
            compacto = json.loads(entradas[parte + 'UV'].read_text())
            info = {'origem': list(v.shape[:2][::-1])}
            if cfg[parte].get('reempacotar'):
                print(f'[{parte}] reempacotando o atlas...', flush=True)
                v, mascara, uv_novo, rep = luz.reempacota_exterior(v, compacto)
                info['reempacotamento'] = rep
                rel[parte + 'UV'] = binario.grava_uv_exterior(compacto, uv_novo, asset, destino / f'{parte}-uv.bin')
            else:
                mascara = luz.mascara_cobertura(compacto, v.shape[0])
                rel[parte + 'UV'] = binario.grava_uv_interior(compacto, destino / f'{parte}-uv.bin')
            faixa = luz.faixa_de(v)
            meta_luz[parte] = {'k': luz.K_LOG, 'faixa': faixa}
            print(f'[{parte}] preenchendo bordas e codificando (faixa {faixa})...', flush=True)
            prontos = luz.prepara(v, mascara, faixa, tmp / parte)
            cobertos = mascara & (v.max(-1) >= 0)
            for res, p in prontos.items():
                ktx = destino / f'{parte}-luz-{res}.ktx2'
                chave = sha(tmp / p['arquivo']) + '|' + sha(AQUI / 'codificar_ktx2.mjs')
                anterior = (rel_antigo.get(parte + 'Luz') or {}).get(res) or {}
                if ktx.exists() and anterior.get('chave') == chave:
                    print(f'[{parte}] UASTC {res}: igual ao anterior, reaproveitado', flush=True)
                    info[res] = anterior
                    continue
                print(f'[{parte}] UASTC {res} {p["largura"]}x{p["altura"]}...', flush=True)
                info[res] = {**codifica_ktx2(tmp / p['arquivo'], p['largura'], p['altura'], ktx),
                             'largura': p['largura'], 'altura': p['altura'], 'chave': chave}
                info[res].pop('saida', None)
                if res == 'cheia':
                    info[res]['erro'] = erro_ktx2(ktx, v, cobertos, faixa, tmp / 'dec.rgba')
                    info[res]['chave'] = chave
            rel[parte + 'Luz'] = info
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    (destino / 'luz.json').write_text(json.dumps(meta_luz, indent=2), encoding='utf8')
    confere(destino)
    rel['segundos'] = round(time.time() - t0, 1)
    (destino / 'relatorio.json').write_text(json.dumps(rel, indent=2, ensure_ascii=False), encoding='utf8')
    marca_arq.write_text(json.dumps(marca, indent=2), encoding='utf8')
    print('derivados prontos em', round(time.time() - t0), 's:', destino)
    return destino


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    cfg = args[0] if args else PASTA / 'imoveis' / 'monte-dos-cedros-37.json'
    derivar(cfg, forcar='--forcar' in sys.argv)
