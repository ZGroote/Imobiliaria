/* First-person walking: the per-frame step (keys and joystick share one vector) and the mobile joystick. */
(function(root) {
  "use strict";
  function create({FP, teclas, livre, joy, TOQUE}) {
/* ---- primeira pessoa --------------------------------------------------- */
function fpPasso(dt) {
  const d0 = Math.min(0.05, dt);
  if (teclas.q) FP.yaw += 1.8 * d0;
  if (teclas.e) FP.yaw -= 1.8 * d0;
  let mf = (teclas.w ? 1 : 0) - (teclas.s ? 1 : 0) + FP.mov.z;
  let mr = (teclas.d ? 1 : 0) - (teclas.a ? 1 : 0) + FP.mov.x;
  if (!mf && !mr) return;
  // O manche entrega modulo entre 0 e 1: perto do centro anda devagar, o que e o que
  // permite ajustar posicao dentro de um comodo pequeno sem passar direto.
  const forca = Math.min(1, Math.hypot(mf, mr));
  const v = (teclas.shift ? 3.6 : 1.7) * d0 * forca;
  const L = Math.hypot(mf, mr); mf /= L; mr /= L;
  const sy = Math.sin(FP.yaw), cy = Math.cos(FP.yaw);
  const dx = (-sy*mf + cy*mr) * v, dz = (-cy*mf - sy*mr) * v;
  const x = FP.pos.x, z = FP.pos.z;
  if (livre(x+dx, z+dz)) { FP.pos.x = x+dx; FP.pos.z = z+dz; }
  else if (livre(x+dx, z)) FP.pos.x = x+dx;
  else if (livre(x, z+dz)) FP.pos.z = z+dz;
}

/* ---- manche de caminhada (celular) ------------------------------------- */
const joyPino = joy.firstElementChild;
let joyId = null, joyCx = 0, joyCy = 0;
const JOY_R = 34;                      // curso util, em pixels
function mostraJoy(v) {
  joy.classList.toggle("on", !!(v && TOQUE));
  if (!v) soltaJoy();
}
function soltaJoy() {
  joyId = null; FP.mov.x = FP.mov.z = 0;
  joyPino.style.transform = "";
}
joy.addEventListener("pointerdown", e => {
  const r = joy.getBoundingClientRect();
  joyCx = r.left + r.width/2; joyCy = r.top + r.height/2;
  joyId = e.pointerId; joy.setPointerCapture(e.pointerId);
  moveJoy(e); e.preventDefault(); e.stopPropagation();
});
joy.addEventListener("pointermove", e => { if (e.pointerId === joyId) moveJoy(e); });
for (const ev of ["pointerup", "pointercancel", "pointerleave"])
  joy.addEventListener(ev, e => { if (e.pointerId === joyId) soltaJoy(); });
function moveJoy(e) {
  let dx = e.clientX - joyCx, dy = e.clientY - joyCy;
  const L = Math.hypot(dx, dy);
  if (L > JOY_R) { dx = dx/L*JOY_R; dy = dy/L*JOY_R; }
  joyPino.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
  FP.mov.x = dx / JOY_R;              // direita/esquerda
  FP.mov.z = -dy / JOY_R;             // pra cima na tela = pra frente
}

    return {fpPasso, mostraJoy};
  }
  root.FirstPerson = Object.freeze({create});
})(globalThis);
