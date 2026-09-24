# -*- coding: utf-8 -*-
"""Serializacao da pagina: compressao dos blocos, o carregador que os desempacota e a
comparacao peca a peca entre duas montagens.

O `monta()` escreve a pagina ABERTA. O que esta aqui e o passo seguinte -- trocar cada
bloco por deflate cru em base64 e pendurar o carregador no fim -- mais o `confere()`,
que e o aceite da migracao do build: montar de novo tem que reproduzir a pagina de onde
as pecas sairam, e a unica coisa que pode diferir e o carimbo do HUD.
"""
import base64
import io
import os
import re
import zlib

from .blocos import DADOS
from .config import RAIZ

CARIMBO = re.compile(r'(<div class="sub" id="build"[^>]*>)[^<]*(</div>)')


# ---- compressao (o que o make_v8 fazia) -------------------------------------
def comprime(s):
    """Cada bloco embutido vira deflate cru + base64 e volta no boot por
    DecompressionStream("deflate-raw") -- nativo, sem biblioteca de inflate.

    A descompressao e assincrona e o renderizador e um <script> classico que monta
    chao/rua/muro no meio da pagina. Em vez de reescrever aquilo em async, o PROPRIO
    programa vira um pacote comprimido e e injetado como <script> depois que os dados
    chegaram. Por isso o carregador vai no FIM: ele varre script[data-zip], que
    precisam ja estar parseados."""
    pedacos = []
    for ident, _ in DADOS:
        abre = '<script type="application/json" id="%s">' % ident
        i = s.index(abre); j = s.index("</script>", i)
        pedacos.append((s[i:j + 9], s[i + len(abre):j], "json", ident))
    # As bibliotecas e o app tambem vao comprimidos -- three.js sozinho e 589 KB, e
    # deixar so os dados comprimidos custava 0,4 MB de pagina a mais. Sao os tres
    # <script> SEM atributo, em ordem: three, earcut, app. O `__cidade` fica de fora
    # (o app le ele na inicializacao, antes de qualquer descompactacao).
    abre_urban = '<script type="application/json" id="__urbanModels">'
    if abre_urban in s:
        i = s.index(abre_urban); j = s.index("</script>", i)
        pedacos.append((s[i:j + 9], s[i + len(abre_urban):j], "json", "__urbanModels"))
    abre_exterior = '<script type="application/json" id="__exteriorModels">'
    if abre_exterior in s:
        i = s.index(abre_exterior); j = s.index("</script>", i)
        pedacos.append((s[i:j + 9], s[i + len(abre_exterior):j], "json", "__exteriorModels"))
    abre_listing = '<script type="application/json" id="__listingModels">'
    if abre_listing in s:
        i = s.index(abre_listing); j = s.index("</script>", i)
        pedacos.append((s[i:j + 9], s[i + len(abre_listing):j], "json", "__listingModels"))
    anon = [m for m in re.finditer(r"<script>", s)]
    if len(anon) != 3:
        raise SystemExit("esperava 3 <script> sem atributo; achei %d" % len(anon))
    for n, m in enumerate(anon):
        j = s.index("</script>", m.end())
        pedacos.append((s[m.start():j + 9], s[m.end():j], "js",
                        ["__three", "__earcut", "__app"][n]))
    for k, (bruto, corpo, tipo, ident) in enumerate(pedacos):
        z = base64.b64encode(zlib.compress(corpo.encode("utf-8"), 9)[2:-4]).decode()
        s = s.replace(bruto, '<script type="text/plain" data-zip="%s" id="%s">%s</script>'
                      % (tipo, ident, z), 1)
        print("      %-14s %7.2f MB -> %6.2f MB" % (ident, len(corpo) / 1e6, len(z) / 1e6))
    return s + CARREGADOR


