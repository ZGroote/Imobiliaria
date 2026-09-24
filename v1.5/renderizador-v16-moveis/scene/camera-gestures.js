/* Pointer navigation; furniture editing can claim the current gesture. */
(function(root) {
  "use strict";
  function create({canvas, target, sph, camera, zoomMax, getHeight, getInterior,
                   getFirstPerson, soltaSeta, cliqueInterior, cliqueNaCidade,
                   getPlanta, paraTour}) {
const PAN = 1, ORBIT = 2;
let drag = 0, lx = 0, ly = 0;
let dnX = 0, dnY = 0, moveu = 0;   // v9: separa clique de arrasto
const dedos = new Map();
let gestoDuplo = false;
function medidaDedos() {
  const [a, b] = [...dedos.values()];
  return { d:Math.hypot(b.x-a.x, b.y-a.y), a:Math.atan2(b.y-a.y, b.x-a.x) };
}
let toqueAnterior = null;

canvas.addEventListener("pointerdown", e => {
  paraTour();   // a mao de quem chegou manda mais que o giro de apresentacao
  if (e.pointerType === "touch") {
    dedos.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (dedos.size > 1) {
      gestoDuplo = true; moveu = 1; drag = 0;
      toqueAnterior = medidaDedos();
      soltaSeta(e);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    gestoDuplo = false;
  }
  /* Na cena da planta os papeis do arrasto se invertem. Ali a pessoa esta olhando um
     OBJETO, nao um mapa -- e em visualizador de objeto arrastar gira, que e o que o
     proprio texto da dica da vista de planta sempre prometeu. Fora dela nada muda:
     esquerdo arrasta o mapa, direito gira. */
  const _sec = (e.button === 2 || e.button === 1 || e.shiftKey);
  drag = (_sec !== getPlanta().on) ? ORBIT : PAN;
  lx = e.clientX; ly = e.clientY;
  dnX = e.clientX; dnY = e.clientY; moveu = 0;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = drag === PAN ? "grabbing" : "move";
});
function endDrag(e) {
  if (e && e.pointerType === "touch") {
    dedos.delete(e.pointerId);
    toqueAnterior = null;
    if (gestoDuplo || e.type === "pointercancel") moveu = 1;
  }
  drag = 0; canvas.style.cursor = "";
  // Em pointercancel a captura já caiu sozinha; liberar de novo lança.
  if (e && e.pointerId != null && canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

// Clique e apertar e soltar sem arrastar. Este ouvinte e registrado DEPOIS
// do endDrag, e a ordem de registro e a ordem de chamada: aqui `moveu` ja
// tem a resposta, mesmo com o `drag` zerado.
canvas.addEventListener("pointerup", e => {
  if (moveu || e.button === 2 || e.button === 1) return;
  if (getInterior().on) { if (getInterior().fp || getInterior().orbita) cliqueInterior(e); }
  else cliqueNaCidade(e);
});

canvas.addEventListener("pointermove", e => {
  if (e.pointerType === "touch" && dedos.has(e.pointerId)) {
    dedos.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (dedos.size > 1) {
      const atual = medidaDedos();
      if (toqueAnterior && atual.d > 0 && !(getInterior().on && !getInterior().orbita)) {
        sph.radius = Math.max(getInterior().orbita ? 5 : 60, Math.min(zoomMax(), sph.radius*toqueAnterior.d/atual.d));
        let da = atual.a - toqueAnterior.a;
        if (da > Math.PI) da -= 2*Math.PI; else if (da < -Math.PI) da += 2*Math.PI;
        sph.theta += da;
      }
      toqueAnterior = atual; moveu = 1; drag = 0;
      return;
    }
    if (gestoDuplo) return;
  }
  if (!drag) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  lx = e.clientX; ly = e.clientY;
  if (Math.abs(e.clientX - dnX) + Math.abs(e.clientY - dnY) > 4) moveu = 1;
  if (getInterior().on && !getInterior().orbita) {   // v9: dentro da casa o arrasto e olhar em volta
    getFirstPerson().yaw -= dx*0.004;
    getFirstPerson().pitch = Math.max(-1.25, Math.min(1.25, getFirstPerson().pitch - dy*0.004));
    return;
  }
  if (drag === ORBIT) {
    sph.theta -= dx*0.005;
    // A faixa de phi da CIDADE existe pra nao deixar a camera rasar o chao nem olhar
    // de cima a ponto de a cidade virar mapa chapado. Na cena da planta e o oposto: o
    // de cima a pino E a vista util (e a planta de arquitetura), e nao ha horizonte
    // pra proteger. Por isso a faixa abre so ali.
    const p0 = getPlanta().on ? 0.10 : 0.75, p1 = getPlanta().on ? 1.35 : 1.15;
    sph.phi = Math.max(p0, Math.min(p1, sph.phi + dy*0.005));
  } else panBy(dx, dy);
});

// Arrastar leva a câmera pro lado oposto, então o chão acompanha o cursor.
// k = quanto de mundo cabe num pixel na distância do alvo. O eixo vertical
// divide ainda por cosφ porque a tela está inclinada sobre o chão: com a câmera
// mais rasante, cada pixel de altura cobre muito mais terreno. O piso de 0,25
// só existe pra proteger de divisão por ~zero se o limite de phi mudar.
function panBy(dx, dy) {
  const k  = 2 * sph.radius * Math.tan(camera.fov * Math.PI/360) / getHeight();
  const kv = k / Math.max(0.25, Math.cos(sph.phi));
  const ct = Math.cos(sph.theta), st = Math.sin(sph.theta);
  const hx = k*dx, vy = kv*dy;
  target.x -= ct*hx + st*vy;
  target.z += st*hx - ct*vy;
}

canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("wheel", e => { e.preventDefault();
  paraTour();
  if (getInterior().on && !getInterior().orbita) return;                   // v9: zoom nao vale a pe
  const rmin = getInterior().orbita ? 5 : 60;   // uma casa tem 8 m de frente, nao 60
  sph.radius = Math.max(rmin, Math.min(zoomMax(), sph.radius*(1 + Math.sign(e.deltaY)*0.11)));
}, { passive:false });

// Pointer Events são a única fonte dos gestos: não duplicar com touchmove.
canvas.addEventListener("lostpointercapture", e => {
  if (dedos.has(e.pointerId)) { moveu = 1; endDrag(e); }
});


    return {
      isMultiTouch(e) { return dedos.size > 1 || gestoDuplo && e.pointerType === "touch"; },
      claimGesture() { drag = 0; moveu = 1; }
    };
  }
  root.CameraGestures = Object.freeze({create});
})(globalThis);
