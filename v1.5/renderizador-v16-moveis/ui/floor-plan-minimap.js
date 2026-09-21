/* Interior minimap uses the apartment frame and shares the existing minimap canvas. */
(function(root) {
  "use strict";
  function create({INT, MM, FP, camera, inside, document, getComputedStyle}) {
function locDaPlanta(pl, x, z) {
  // inversa de pl.W: a matriz e [[ux,-uz],[uz,ux]] (rotacao pura), entao a inversa e a
  // transposta -- nao ha divisao nem caso degenerado.
  const o = pl.ob, dx = x - o.cx, dz = z - o.cz;
  return [o.ux*dx + o.uz*dz, -o.uz*dx + o.ux*dz];
}

function desenhaPlantaMini() {
  const pl = INT.pl;
  if (!pl || !pl.comodos || !pl.comodos.length) return;
  if (!MM.ctx) MM.ctx = MM.cv.getContext("2d");
  const g = MM.ctx, S = MM.cv.width;

  // Os limites nao mudam enquanto se anda: valem por planta.
  if (MM.limPl !== pl) {
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const c of pl.comodos) for (const p of c.poly) {
      const q = locDaPlanta(pl, p[0], p[1]);
      if (q[0] < u0) u0 = q[0]; if (q[0] > u1) u1 = q[0];
      if (q[1] < v0) v0 = q[1]; if (q[1] > v1) v1 = q[1];
    }
    MM.limPl = pl; MM.lim = { u0, u1, v0, v1 };
  }
  // A faixa de baixo e da legenda: sem reserva-la, um apartamento mais alto que largo
  // encosta na linha do texto e os dois se atrapalham.
  const L = MM.lim, M = 12, MB = 22;
  const esc = Math.min((S - 2*M) / Math.max(0.5, L.u1 - L.u0),
                       (S - M - MB) / Math.max(0.5, L.v1 - L.v0));
  const ccu = (L.u0 + L.u1)/2, ccv = (L.v0 + L.v1)/2, cy = (M + S - MB) / 2;
  const px2 = (u, v) => [S/2 + (u - ccu)*esc, cy + (v - ccv)*esc];

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  g.fillStyle = "#0E141C"; g.fillRect(0, 0, S, S);

  // Em que comodo se esta. E o unico destaque de cor da planta: "voce esta aqui" dito
  // pelo comodo inteiro se le de relance, coisa que um ponto de 3 px nao faz.
  const aqui = pl.comodos.find(c => inside(c.poly, FP.pos.x, FP.pos.z)) || null;

  for (const c of pl.comodos) {
    g.beginPath();
    for (let i = 0; i < c.poly.length; i++) {
      const q = locDaPlanta(pl, c.poly[i][0], c.poly[i][1]);
      const s = px2(q[0], q[1]);
      if (i === 0) g.moveTo(s[0], s[1]); else g.lineTo(s[0], s[1]);
    }
    g.closePath();
    g.fillStyle = c === aqui ? "rgba(75,219,124,.20)" : "rgba(226,232,240,.11)";
    g.fill();
  }

  // Parede INTEIRA (do chao ao teto) so. Peitoril e verga sao pedacos da mesma parede
  // na mesma posicao em planta: desenhar todos taparia justamente o vao, que e o que a
  // planta precisa mostrar -- onde se passa de um comodo pro outro.
  g.lineWidth = 2.1; g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = "rgba(231,235,240,.86)";
  g.beginPath();
  for (const w of pl.paredes) {
    if (w.y0 > 0.06 || w.y1 < pl.pd - 0.06) continue;
    const a = locDaPlanta(pl, w.a[0], w.a[1]), b = locDaPlanta(pl, w.b[0], w.b[1]);
    const sa = px2(a[0], a[1]), sb = px2(b[0], b[1]);
    g.moveTo(sa[0], sa[1]); g.lineTo(sb[0], sb[1]);
  }
  g.stroke();

  // A janela e o vao que CONTINUA sendo parede: linha fina no lugar dela. A porta fica
  // como buraco, que e como planta de arquitetura se le.
  g.lineWidth = 1.0; g.strokeStyle = "rgba(120,190,255,.75)";
  g.beginPath();
  for (const e of pl.esquadrias) {
    if (e.porta) continue;
    const a = locDaPlanta(pl, e.a[0], e.a[1]), b = locDaPlanta(pl, e.b[0], e.b[1]);
    const sa = px2(a[0], a[1]), sb = px2(b[0], b[1]);
    g.moveTo(sa[0], sa[1]); g.lineTo(sb[0], sb[1]);
  }
  g.stroke();

  // Onde se esta e pra onde se olha. A camera olha em (-sen yaw, -cos yaw) no mundo; a
  // mesma rotacao inversa dos pontos leva a direcao pro referencial da planta.
  const q = locDaPlanta(pl, FP.pos.x, FP.pos.z);
  const s = px2(q[0], q[1]);
  const dx = -Math.sin(FP.yaw), dz = -Math.cos(FP.yaw);
  const du = pl.ob.ux*dx + pl.ob.uz*dz, dv = -pl.ob.uz*dx + pl.ob.ux*dz;
  const ang = Math.atan2(dv, du);
  const meioFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
  g.beginPath(); g.moveTo(s[0], s[1]);
  g.arc(s[0], s[1], 30, ang - meioFov, ang + meioFov);
  g.closePath(); g.fillStyle = "rgba(75,219,124,.20)"; g.fill();
  g.beginPath(); g.arc(s[0], s[1], 4.4, 0, Math.PI*2);
  g.fillStyle = "rgba(10,15,21,.85)"; g.fill();
  g.beginPath(); g.arc(s[0], s[1], 3.0, 0, Math.PI*2);
  g.fillStyle = "#4BDB7C"; g.fill();

  // Legenda: o comodo em que se esta. E o que o rotulo 3D ja diz quando se olha pra
  // ele, dito aqui sem precisar olhar.
  const txt = aqui ? aqui.nome + " \u00b7 " + Math.round(aqui.area) + " m\u00b2"
                   : Math.round(pl.area) + " m\u00b2";
  g.font = "600 10px " + getComputedStyle(document.body).fontFamily;
  g.textAlign = "left";
  g.fillStyle = "rgba(8,12,17,.75)"; g.fillText(txt, 8, S - 6);
  g.fillStyle = "rgba(231,235,240,.72)"; g.fillText(txt, 7, S - 7);
}


    return {locDaPlanta, desenhaPlantaMini};
  }
  root.FloorPlanMinimap = Object.freeze({create});
})(globalThis);
