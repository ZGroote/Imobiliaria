/* Teclado da pagina: atalhos do interior, WASD/setas e o "solta tudo" ao perder o foco. */
(function(root) {
  "use strict";
  function create({addEventListener, teclas, INT, MOB, FP, mostraPerf, perfLigado,
                   cancelaGesto, modoMoveis, exitInterior, excluiSel, giraSel}) {
addEventListener("keydown", e => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  // Antes do corte por INT.on: o medidor serve dentro e fora da casa, e é justamente
  // fora (cidade inteira na tela) que o número interessa.
  if (k === "p") { mostraPerf(!perfLigado()); return; }
  if (INT.on && k === "escape") {
    // Tres degraus, do mais local pro mais global. Sem eles o Esc de "desisti de
    // mover" jogava a pessoa pra fora da casa inteira.
    if (MOB.modo) { cancelaGesto(); return; }
    if (MOB.on) { modoMoveis(false); return; }
    exitInterior(); return;
  }
  if (!INT.on) return;
  if (k === "delete") { excluiSel(); e.preventDefault(); return; }
  if (k === "r") { giraSel(); return; }
  if (k === "w" || k === "arrowup") teclas.w = 1;
  else if (k === "s" || k === "arrowdown") teclas.s = 1;
  else if (k === "a" || k === "arrowleft") teclas.a = 1;
  else if (k === "d" || k === "arrowright") teclas.d = 1;
  else if (k === "q") teclas.q = 1;
  else if (k === "e") teclas.e = 1;
  else return;
  teclas.shift = e.shiftKey ? 1 : 0;
  e.preventDefault();
});
addEventListener("keyup", e => {
  const k = e.key.toLowerCase();
  if (k === "w" || k === "arrowup") teclas.w = 0;
  else if (k === "s" || k === "arrowdown") teclas.s = 0;
  else if (k === "a" || k === "arrowleft") teclas.a = 0;
  else if (k === "d" || k === "arrowright") teclas.d = 0;
  else if (k === "q") teclas.q = 0;
  else if (k === "e") teclas.e = 0;
  teclas.shift = e.shiftKey ? 1 : 0;
});
addEventListener("blur", () => { for (const k in teclas) teclas[k] = 0; FP.mov.x = FP.mov.z = 0; });

    return {};
  }
  root.Keyboard = Object.freeze({create});
})(globalThis);
