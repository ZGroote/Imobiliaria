/* Painel do editor de moveis: selecao, catalogo, medidas e os modos do gesto. */
(function(root) {
  "use strict";
  function create({document, $, INT, MOB, MOB_VERDE, MOVEIS, MOVEL_KEYS, TOQUE, selBox,
                   ipanel, atualizaMovel, salvaMoveis, fazGrade, poeSetas, poeFantasma,
                   tiraFantasma, pintaMedidas, getPoeTipo, setPoeTipo}) {
function seleciona(i) {
  // Escolher OUTRO movel encerra o gesto do anterior -- senao o fantasma do sofa
  // fica na sala enquanto se mexe na cama. Reposicionar o MESMO movel (o que o
  // arrasto faz a cada pixel) chega aqui com o mesmo indice e nao cancela nada.
  if (i !== INT.sel && typeof MOB !== "undefined" && MOB.modo) {
    MOB.modo = null; MOB.origem = null; tiraFantasma();
    selBox.material.color.setHex(MOB_VERDE);
  }
  INT.sel = i;
  const m = INT.moveis[i];
  selBox.visible = !!m;
  if (m) {
    const p = INT.pl.W(m.u, m.v);
    selBox.position.set(p[0], INT.baseY + 0.03, p[1]);
    selBox.rotation.y = m.obj.rotation.y;
    selBox.scale.set(m.w, Math.max(0.12, m.h), m.d);
  }
  // O gizmo e os campos de medida seguem a selecao: sem isto a seta fica na
  // posicao do movel ANTERIOR e puxa o objeto errado.
  poeSetas(); pintaMedidas();
  pintaEditor();
}

function pintaCatalogo() {
  const box = $("iCat");
  if (!box.children.length) {
    for (const k of MOVEL_KEYS) {
      const b = document.createElement("button");
      b.textContent = MOVEIS[k].nome; b.dataset.k = k;
      b.addEventListener("click", () => {
        setPoeTipo(getPoeTipo() === k ? null : k);
        if (getPoeTipo()) seleciona(-1);
        pintaCatalogo();
      });
      box.appendChild(b);
    }
  }
  for (const b of box.children) b.setAttribute("aria-pressed", String(b.dataset.k === getPoeTipo()));
  $("iDica").textContent = getPoeTipo()
    ? (TOQUE ? "Toque no chão para posicionar: " : "Clique no chão para posicionar: ") + MOVEIS[getPoeTipo()].nome
    : (TOQUE ? "Use o controle circular para andar · arraste para olhar · toque num móvel para escolher" : "W A S D anda · arrastar olha · clicar escolhe · R gira · clique no interruptor acende");
}
function pintaEditor() {
  const m = INT.moveis[INT.sel];
  $("icancel").hidden = !m || !MOB.modo;
  $("iEdit").hidden = !m;
  if (!m) return;
  $("iSelName").textContent = MOVEIS[m.tipo].nome;
  $("isw").value = m.w; $("ivw").textContent = m.w.toFixed(2).replace(".", ",") + " m";
  $("isd").value = m.d; $("ivd").textContent = m.d.toFixed(2).replace(".", ",") + " m";
  $("ish").value = m.h; $("ivh").textContent = m.h.toFixed(2).replace(".", ",") + " m";
  $("icor").value = "#" + m.cor.toString(16).padStart(6, "0");
  $("imover").setAttribute("aria-pressed", String(MOB.modo === "mover"));
  $("imodif").setAttribute("aria-pressed", String(MOB.modo === "medir"));
  $("iDica").textContent =
    MOB.modo === "mover" ? (TOQUE ? "Toque no destino para mover · vermelho indica que não cabe · Cancelar ajuste desfaz" : "Mova o ponteiro e clique pra soltar · vermelho = nao cabe · Esc desiste")
    : MOB.modo === "medir" ? (TOQUE ? "Arraste uma seta ou digite a medida" : "Puxe uma seta ou digite a medida · cresce so pro lado puxado · Shift solta a grade")
    : (TOQUE ? "Use Mover, Modificar, Rotacionar ou Excluir para ajustar o móvel" : "Clique num movel pra escolher · R gira · Del apaga");
  pintaMedidas();
}
function mexeSel(campo, valor) {
  const m = INT.moveis[INT.sel]; if (!m) return;
  m[campo] = valor; atualizaMovel(m); seleciona(INT.sel); salvaMoveis();
}
function giraSel() {
  const m = INT.moveis[INT.sel]; if (!m) return;
  m.rot = (m.rot + 1) % 4; atualizaMovel(m); seleciona(INT.sel); salvaMoveis();
}
function excluiSel() {
  const m = INT.moveis[INT.sel]; if (!m) return;
  INT.raiz.remove(m.obj); m.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  INT.moveis.splice(INT.sel, 1); seleciona(-1); salvaMoveis();
}

/* ---- ligar e desligar o modo ------------------------------------------- */
function modoMoveis(on) {
  MOB.on = !!on && INT.on;
  $("imob").setAttribute("aria-pressed", String(MOB.on));
  ipanel.classList.toggle("on", MOB.on);
  if (MOB.on) {
    if (!MOB.grade && INT.raiz) { MOB.grade = fazGrade(); INT.raiz.add(MOB.grade); }
    pintaCatalogo(); pintaEditor();
  } else {
    if (MOB.grade) {
      if (INT.raiz) INT.raiz.remove(MOB.grade);
      MOB.grade.geometry.dispose();
      MOB.grade = null;
    }
    setPoeTipo(null); MOB.modo = null; MOB.arrasto = null;
    tiraFantasma(); seleciona(-1);
  }
  poeSetas();
}
function modo(qual) {
  const m = INT.moveis[INT.sel];
  if (MOB.modo === "mover" && qual !== "mover") cancelaGesto();
  MOB.modo = (MOB.modo === qual || !m) ? null : qual;
  tiraFantasma();
  if (MOB.modo === "mover" && m) { MOB.origem = { u:m.u, v:m.v }; poeFantasma(m); }
  selBox.material.color.setHex(MOB_VERDE);
  poeSetas(); pintaEditor();
}
/* Cancelar um "mover" tem que DEVOLVER o movel: o fantasma marca de onde ele saiu,
   e desistir deixando-o onde o cursor parou seria mover sem querer. */
function cancelaGesto() {
  const m = INT.moveis[INT.sel];
  if (MOB.modo === "mover" && m && MOB.origem) {
    m.u = MOB.origem.u; m.v = MOB.origem.v;
    atualizaMovel(m); salvaMoveis();
  }
  MOB.modo = null; MOB.origem = null; tiraFantasma();
  selBox.material.color.setHex(MOB_VERDE);
  seleciona(INT.sel); pintaEditor();
}
function confirmaMover() {
  MOB.modo = null; MOB.origem = null; tiraFantasma();
  selBox.material.color.setHex(MOB_VERDE);
  seleciona(INT.sel); pintaEditor(); salvaMoveis();
}

    return {seleciona, pintaCatalogo, pintaEditor, mexeSel, giraSel, excluiSel,
            modoMoveis, modo, cancelaGesto, confirmaMover};
  }
  root.EditorPanel = Object.freeze({create});
})(globalThis);
