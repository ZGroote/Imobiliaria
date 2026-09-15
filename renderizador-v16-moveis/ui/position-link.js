/* Position link: the orbit target and view written to the URL, and read back on open. */
(function(root) {
  "use strict";
  function create({CENTER, MLAT, MLON, px, pz, target, sph, NOITE, INT, setNoite, streamUpdate}) {
/* ---------------- link de posição ---------------- */
// `em` é lat,lon do ALVO da órbita (não da câmera): é o que a pessoa quer mostrar.
// r/p/t são raio, phi e theta — os três números que definem de onde se olha.
let _linkOk = true, _linkUlt = "";
function escreveLink() {
  if (!_linkOk || INT.on) return;
  const lat = CENTER.lat - target.z / MLAT, lon = CENTER.lon + target.x / MLON;
  const s = "em=" + lat.toFixed(5) + "," + lon.toFixed(5) +
            "&r=" + Math.round(sph.radius) +
            "&p=" + sph.phi.toFixed(2) + "&t=" + sph.theta.toFixed(2) +
            (NOITE.on ? "&noite=1" : "");
  if (s === _linkUlt) return;
  _linkUlt = s;
  try {
    const u = new URL(location.href);
    for (const k of ["em", "r", "p", "t", "noite"]) u.searchParams.delete(k);
    const busca = u.searchParams.toString();
    history.replaceState(null, "", u.pathname + "?" + (busca ? busca + "&" : "") + s + u.hash);
  } catch (e) {
    // file:// com origem opaca recusa o replaceState em alguns navegadores. Uma vez
    // recusado, não adianta tentar de novo a cada segundo.
    _linkOk = false;
  }
}
function lerLink() {
  const p = new URLSearchParams(location.search);
  if (p.get("noite") === "1") setNoite(true, true);
  const em = p.get("em"); if (!em) return;
  const [lat, lon] = em.split(",").map(Number);
  if (!isFinite(lat) || !isFinite(lon)) return;
  target.set(px(lon), 0, pz(lat));
  const r = Number(p.get("r")), f = Number(p.get("p")), t = Number(p.get("t"));
  if (isFinite(r) && r > 20) sph.radius = Math.min(9000, r);
  if (isFinite(f)) sph.phi = Math.max(0.06, Math.min(1.52, f));
  if (isFinite(t)) sph.theta = t;
  streamUpdate(true);
}

    return {escreveLink, lerLink};
  }
  root.PositionLink = Object.freeze({create});
})(globalThis);
