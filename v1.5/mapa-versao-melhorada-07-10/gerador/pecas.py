"""Separa a pagina do mapa em PECAS, a partir da montagem oficial do pipeline.

    python gerador/pecas.py [--saida derivados/_tmp/pecas] [--carimbo "..."]

A pagina de hoje e um HTML unico de 14 MB (`pipeline/montar.py`): cabeca, blocos de dado
em JSON, three.js, CSS, corpo e o programa, tudo junto. A versao nova serve essas mesmas
pecas como ARQUIVOS (cada um com hash no nome e cache de um ano), e para isso precisa
delas separadas. Em vez de reescrever a montagem dos blocos (encaixes, exteriores,
cadastrados, recorte...), este script chama o `montar.monta()` do pipeline com a FONTE
desta pasta e corta o resultado. Assim o dado que vai ao navegador e, byte a byte, o
mesmo da pagina oficial.

Duas protecoes:
- nenhuma escrita no repositorio fora de `derivados/` desta pasta. O `compile_placements`
  regrava o cache de encaixes quando o hash nao bate; aqui isso vira erro, nao efeito
  colateral (ver PLANO.md, restricoes);
- a variante continua sendo `v16-moveis` para o pipeline, mas a fonte e a desta pasta, sem
  registrar variante nova (`VARIANTES` e `V_PADRAO` sao travados por teste).
"""
import argparse, builtins, hashlib, io, json, os, pathlib, re, sys, time

AQUI = pathlib.Path(__file__).resolve().parent
PASTA = AQUI.parent
RAIZ = PASTA.parents[1]
LIVRE = (PASTA / 'derivados').resolve()


def protege_repositorio():
    """Bloqueia escrita no repositorio, exceto em `derivados/` desta pasta."""
    raiz = str(RAIZ.resolve()) + os.sep

    def guarda(p):
        p = pathlib.Path(p).resolve()
        s = str(p)
        if s.startswith(raiz) and not str(p).startswith(str(LIVRE) + os.sep):
            raise RuntimeError('escrita bloqueada no repositorio: ' + s)

    wt, wb, op = pathlib.Path.write_text, pathlib.Path.write_bytes, builtins.open

    def write_text(self, *a, **k): guarda(self); return wt(self, *a, **k)
    def write_bytes(self, *a, **k): guarda(self); return wb(self, *a, **k)
    def abre(f, mode='r', *a, **k):
        if any(c in mode for c in 'wax+') and isinstance(f, (str, os.PathLike)):
            guarda(f)
        return op(f, mode, *a, **k)

    pathlib.Path.write_text, pathlib.Path.write_bytes = write_text, write_bytes
    builtins.open = io.open = abre


class Config:
    """O que `montar.monta()` e `build/*` leem de um BuildConfig, com a fonte desta pasta."""
    def __init__(self, slug='sao-carlos'):
        from pipeline.build.config import resolve
        self._base = resolve(slug, 'v16-moveis')
        self.slug, self.versao, self.destino = self._base.slug, self._base.versao, None
        self.fonte = PASTA / 'fonte'

    def cidade(self):
        return self._base.cidade()

    def saida(self, chave, cid=None):
        return self._base.saida(chave, cid)


# Pecas na ordem em que `montar.monta()` as junta. Os blocos JSON escapam `</` como `<\/`,
# entao o primeiro `</script>` depois da abertura e o fim do bloco.
RE = re.compile(r'<script type="application/json" id="([^"]+)">(.*?)</script>\n'
                r'|<script>(.*?)</script>\n?'
                r'|<style>(.*?)</style>\n', re.S)


def separa(html):
    pecas, blocos, scripts, estilos = [], {}, [], []
    pos = 0
    for m in RE.finditer(html):
        if m.start() > pos:
            pecas.append({'tipo': 'html', 'texto': html[pos:m.start()]})
        if m.group(1):
            blocos[m.group(1)] = m.group(2).replace('<\\/', '</')
            pecas.append({'tipo': 'bloco', 'id': m.group(1)})
        elif m.group(3) is not None:
            scripts.append(m.group(3))
            pecas.append({'tipo': 'script', 'n': len(scripts) - 1})
        else:
            estilos.append(m.group(4))
            pecas.append({'tipo': 'estilo', 'n': len(estilos) - 1})
        pos = m.end()
    if pos < len(html):
        pecas.append({'tipo': 'html', 'texto': html[pos:]})
    return pecas, blocos, scripts, estilos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--saida', default=str(PASTA / 'derivados' / '_tmp' / 'pecas'))
    ap.add_argument('--carimbo')
    a = ap.parse_args()
    os.chdir(RAIZ)
    sys.path.insert(0, str(RAIZ))
    protege_repositorio()
    from pipeline import montar
    t0 = time.time()
    cfg = Config()
    carimbo = a.carimbo or 'sao-carlos / mapa v2 / %s' % time.strftime('%Y-%m-%d %H:%M')
    html = montar.monta(carimbo=carimbo, config=cfg)
    pecas, blocos, scripts, estilos = separa(html)
    # O ultimo script e o PROGRAMA (modules.json); os dois primeiros, three e earcut.
    if len(scripts) != 3 or 'REVISION' not in scripts[0]:
        raise SystemExit('montagem inesperada: %d scripts' % len(scripts))
    out = pathlib.Path(a.saida)
    (out / 'blocos').mkdir(parents=True, exist_ok=True)
    for k, v in blocos.items():
        (out / 'blocos' / (k + '.json')).write_text(v, encoding='utf-8', newline='')
    for n, nome in enumerate(['three.min.js', 'earcut.min.js', 'programa.js']):
        (out / nome).write_text(scripts[n], encoding='utf-8', newline='')
    (out / 'estilo.css').write_text(''.join(estilos), encoding='utf-8', newline='')
    manifesto = {'carimbo': carimbo, 'pecas': pecas,
                 'blocos': {k: {'bytes': len(v.encode()), 'sha256': hashlib.sha256(v.encode()).hexdigest()}
                            for k, v in blocos.items()},
                 'pagina_sha256': hashlib.sha256(html.encode()).hexdigest(),
                 'segundos': round(time.time() - t0, 1)}
    (out / 'pecas.json').write_text(json.dumps(manifesto, ensure_ascii=False, indent=1), encoding='utf-8')
    print('pecas: %d blocos, %.2f MB de dado, em %.1f s -> %s' % (
        len(blocos), sum(len(v.encode()) for v in blocos.values()) / 1e6, time.time() - t0, out))


if __name__ == '__main__':
    main()
