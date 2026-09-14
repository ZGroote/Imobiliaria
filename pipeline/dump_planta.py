# -*- coding: utf-8 -*-
"""Despeja a PLANTA COMO O RENDERIZADOR A MONTA, em coordenadas locais.

Existe por um motivo so: o caminho do Unreal precisa reproduzir exatamente as mesmas
superficies que o `app.js` desenha, senao o lightmap assado la nao assenta na malha
daqui. Em vez de portar `paredesDaGrade` pro Python no escuro e torcer, esta sonda
pergunta pra propria pagina -- e o resultado vira o gabarito que `unreal_exporta.py`
tem que bater.

    python pipeline/dump_planta.py <slug> [--saida unreal/plantas]

Grava um JSON por unidade com: paredes (segmento + y0/y1), comodos (poligono + piso),
contorno, pe-direito e as cores. Tudo no referencial DA PLANTA (origem no centroide,
eixo maior do predio no X), que e onde a luz e invariante a implantacao.
"""
import io, json, os, shutil, subprocess, sys, tempfile

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.montar import VERSAO

SLUG = ([a for a in sys.argv[1:] if not a.startswith("-")] or ["sao-carlos"])[0]
SAIDA = os.path.join(RAIZ, "unreal", "plantas")
PAG = os.path.join(RAIZ, VERSAO, "%s-%s-aberto.html" % (SLUG, VERSAO))

SONDA = r"""
<script>
(function esperar(n) {
  if (!window.__int || !window.__int.UNIDADES || !window.__int.grupos().length) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('PLANTA {"erro":"nao subiu"}'); return;
  }
  var I = window.__int, out = [];
  for (var k = 0; k < I.UNIDADES.length; k++) {
    var u = I.UNIDADES[k];
    if (!u.planta || !u.planta.comodos || !u.planta.comodos.length) continue;
    var pl = null;
    try { pl = I.plantaDaUnidade(null, u); } catch (e) {}
    if (!pl) continue;
    // de volta pro referencial da planta: o inverso de W() em plantaDaUnidade.
    var ob = pl.ob;
    var loc = function (p) {
      var x = p[0]-ob.cx, z = p[1]-ob.cz;
      return [ +( x*ob.ux + z*ob.uz).toFixed(4), +(-x*ob.uz + z*ob.ux).toFixed(4) ];
    };
    out.push({
      id: u.id, cidade: u.cidade, andar: u.andar || 0,
      pd: pl.pd, area: +pl.area.toFixed(2),
      rumo: (u.lote && u.lote.rumo_graus) || 0,
      cores: u.cores || {},
      paredes: pl.paredes.map(function (w) {
        return { a: loc(w.a), b: loc(w.b), y0: +w.y0.toFixed(4), y1: +w.y1.toFixed(4) }; }),
      comodos: pl.comodos.map(function (c) {
        return { nome: c.nome, area: +c.area.toFixed(2), piso: c.pisoTipo,
                 cor: c.piso, poly: c.poly.map(loc) }; }),
      contorno: pl.contorno.map(function (c) { return c.map(loc); }),
      esquadrias: pl.esquadrias.map(function (e) {
        return { tipo: e.tipo, porta: e.porta, y0: +e.y0.toFixed(3), y1: +e.y1.toFixed(3),
                 a: loc(e.a), b: loc(e.b) }; })
    });
  }
  console.log("PLANTA " + JSON.stringify(out));
})(400);
</script>
"""


def main():
    if not os.path.exists(PAG):
        print("falta a pagina: %s" % PAG); return 1
    s = io.open(PAG, encoding="utf-8", newline="").read() + SONDA
    tmp = PAG + ".planta.html"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="planta")
    bruto = ""
    try:
        r = subprocess.run([CHROME, "--headless=new", "--user-data-dir=" + ud,
                            "--window-size=900,600", "--use-angle=swiftshader",
                            "--enable-unsafe-swiftshader", "--hide-scrollbars",
                            "--virtual-time-budget=70000",
                            "--enable-logging=stderr", "--log-level=0",
                            "file:///" + tmp.replace("\\", "/") + "?q=alto&bake=0"],
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=300)
        bruto = (r.stderr or "") + (r.stdout or "")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        try: os.remove(tmp)
        except OSError: pass

    dados = None
    for ln in bruto.splitlines():
        if "PLANTA " in ln:
            try: dados = json.JSONDecoder().raw_decode(ln[ln.index("PLANTA ")+7:].lstrip())[0]
            except ValueError: pass
    if not dados:
        print("(sem PLANTA na saida)"); print(bruto[-1200:]); return 1
    if isinstance(dados, dict):
        print("erro da sonda: %s" % dados); return 1

    os.makedirs(SAIDA, exist_ok=True)
    for u in dados:
        p = os.path.join(SAIDA, "%s.json" % u["id"])
        io.open(p, "w", encoding="utf-8").write(json.dumps(u, ensure_ascii=False, indent=1))
        print("  %-24s %5.1f m2  %2d comodos  %3d paredes  pd %.2f  -> %s"
              % (u["id"], u["area"], len(u["comodos"]), len(u["paredes"]), u["pd"],
                 os.path.relpath(p, RAIZ)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
