/* Mobile tabs: map, listings and options share one area on compact screens. */
(function(root) {
  "use strict";
  function create({$, perto:PERTO, fechaTudo}) {
// No celular, lista e opções dividem a mesma área. A ficha assume essa área
// quando um imóvel é escolhido, mantendo o mapa livre na metade superior.
const telaCompacta = matchMedia("(max-width:820px)");
let abaMobile = "mapa";
function atualizaMobile() {
  const ficha = [$("usheet"), $("hsheet"), $("psheet")].some(e => e.classList.contains("on"));
  if (ficha || document.body.classList.contains("dentro") || PERTO.on) abaMobile = "mapa";
  document.body.dataset.mobile = abaMobile;
  $("mMapa").setAttribute("aria-pressed", String(abaMobile === "mapa"));
  $("mImoveis").setAttribute("aria-expanded", String(abaMobile === "imoveis"));
  $("mOpcoes").setAttribute("aria-expanded", String(abaMobile === "opcoes"));
  for (const id of ["usheet", "hsheet", "psheet", "nearby", "ipanel"])
    $(id).inert = !$(id).classList.contains("on");
  $("houses").inert = telaCompacta.matches && abaMobile !== "imoveis";
  $("panel").inert = telaCompacta.matches && abaMobile !== "opcoes";
}
function abreAbaMobile(aba) {
  fechaTudo();
  abaMobile = abaMobile === aba ? "mapa" : aba;
  atualizaMobile();
}
$("mMapa").addEventListener("click", () => abreAbaMobile("mapa"));
$("mImoveis").addEventListener("click", () => abreAbaMobile("imoveis"));
$("mOpcoes").addEventListener("click", () => abreAbaMobile("opcoes"));
const mobileObserver = new MutationObserver(atualizaMobile);
for (const e of [document.body, $("usheet"), $("hsheet"), $("psheet"), $("nearby"), $("ipanel")])
  mobileObserver.observe(e, {attributes:true, attributeFilter:["class"]});
telaCompacta.addEventListener("change", atualizaMobile);
atualizaMobile();

    return {atualizaMobile, abreAbaMobile};
  }
  root.MobileTabs = Object.freeze({create});
})(globalThis);
