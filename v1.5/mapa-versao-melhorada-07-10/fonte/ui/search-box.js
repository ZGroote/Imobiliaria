/* Caixa de busca: lista, teclado e o voo ate o resultado escolhido. */
(function(root) {
  "use strict";
  function create({document, addEventListener, bq, bres, esc, buscaAgora, INT, saiSeco,
                   openPoiSheet, aim, flyTo, sph, frameLoop}) {
bq.addEventListener("focus", () => document.body.classList.add("buscando"));
bq.addEventListener("blur", () => document.body.classList.remove("buscando"));
let bSel = -1, bLista = [];

function pintaBusca() {
  if (!bLista.length) {
    bres.innerHTML = bq.value.trim().length >= 2
      ? '<div class="vazio">Nada com esse nome por aqui.</div>' : "";
    bres.hidden = !bq.value.trim().length;
    return;
  }
  bres.innerHTML = bLista.map((it, i) =>
    '<div class="bi' + (i === bSel ? " on" : "") + '" data-i="' + i + '">' +
    '<i style="background:' + (it.cor || (it.k === "rua" ? "#5A6774" : "#A7AFB8")) + '"></i>' +
    '<span class="t">' + esc(it.n) + '</span><span class="s">' + esc(it.s) + '</span></div>').join("");
  bres.hidden = false;
}

function vaiPara(it) {
  if (!it) return;
  bres.hidden = true; bq.blur();
  // Buscar de dentro da casa e pedir pra sair: quem manda na camera ali e o
  // interiorFrame, entao o flyTo iria pro lugar certo com a camera presa na sala.
  if (INT.on) saiSeco();
  if (it.k === "poi") { openPoiSheet(it.poi); return; }
  aim({ x: it.x, z: it.z });
  flyTo(it.x, it.z, Math.min(Math.max(sph.radius, 180), 420));
  frameLoop();
}

bq.addEventListener("input", () => { bLista = buscaAgora(bq.value); bSel = bLista.length ? 0 : -1; pintaBusca(); });
bq.addEventListener("focus", () => { if (bLista.length) bres.hidden = false; });
bq.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!bLista.length) return;
    bSel = (bSel + (e.key === "ArrowDown" ? 1 : bLista.length - 1)) % bLista.length;
    pintaBusca();
  } else if (e.key === "Enter") { vaiPara(bLista[bSel] || bLista[0]); }
  else if (e.key === "Escape") { bres.hidden = true; bq.blur(); }
  e.stopPropagation();   // a cidade escuta tecla solta (P, R, WASD): digitar não é atalho
});
bq.addEventListener("keyup", e => e.stopPropagation());
bres.addEventListener("click", e => {
  const el = e.target.closest(".bi"); if (!el) return;
  e.preventDefault(); vaiPara(bLista[+el.dataset.i]);
});
addEventListener("pointerdown", e => {
  if (!bres.hidden && !e.target.closest("#hud .busca")) bres.hidden = true;
}, true);

    return {pintaBusca, vaiPara};
  }
  root.SearchBox = Object.freeze({create});
})(globalThis);
