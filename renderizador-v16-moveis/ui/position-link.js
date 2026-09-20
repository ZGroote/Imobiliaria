/* Position link: the orbit target and view written to the URL, and read back on open. */
(function(root) {
  "use strict";
  function create({CENTER, MLAT, MLON, px, pz, target, sph, NOITE, INT, setNoite,
                   streamUpdate,
                   // A escada das tres etapas (listings/stage.js).
                   ETAPA, TOUR, getFicha, getLinkImovel, abrePeloLink}) {
/* ---------------- link de posição ---------------- */
// `em` é lat,lon do ALVO da órbita (não da câmera): é o que a pessoa quer mostrar.
// r/p/t são raio, phi e theta — os três números que definem de onde se olha.
let _linkOk = true, _linkUlt = "";
function escreveLink() {
  if (!_linkOk || INT.on) return;
  // Com um imovel na ficha a URL e a do IMOVEL (`?imovel=&etapa=`), escrita por
  // `marcaEtapaNaUrl` na troca de etapa. Continuar gravando `em/r/p/t` por cima seria
  // reescrever a URL uma vez por segundo enquanto a camera gira -- e, na volta, um
  // ponto de camera brigando com o enquadramento do proprio predio.
  if (getFicha() || TOUR.on) return;
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
  // `?imovel=` manda mais que `?em=`. Os dois podem vir juntos (uma URL antiga que
  // ganhou o imovel depois), e nesse caso o enquadramento do predio e o que vale.
  if (getLinkImovel()) { abrePeloLink(); return; }
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

/* A URL de um imovel e a do IMOVEL, nao a da camera: `em/r/p/t` descrevem de onde se
   estava olhando, e num link que nasce com a camera girando eles seriam um numero
   diferente por segundo -- e, na volta, brigariam com o enquadramento do proprio
   predio. Com `?imovel=` na mao, a posicao da camera sai da URL. */
function marcaEtapaNaUrl() {
  if (!_linkOk) return;
  try {
    const u = new URL(location.href);
    const F = getFicha();
    if (F && F.u && F.u.id != null) {
      u.searchParams.set("imovel", String(F.u.id));
      for (const k of ["em", "r", "p", "t"]) u.searchParams.delete(k);
      if (ETAPA.atual !== "mapa") u.searchParams.set("etapa", ETAPA.atual);
      else u.searchParams.delete("etapa");
    } else {
      u.searchParams.delete("imovel"); u.searchParams.delete("etapa");
    }
    history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch (e) { _linkOk = false; }
}

    return {escreveLink, lerLink, marcaEtapaNaUrl};
  }
  root.PositionLink = Object.freeze({create});
})(globalThis);
