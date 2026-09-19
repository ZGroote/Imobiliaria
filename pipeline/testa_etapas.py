# -*- coding: utf-8 -*-
"""Portao das TRES ETAPAS (v17): link direto, camera rotativa e planta em cena propria.

    MAPA_V=v17 python pipeline/testa_etapas.py sao-carlos
    MAPA_V=v17 python pipeline/testa_etapas.py sao-carlos --unidade mirra-114 --foto p.png

Sete sondas. Como as do `testa_moveis.py`, todas medem coisa que **falha calada** --
nenhuma delas produz erro no console quando quebra:

  1. `?imovel=<id>` abre a ficha daquele imovel sozinho, sem clique;
  2. ...com 2,5 km de raio de montagem, e nao com os 1.800 m do uso normal;
  3. ...e com a camera girando: theta anda sozinho entre dois quadros;
  4. o primeiro toque no canvas PARA o giro (senao a pagina briga com a mao de quem
     chegou, que e o defeito classico de camera de apresentacao);
  5. na etapa 3 o grupo do interior esta na CENA DA PLANTA, a unidade assenta em
     y = 0 e a cidade nao e desenhada -- e o item caro: se `gInteriores` continuasse
     pendurado em `scene`, a planta apareceria igual na tela e o custo por quadro
     seria o da cidade inteira, que e exatamente o que a etapa existe pra nao pagar;
  6. a mobilia continua na cena na vista aerea, e o modo de mobiliar esta ligado;
  7. voltar pra etapa 2 devolve o grupo pra cidade e a unidade pra cota do andar.

O rAF NAO ANDA em Chrome headless depois dos primeiros quadros (ver
[[mapa-3d-raf-aba-oculta]]): quem quiser medir o giro tem que acionar o laco a mao,
por `window.__perf.passo(t)` com relogio crescente. E o que a sonda 3 faz.
"""
import io, json, os, shutil, subprocess, sys, tempfile

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from pipeline.montar import VERSAO


def arg(nome, padrao=None):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else padrao


SLUG = ([a for a in sys.argv[1:] if not a.startswith("-")] or ["sao-carlos"])[0]
UNIDADE = arg("--unidade", "")
FOTO = arg("--foto", "")
PAG = os.path.join(RAIZ, VERSAO, "%s-%s-aberto.html" % (SLUG, VERSAO))

