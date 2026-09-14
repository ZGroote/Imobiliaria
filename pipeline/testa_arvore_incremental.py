# -*- coding: utf-8 -*-
"""O remendo da arborizacao devolve o MESMO conjunto que a reconstrucao completa?

A partir do v11 (4.2) a arborizacao e remendada quando um quarteirao entra ou sai, em
vez de refeita inteira. Isso e exatamente a classe de mudanca que o v10 evitou de
proposito: indice defasado nao da erro, da arvore no lugar errado, arvore fantasma ou
arvore que sumiu -- e nada disso aparece num teste de "abriu?".

A sonda estressa o caminho do remendo e, depois de cada rodada, chama
`__perf.confereArvores()`, que roda o caminho COMPLETO num rascunho e compara planta a
planta (especie, posicao, escala e giro) mais a contagem de cada InstancedMesh.

O estressador e o RAIO do streaming, nao o passeio: encolher o raio derruba dezenas de
quarteiroes de uma vez sem mexer no alvo -- e mexer no alvo mais de 200 m cai de volta
no caminho completo, que e justamente o que nao se quer testar aqui.

    python pipeline/testa_arvore_incremental.py                  # todas as cidades
    python pipeline/testa_arvore_incremental.py ribeirao-preto

Sai 1 se o remendo divergir.
"""
import io, json, os, subprocess, sys, tempfile, shutil

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.montar import VERSAO
from padrao.cidade import lista

PASTA = os.path.join(RAIZ, VERSAO)

SONDA = """
<script>
(function () {
  var R = { rodadas: [] };
  function fim(e) { if (e) R.erro = e; console.log("ARVI " + JSON.stringify(R)); }
  (function esperar(n) {
    if (!window.__int || !window.__int.grupos().length) {
      if (n > 0) return setTimeout(function () { esperar(n - 1); }, 300);
      return fim("o programa nunca subiu");
    }
    var I = window.__int, P = window.__perf;
    if (!P.confereArvores) return fim("esta pagina nao tem __perf.confereArvores");
    function drena() { for (var k = 0; k < 90 && P.bombeia(4000); k++) P.passo();
                       P.passo(); P.passo(); }
    function conta() {
      var n = 0;
      P.scene.traverse(function (o) {
        if (o.isInstancedMesh && o.parent && o.parent.name === "arvores") n += o.count;
      });
      return n;
    }
    I.target.set(0, 0, 0); I.sph.set(420, 1.2, 0.55);
    drena();
    R.arvores_inicial = conta();
    R.vivos_inicial = I.vivos().size;

    // Cada rodada: mexe no conjunto vivo SEM passar dos 200 m de alvo (senao cai no
    // caminho completo), deixa o remendo rodar, e cobra a igualdade.
    var passos = [
      ["encolhe raio 800",  function () { P.setStreamRadius(800); }],
      ["cresce raio 1600",  function () { P.setStreamRadius(1600); }],
      ["anda 150 m",        function () { I.target.x += 150; }],
      ["encolhe raio 900",  function () { P.setStreamRadius(900); }],
      ["anda -150 m",       function () { I.target.x -= 150; }],
      ["cresce raio 1800",  function () { P.setStreamRadius(1800); }]
    ];
    for (var i = 0; i < passos.length; i++) {
      passos[i][1]();
      drena();
      var antes = conta();
      var c = P.confereArvores();
      R.rodadas.push({ passo: passos[i][0], arvores: antes, ok: c.ok,
                       remendo: c.remendo, completo: c.completo,
                       faltando: c.faltando, sobrando: c.sobrando, contaOk: c.contaOk,
                       diag: c.diag });
    }
    R.arvores_final = conta();
    R.ok = R.rodadas.every(function (r) { return r.ok; });
    fim();
  })(120);
})();
</script>
"""


def roda(html, q):
    html = os.path.abspath(html)
    s = io.open(html, encoding="utf-8", newline="").read() + SONDA
    tmp = html + ".arvi.html"
    png = html + ".arvi.png"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="ai")
    try:
        r = subprocess.run(
            [CHROME, "--headless=new", "--user-data-dir=" + ud,
             "--window-size=1100,700", "--use-angle=swiftshader",
             "--enable-unsafe-swiftshader", "--hide-scrollbars",
             "--screenshot=" + png, "--virtual-time-budget=180000",
             "--enable-logging=stderr", "--log-level=0",
             "file:///" + tmp.replace("\\", "/") + "?q=" + q],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        for f in (tmp, png):
            try: os.remove(f)
            except OSError: pass
    for ln in ((r.stderr or "") + (r.stdout or "")).splitlines():
        if "ARVI " in ln:
            try:
                return json.JSONDecoder().raw_decode(ln[ln.index("ARVI ") + 5:])[0]
            except Exception:
                pass
    return None


def main():
    if not os.path.exists(CHROME):
        # 2 = "nao deu pra medir", diferente de 1 = "medi e reprovou". O portao de
        # comportamento le esse codigo: sem a distincao, maquina sem Chrome reprovaria
        # o build inteiro em vez de dizer que nao mediu.
        print("Chrome nao encontrado em %s (defina CHROME=)" % CHROME); return 2
    slugs = sys.argv[1:] or lista()
    ruim = 0
    for slug in slugs:
        html = os.path.join(PASTA, "%s-%s-aberto.html" % (slug, VERSAO))
        if not os.path.exists(html):
            print("  --      %-24s sem pagina montada" % slug); ruim += 1; continue
        d = roda(html, "alto")
        if not d or d.get("erro"):
            print("  XX      %-24s %s" % (slug, (d or {}).get("erro", "sem resposta")))
            ruim += 1; continue
        mau = [r for r in d["rodadas"] if not r["ok"]]
        print("  %s      %-24s %d arvores, %d rodada(s)%s"
              % ("XX" if mau else "ok", slug, d.get("arvores_inicial", 0),
                 len(d["rodadas"]),
                 "" if not mau else "  DIVERGIU: " + ", ".join(
                     "%s (faltando %d, sobrando %d, conta %s)"
                     % (r["passo"], r["faltando"], r["sobrando"], r["contaOk"]) for r in mau)))
        for r in d["rodadas"]:
            print("           %-18s remendo %5d  completo %5d  %s  %s"
                  % (r["passo"], r["remendo"], r["completo"],
                     "ok" if r["ok"] else "XX", r.get("diag")))
        if mau: ruim += 1
    print("")
    print("%d cidade(s) com remendo divergente." % ruim if ruim
          else "O remendo bate com a reconstrucao completa em todas.")
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())
