# -*- coding: utf-8 -*-
"""Prova que a pagina comprimida abre com DUPLO CLIQUE, e nao so por servidor.

O caminho medido e o do usuario: clicar no item da vitrine abre a FICHA do imovel, e o
botao dela e que entra na visita 3D (ate o v12 o clique entrava sozinho).

`file://` e um ambiente diferente de `http://`: origem opaca, `fetch` bloqueado, e o
carregador da pagina comprimida (montar.py:CARREGADOR) depende de
`DecompressionStream` mais injecao de <script> em runtime. Nada disso e exercitado
quando se testa por localhost -- e foi exatamente assim que o v5 foi entregue "pronto"
sem abrir por duplo clique.

    python pipeline/testa_duplo_clique.py                  # todas as cidades da versao atual
    python pipeline/testa_duplo_clique.py ribeirao-preto   # so uma

Sai 1 se alguma pagina nao chegar a montar o interior.
"""
import io, json, os, subprocess, sys, tempfile, shutil

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
# A versao tem UM dono: o montar.py, que e quem escreve a pagina. Ate o v9 ela estava
# escrita aqui tambem, e o teste do v10 saiu aprovando as paginas do v9 -- o mesmo
# conceito em dois lugares que o PADRAO.md existe pra matar, so que em miniatura.
from pipeline.montar import VERSAO
PASTA = os.path.join(RAIZ, VERSAO)

SONDA = """
<script>
(function esperar(n) {
  if (!window.__int || !window.__int.grupos().length) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('SONDA {"erro":"o programa nunca subiu (window.__int ausente)"}');
    return;
  }
  var I = window.__int;
  // so o item com interior cadastrado; anuncio de vitrine antiga so voa.
  var itens = document.querySelectorAll("#houses .hitem[data-unidade]");
  var base = { cidade: (document.querySelector("#hud h1")||{}).textContent,
               vitrine: itens.length, unidades: I.UNIDADES.length };
  if (!itens.length) { base.nota = "sem unidade cadastrada nesta cidade";
                       console.log("SONDA " + JSON.stringify(base)); return; }
  // v13: o clique na vitrine para na FICHA (metragem, comodos, "o que tem por perto")
  // e a visita 3D virou um botao dela. O caminho ate o interior tem um passo a mais --
  // e e esse passo que este teste passa a exercitar, porque e o que o usuario faz.
  itens[0].click();                       // voa ate o predio e abre a ficha
  base.ficha = document.getElementById("usheet").classList.contains("on");
  document.getElementById("uEnter").click();
  setTimeout(function () {
    var pl = I.INT.pl;
    base.entrou = !!I.INT.on;
    base.unidade = pl && pl.id;
    base.comodos = pl ? pl.comodos.length : 0;
    base.paredes = pl ? pl.paredes.length : 0;
    base.moveis = I.INT.moveis.length;
    base.malhas = I.INT.casa ? I.INT.casa.children.length : 0;
    base.furo = I.uFuro.value.z > 0;
    console.log("SONDA " + JSON.stringify(base));
  }, 3000);
})(120);
</script>
"""


def testa(html):
    s = io.open(html, encoding="utf-8", newline="").read() + SONDA
    tmp = html + ".sonda.html"
    png = html + ".sonda.png"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="dc")
    try:
        r = subprocess.run(
            [CHROME, "--headless=new", "--user-data-dir=" + ud,
             "--window-size=1100,700", "--use-angle=swiftshader",
             "--enable-unsafe-swiftshader", "--hide-scrollbars",
             # sem --screenshot a aba nao compoe frame e o rAF fica estrangulado:
             # o streaming nunca roda e o interior nunca monta. Ver a nota do v5.
             "--screenshot=" + png, "--virtual-time-budget=90000",
             "--enable-logging=stderr", "--log-level=0",
             "file:///" + tmp.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        for f in (tmp, png):
            try: os.remove(f)
            except OSError: pass
    for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
        if "SONDA " in ln:
            try:
                return json.JSONDecoder().raw_decode(ln[ln.index("SONDA ") + 6:])[0]
            except Exception:
                pass
    return None


def main():
    if not os.path.exists(CHROME):
        print("Chrome nao encontrado em %s (defina a variavel CHROME)" % CHROME)
        return 2
    alvos = sys.argv[1:]
    if not os.path.isdir(PASTA):
        print("nao existe %s -- rode o pipeline/montar.py antes" % PASTA)
        return 2
    arquivos = sorted(f for f in os.listdir(PASTA)
                      if f.endswith("-%s.html" % VERSAO)
                      and (not alvos or any(a in f for a in alvos)))
    if not arquivos:
        print("nenhuma pagina encontrada para %s em %s -- rode o montador antes"
              % (", ".join(alvos) or VERSAO, PASTA))
        return 2
    ruim = 0
    for f in arquivos:
        p = os.path.join(PASTA, f)
        mb = os.path.getsize(p) / 1e6
        d = testa(p)
        if not d:
            print("  FALHOU  %-34s %5.1f MB  a sonda nao respondeu" % (f, mb)); ruim += 1
        elif d.get("erro"):
            print("  FALHOU  %-34s %5.1f MB  %s" % (f, mb, d["erro"])); ruim += 1
        elif not d.get("vitrine"):
            print("  ok      %-34s %5.1f MB  abriu | %s" % (f, mb, d.get("nota", "")))
        elif not d.get("ficha"):
            print("  FALHOU  %-34s %5.1f MB  abriu mas a ficha do imovel nao abriu"
                  % (f, mb)); ruim += 1
        elif not d.get("entrou"):
            print("  FALHOU  %-34s %5.1f MB  a ficha abriu mas o botao nao entrou no imovel"
                  % (f, mb)); ruim += 1
        else:
            print("  ok      %-34s %5.1f MB  abriu e entrou em %s: %d comodos, %d paredes,"
                  " %d moveis, furo=%s"
                  % (f, mb, d["unidade"], d["comodos"], d["paredes"], d["moveis"], d["furo"]))
    print("\n%d de %d paginas prontas pra duplo clique" % (len(arquivos) - ruim, len(arquivos)))
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())
