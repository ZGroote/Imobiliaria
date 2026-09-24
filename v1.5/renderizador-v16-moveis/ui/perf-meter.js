/* Medidor do HUD: FPS, ms, chamadas de desenho, triangulos, DPR e fila. */
(function(root) {
  "use strict";
  function create({$, QS, GPU, governor, renderer, NIVEL, NIVEL_NOME, gLive, streaming,
                   getCpuMs}) {
/* ---- medidor ------------------------------------------------------------ */
const perfBox = $("perf");
let perfOn = QS.get("perf") === "1", _perfT = 0;
function mostraPerf(v) {
  perfOn = v; perfBox.hidden = !v;
  if (v) $("pfGpu").textContent = GPU || "GPU não identificada (extensão bloqueada)";
}
mostraPerf(perfOn);
function pintaPerf(now) {
  if (!perfOn || now - _perfT < 260) return;
  _perfT = now;
  const med = governor.frameMs || 0, fps = med > 0 ? 1000/med : 0;
  const t = $("pfFps");
  t.textContent = fps ? fps.toFixed(0) + " FPS" : "—";
  t.className = "t " + (fps >= 50 ? "ok" : fps >= 28 ? "mid" : "bad");
  const i = renderer.info;
  $("pfMs").textContent  = med ? med.toFixed(1) + " ms" : "—";
  $("pfCpu").textContent = getCpuMs().toFixed(1) + " ms";
  $("pfDc").textContent  = i.render.calls;
  $("pfTri").textContent = (i.render.triangles/1e3).toFixed(0) + "k";
  $("pfPrg").textContent = i.programs ? i.programs.length : "—";
  $("pfGeo").textContent = i.memory.geometries;
  $("pfDpr").textContent = governor.dpr.toFixed(2) + "× · " + NIVEL_NOME;
  $("pfQt").textContent  = gLive.size + (streaming.pending ? " +" + streaming.pending : "");
  $("pfSom").textContent = NIVEL.somMap + (NIVEL.somSuave ? " suave" : "");
}

    return {mostraPerf, pintaPerf, ligado: () => perfOn};
  }
  root.PerfMeter = Object.freeze({create});
})(globalThis);