SONDA = r"""
<script>
(function esperar(n) {
  var I = window.__int;
  if (!I || !I.grupos || !I.grupos().length) {
    if (n > 0) return setTimeout(function(){ esperar(n-1); }, 300);
    console.log('ETAPAS {"erro":"nao subiu"}'); return;
  }
  var R = {}, falhas = [];
  function exige(nome, cond, obs) { R[nome] = !!cond; if (!cond) falhas.push(nome + (obs ? " (" + obs + ")" : "")); }
  try {
    // 1 e 2: o link abriu a ficha, e com o raio do link
    exige("ficha_do_link", !!I.ficha() && document.getElementById("usheet").classList.contains("on"));
    exige("raio_2500", window.__perf.raio() === 2500, "raio=" + window.__perf.raio());

    // 3: o giro anda sozinho -- o laco e acionado a mao porque o rAF para em headless
    exige("girando", I.TOUR.on);
    var t0 = I.sph.theta, base = performance.now();
    for (var k = 1; k <= 10; k++) window.__perf.passo(base + k*33);
    exige("theta_andou", Math.abs(I.sph.theta - t0) > 0.01,
          "delta=" + (I.sph.theta - t0).toFixed(4));

    // 4: o toque para o giro
    document.getElementById("c").dispatchEvent(new PointerEvent("pointerdown",
      {bubbles:true, clientX:640, clientY:400, button:0, pointerId:1, pointerType:"mouse"}));
    var t1 = I.sph.theta;
    for (var k = 11; k <= 20; k++) window.__perf.passo(base + k*33);
    exige("toque_parou", !I.TOUR.on && I.sph.theta === t1);

    // 5: a etapa 3 desenha a cena da planta, e so ela
    I.vaiParaEtapa("planta");
    for (var k = 21; k <= 40; k++) window.__perf.passo(base + k*33);
    exige("etapa3", I.ETAPA.atual === "planta" && I.PLANTA.on);
    exige("cena_propria", I.gInteriores.parent === I.cenaPlanta);
    exige("sem_cidade", document.body.classList.contains("planta"));
    exige("assenta_em_zero", I.INT.baseY === 0 && I.INT.raiz.position.y === 0,
          "baseY=" + I.INT.baseY);
    R.calls_planta = I.renderer.info.render.calls;
    R.tris_planta = I.renderer.info.render.triangles;

    // 6: mobilia na vista aerea
    I.sph.phi = 0.14;
    for (var k = 41; k <= 50; k++) window.__perf.passo(base + k*33);
    exige("moveis_na_planta", I.INT.moveis.length > 0 && I.INT.moveis.every(function(m){ return !!m.obj; }),
          I.INT.moveis.length + " moveis");
    exige("modo_moveis", I.MOB.on && !!I.MOB.grade);
    exige("aerea", Math.abs(I.sph.phi - 0.14) < 1e-6, "phi=" + I.sph.phi.toFixed(2));

    // 7: a volta devolve o grupo e a cota do andar
    I.vaiParaEtapa("interior");
    for (var k = 51; k <= 70; k++) window.__perf.passo(base + k*33);
    exige("volta_pra_cidade", !I.PLANTA.on && I.gInteriores.parent === I.scene);
    var esperado = (I.INT.pl.andar || 0) * 3.15;
    exige("cota_do_andar", I.INT.baseY >= esperado - 1e-6,
          "baseY=" + I.INT.baseY.toFixed(2) + " andar=" + (I.INT.pl.andar || 0));
    R.calls_cidade = I.renderer.info.render.calls;

    R.falhas = falhas;
    R.ok = falhas.length === 0;
  } catch (e) { R.erro = String(e && e.stack || e); R.ok = false; }
  console.log('ETAPAS ' + JSON.stringify(R));
})(140);
</script>
"""


def main():
    if not os.path.exists(PAG):
        print("falta %s -- monte a pagina antes (MAPA_V=%s python pipeline/montar.py %s)"
              % (PAG, VERSAO, SLUG))
        return 1
    if not UNIDADE:
        print("uso: --unidade <id> (o id que vai no ?imovel= do link direto)")
        return 1
    s = io.open(PAG, encoding="utf-8", newline="").read() + SONDA
    tmp = PAG + ".etapas.html"
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    ud = tempfile.mkdtemp(prefix="etapas")
    cmd = [CHROME, "--headless=new", "--user-data-dir=" + ud,
           "--window-size=1280,760", "--use-angle=swiftshader",
           "--enable-unsafe-swiftshader", "--hide-scrollbars",
           "--virtual-time-budget=90000", "--enable-logging=stderr", "--log-level=0"]
    if FOTO:
        cmd.append("--screenshot=" + os.path.abspath(FOTO))
    cmd.append("file:///" + tmp.replace("\\", "/") + "?q=alto&imovel=" + UNIDADE)
    bruto = ""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=420)
        bruto = (r.stderr or "") + (r.stdout or "")
    finally:
        shutil.rmtree(ud, ignore_errors=True)
        try:
            os.remove(tmp)
        except OSError:
            pass

    for ln in bruto.splitlines():
        i = ln.find("ETAPAS {")
        if i < 0:
            continue
        d = json.loads(ln[i + 7:].strip().rstrip('"'))
        for k in sorted(d):
            print("  %-22s %s" % (k, d[k]))
        return 0 if d.get("ok") else 1
    print("a sonda nao respondeu -- a pagina nao subiu no headless")
    print(bruto[-2000:])
    return 1


if __name__ == "__main__":
    sys.exit(main())
