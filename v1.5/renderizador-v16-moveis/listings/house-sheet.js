/* Ficha do anuncio simples: a vitrine sem planta, o farol e o voo ate o endereco. */
(function(root) {
  "use strict";
  function create({document, $, esc, px, pz, brl, getSheet, ListingModels, hsheet, usheet,
                   housesBox, houseBeacon, flyTo, closePoiSheet, abrePerto,
                   mostraMaquete, escondeMaquete, predioMaisPerto}) {
const HOUSES = (function () {
  try { return JSON.parse(document.getElementById("__imoveis").textContent); }
  catch (e) { return []; }
})();

let HOUSE_ATUAL = null;   // o anuncio SEM planta que esta na ficha simples
function openHouseSheet(house) {
  const hx = px(house.lon), hz = pz(house.lat);
  HOUSE_ATUAL = { h: house, x: hx, z: hz };
  getSheet().preencheAnuncio(house);   // a ficha nasce depois deste modulo
  hsheet.classList.add("on");
  hsheet.classList.remove("min");
  usheet.classList.remove("on");
  closePoiSheet();
  houseBeacon.position.set(hx, 0, hz);
  houseBeacon.visible = true;
  flyTo(hx, hz, 190);
  /* A miniatura vale pro anuncio simples tambem (predio E casas). O anuncio da vitrine
     nao traz registro de edificacao -- traz lat/lon --, entao o volume sai do predio
     mais proximo do endereco, que e a mesma pista que a ficha da unidade ja usa quando
     o cadastro nao declara `predio_id`. Sem predio por perto (endereco em lote vazio),
     nao ha o que modelar e o painel nao aparece. */
  const b = predioMaisPerto(hx, hz, 90);
  if (b) mostraMaquete(b, null, "hsheet"); else escondeMaquete();
}
$("hModel").addEventListener("click", () => { if (HOUSE_ATUAL) ListingModels.open(HOUSE_ATUAL.h.id); });
$("hx").addEventListener("click", () => {
  hsheet.classList.remove("on"); houseBeacon.visible = false; escondeMaquete();
});
// O anuncio sem planta nao tem visita 3D, mas tem endereco -- e a vizinhanca dele e
// exatamente a mesma pergunta.
$("hPerto").addEventListener("click", () => {
  if (!HOUSE_ATUAL) return;
  const a = HOUSE_ATUAL;
  abrePerto({ x: a.x, z: a.z, nome: a.h.titulo,
              volta: () => { hsheet.classList.add("on"); hsheet.classList.remove("min");
                             houseBeacon.position.set(a.x, 0, a.z);
                             houseBeacon.visible = true;
                             flyTo(a.x, a.z, 190); } });
});

for (const h of HOUSES) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "hitem";
  // Titulo e bairro vem do cadastro, que nao e texto controlado por este codigo: entram
  // escapados, senao um `<` no nome do anuncio vira marcacao dentro da vitrine.
  el.innerHTML = `<div class="t">${esc(h.titulo)}</div><div class="b">${esc(h.bairro)}</div>` +
    `<div class="p ${h.tipo === "aluguel" ? "rent" : "sale"}">${brl(h.preco)}${h.tipo === "aluguel" ? "/mês" : ""}</div>`;
  el.addEventListener("click", () => openHouseSheet(h));
  housesBox.appendChild(el);
}

    // Nada sai: a vitrine publica e a ficha dela se falam so aqui dentro.
    return {};
  }
  root.HouseSheet = Object.freeze({create});
})(globalThis);
