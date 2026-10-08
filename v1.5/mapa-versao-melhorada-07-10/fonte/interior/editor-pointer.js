/* Furniture pointer gestures and projection onto the floor or height handle plane. */
(function(root) {
  "use strict";
  function create({THREE, canvas, camera, INT, MOB, mobSetas, mobMed, cameraGestures,
                   paraUV, dirUV, arred, redimensiona, cabeAqui, atualizaMovel,
                   seleciona, selBox, MOB_VERDE, MOB_VERMELHO, salvaMoveis, pintaMedidas,
                   getWidth, getHeight}) {
    const rcaster = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _mobV = new THREE.Vector3();
/* ---- arrastar a seta --------------------------------------------------- */
const _mobPlano = new THREE.Plane(), _mobPto = new THREE.Vector3();
// Onde o ponteiro cruza um plano horizontal, em coordenadas do mundo.
function pontoNoChao(e, y) {
  _ndc.set(e.clientX/getWidth()*2 - 1, -(e.clientY/getHeight()*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  const dir = rcaster.ray.direction, org = rcaster.ray.origin;
  if (Math.abs(dir.y) < 1e-4) return null;
  const t = (y - org.y) / dir.y;
  if (t <= 0) return null;
  return [org.x + dir.x*t, org.z + dir.z*t];
}
// A seta de ALTURA nao tem plano horizontal pra cruzar: usa-se um plano vertical
// virado pra camera, passando pelo movel. Sem isso a seta de cima nao anda.
function alturaNoPonteiro(e, cx, cz) {
  _ndc.set(e.clientX/getWidth()*2 - 1, -(e.clientY/getHeight()*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  camera.getWorldDirection(_mobV);
  _mobV.y = 0;
  if (_mobV.lengthSq() < 1e-6) return null;
  _mobPlano.setFromNormalAndCoplanarPoint(_mobV.normalize(),
                                          _mobPto.set(cx, INT.baseY, cz));
  return rcaster.ray.intersectPlane(_mobPlano, _mobPto) ? _mobPto.y - INT.baseY : null;
}
// Deslocamento do ponteiro ao longo do eixo que se puxa, em metros, medido do
// CENTRO do movel. A conta do arrasto compara este numero com o do pointerdown.
function tNoEixo(e, m, eixo) {
  if (eixo.k === "h") {
    const p = INT.pl.W(m.u, m.v);
    return alturaNoPonteiro(e, p[0], p[1]);
  }
  const q = pontoNoChao(e, INT.baseY + Math.max(0.10, m.h)/2);
  if (!q) return null;
  const uv = paraUV(q[0], q[1]);
  const d = dirUV(m, eixo.k === "w" ? eixo.s : 0, eixo.k === "d" ? eixo.s : 0);
  return (uv[0] - m.u)*d[0] + (uv[1] - m.v)*d[1];
}
function pegaSeta(e) {
  if (!mobSetas.visible) return null;
  _ndc.set(e.clientX/getWidth()*2 - 1, -(e.clientY/getHeight()*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  const h = rcaster.intersectObjects(mobSetas.children, false)[0];
  return h ? h.object.userData.eixo : null;
}

canvas.addEventListener("pointerdown", e => {
  if (!MOB.on || !INT.on || e.button !== 0) return;
  if (cameraGestures.isMultiTouch(e)) return;
  const eixo = pegaSeta(e);
  if (!eixo) return;
  const m = INT.moveis[INT.sel];
  const t0 = tNoEixo(e, m, eixo);
  if (t0 == null) return;
  MOB.arrasto = { eixo, t0, base:m[eixo.k] };
  for (const q of mobMed) q.el.classList.add("arrasta");
  // A camera nao pode reagir ao mesmo gesto: o estado do arrasto pertence ao controle de
  // ponteiro la de cima, e sem zerar um e marcar o outro a casa gira junto e o
  // soltar ainda dispara um clique de selecao por cima.
  cameraGestures.claimGesture();
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", e => {
  if (!MOB.on || !INT.on) return;
  if (cameraGestures.isMultiTouch(e)) return;
  const m = INT.moveis[INT.sel];
  if (MOB.arrasto && m) {
    const a = MOB.arrasto;
    const t = tNoEixo(e, m, a.eixo);
    if (t == null) return;
    const bruto = a.base + (t - a.t0);
    const alvo = e.shiftKey ? bruto : arred(bruto);
    if (Math.abs(alvo - m[a.eixo.k]) > 1e-4)
      redimensiona(m, a.eixo.k, alvo, a.eixo.k === "h" ? 1 : a.eixo.s);
    return;
  }
  if (MOB.modo === "mover" && m) {
    const q = pontoNoChao(e, INT.baseY + 0.03);
    if (!q) return;
    const uv = paraUV(q[0], q[1]);
    m.u = e.shiftKey ? uv[0] : arred(uv[0]);
    m.v = e.shiftKey ? uv[1] : arred(uv[1]);
    MOB.cabe = cabeAqui(m, m.u, m.v);
    atualizaMovel(m); seleciona(INT.sel);
    selBox.material.color.setHex(MOB.cabe ? MOB_VERDE : MOB_VERMELHO);
  }
});

function soltaSeta(e) {
  if (!MOB.arrasto) return;
  MOB.arrasto = null;
  for (const q of mobMed) q.el.classList.remove("arrasta");
  if (e && e.pointerId != null && canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  salvaMoveis(); pintaMedidas();
}
canvas.addEventListener("pointerup", soltaSeta);
canvas.addEventListener("pointercancel", soltaSeta);


    return {soltaSeta};
  }
  root.EditorPointer = Object.freeze({create});
})(globalThis);