CARREGADOR = """
<script>
// Desempacota os blocos e SO ENTAO injeta o programa. Ver montar.py:comprime().
(async function () {
  const de64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function inflar(b64) {
    const st = new DecompressionStream("deflate-raw");
    const r = new Response(new Blob([de64(b64)]).stream().pipeThrough(st));
    return await r.text();
  }
  // Ordem do documento: os blocos de dado vem antes das bibliotecas, e o app e o
  // ultimo. Descompacta tudo primeiro, DEPOIS executa os js na mesma ordem -- three e
  // earcut tem que estar de pe antes da primeira linha do app rodar.
  const zips = [...document.querySelectorAll("script[data-zip]")];
  const js = [];
  for (const el of zips) {
    const txt = await inflar(el.textContent.trim());
    if (el.dataset.zip === "js") { js.push(txt); continue; }
    const t = document.createElement("script");
    t.type = "application/json"; t.id = el.id; t.textContent = txt;
    el.replaceWith(t);
  }
  for (const src of js) {
    const t = document.createElement("script"); t.textContent = src;
    document.body.appendChild(t);
  }
})();
</script>
"""


def blocos(t):
    """Quebra uma pagina montada nos blocos de topo, pra comparar peca a peca.

    Os blocos anonimos sao nomeados por PAPEL (three/earcut/app/css), nao por posicao:
    numerar por ordem faz o `__cidade` novo deslocar todos os indices e a comparacao
    vira ruido -- foi o que aconteceu na primeira tentativa."""
    fora = []; dentro = {}; ant = 0; anon = []
    for m in re.finditer(r"<(script|style)([^>]*)>", t):
        tag = m.group(1); fim = t.index("</%s>" % tag, m.end())
        corpo = t[m.end():fim]
        ident = re.search(r'id="([^"]+)"', m.group(2))
        if ident: dentro[ident.group(1)] = corpo
        elif tag == "style": dentro["css"] = corpo
        else: anon.append(corpo)
        fora.append(t[ant:m.start()]); ant = fim + len(tag) + 3
    fora.append(t[ant:])
    # o ULTIMO anonimo e sempre o app; dos anteriores, o que cita earcut e o earcut.
    # (Detectar por "THREE" no inicio nao funciona: o proprio app usa THREE nas
    # primeiras linhas e as duas pecas colidiam na mesma chave.)
    if anon:
        dentro["app"] = anon[-1]
        for c in anon[:-1]:
            dentro["lib:earcut" if "earcut" in c[:400] else "lib:three"] = c
    return fora, dentro


def confere(montado, alvo):
    """Aceite da migracao. Compara PECA A PECA, nao a string inteira.

    A concatenacao nao bate byte a byte por um motivo inerte: o HTML antigo tinha
    linha em branco entre alguns blocos de topo e nao entre outros -- acidente do
    historico de patches, nao significado. O que precisa bater exatamente e o
    CONTEUDO de cada bloco (three.js, earcut, css, os 6 blocos de dado e o
    renderizador) e o markup fora deles a menos de espaco em branco."""
    o = io.open(alvo, encoding="utf-8", newline="").read()
    sem_carimbo = lambda t: CARIMBO.sub(lambda m: m.group(1) + "CARIMBO" + m.group(2), t)
    fa, da = blocos(sem_carimbo(montado)); fb, db = blocos(sem_carimbo(o))
    ruim = 0
    if set(da) != set(db):
        print("blocos diferentes: so no montado %s | so no alvo %s"
              % (sorted(set(da) - set(db)), sorted(set(db) - set(da)))); ruim += 1
    for k in sorted(set(da) & set(db)):
        igual = da[k] == db[k]
        print("  %-14s %9.1f KB  %s" % (k, len(da[k]) / 1024, "identico" if igual else "DIFERE"))
        if not igual: ruim += 1
    ma = "".join(fa).split(); mb = "".join(fb).split()
    if ma == mb:
        print("  %-14s %9s      identico (a menos de espaco em branco)" % ("markup", ""))
    else:
        import difflib
        d = [l for l in difflib.unified_diff(mb, ma, "alvo", "montado", n=0, lineterm="")]
        print("  %-14s %9s      DIFERE em %d palavra(s):" % ("markup", "", len([x for x in d if x[:1] in "+-"]) - 2))
        for l in d[2:14]: print("      %s" % l)
        ruim += 1
    if ruim:
        print("\n%d peca(s) divergente(s)." % ruim); return 1
    print("\nTodas as pecas identicas a %s." % os.path.relpath(alvo, RAIZ))
    print("So mudou espaco em branco entre blocos de topo (inerte em HTML).")
    return 0
