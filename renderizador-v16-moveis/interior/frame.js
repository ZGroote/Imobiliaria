/* Interior animation step; called by the application's single frame loop. */
(function(root) {
  "use strict";
  function create({THREE, INT, FP, CORTE, CORTE_OFF, camera, target, OLHO,
                   terrainYCached, baseDaCasa, alturaDoCorte, aplicaFuro, distribuiLuzes,
                   seleciona, fpPasso, posicionaMedidas, getWidth, getHeight}) {
    let _tAnt = 0;
function interiorFrame(now) {
  const dt = _tAnt ? (now - _tAnt)/1000 : 0; _tAnt = now;
  // O corte persegue o alvo. Na volta ele sobe em progressão e, passado o
  // telhado mais alto, salta pro infinito: interpolar até 1e6 nunca chegaria lá.
  if (CORTE.constant !== INT.corteAlvo) {
    if (INT.corteAlvo === CORTE_OFF) {
      CORTE.constant += Math.max(6, (CORTE.constant - INT.baseY) * 0.35);
      if (CORTE.constant > INT.baseY + 90) CORTE.constant = CORTE_OFF;
    } else {
      const k = Math.min(1, dt*6);
      CORTE.constant += (INT.corteAlvo - CORTE.constant) * k;
      if (Math.abs(INT.corteAlvo - CORTE.constant) < 0.01) CORTE.constant = INT.corteAlvo;
    }
  }
  if (!INT.on && !INT.voo) return;
  if (INT.pl) {
    // v11: o alvo passa pelo cache de terrainY (1.2 do plano) -- e o mesmo ponto que o
    // frame() acabou de amostrar, entao aqui ele ja vem da casa do cache.
    if (INT.on) terrainYCached(target.x, target.z);
    // O alvo da orbita mora no PISO da unidade, nao no terreno. Sem isto a vista de
    // planta de um apartamento do 3o andar orbita um ponto 9 m abaixo dele -- e o que
    // aparece na tela e a laje vista por baixo.
    if (INT.on) target.y = INT.baseY;
    const by = baseDaCasa(INT.pl);
    if (Math.abs(by - INT.baseY) > 1e-4) {
      INT.baseY = by; INT.raiz.position.y = by;
      INT.corteAlvo = alturaDoCorte();
      aplicaFuro();
      // A lampada esta pendurada no forro DA UNIDADE, entao ela sobe com o piso.
      for (const L of INT.lamps) L.p.y = INT.baseY + INT.pl.pd - 0.28;
      distribuiLuzes(true);
      if (INT.sel >= 0) seleciona(INT.sel);
    }
    // A luz emprestada segue quem olha -- so faz sentido com mais lampada acesa que
    // luz no pool; a funcao sai cedo quando a lista nao muda.
    if (INT.on && INT.lamps.length > INT.pool.length) distribuiLuzes(false);
  }
  if (INT.voo) {
    const v = INT.voo, t = Math.min(1, (now - v.t0)/v.dur);
    const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
    camera.position.lerpVectors(v.p0, v.p1, e);
    THREE.Quaternion.slerp ? THREE.Quaternion.slerp(v.q0, v.q1, camera.quaternion, e)
                           : camera.quaternion.slerpQuaternions(v.q0, v.q1, e);
    if (t >= 1) { INT.voo = null; v.fim(); }
    return;
  }
  if (INT.fp) {
    fpPasso(dt);
    camera.position.set(FP.pos.x, INT.baseY + OLHO, FP.pos.z);
    camera.rotation.set(FP.pitch, FP.yaw, 0);
  }
  // O laço só atualiza a matriz da câmera DEPOIS daqui; sem isto o rótulo do
  // cômodo projetaria com a matriz do frame anterior e ficaria arrastando.
  camera.updateMatrixWorld();
  const W2 = getWidth(), H2 = getHeight();
  for (const r of INT.rotulos) {
    // O rotulo e <div> projetado: nao passa pelo teste de profundidade, entao em
    // primeira pessoa o nome de TODO comodo aparece atravessando as paredes. Na
    // vista de planta isso e certo (nao ha parede na frente); andando, nao. Quem
    // nomeia o comodo em que se esta e o minimapa.
    if (INT.fp) { r.el.style.display = "none"; continue; }
    r.v.set(r.c.cx, INT.baseY + 1.95, r.c.cz).project(camera);
    if (r.v.z > 1 || Math.abs(r.v.x) > 1.05 || Math.abs(r.v.y) > 1.05) {
      r.el.style.display = "none"; continue;
    }
    r.el.style.display = "block";
    r.el.style.transform = "translate(" + ((r.v.x*0.5+0.5)*W2) + "px," +
      ((-r.v.y*0.5+0.5)*H2) + "px) translate(-50%,-50%)";
  }
  posicionaMedidas(W2, H2);
}


    return interiorFrame;
  }
  root.InteriorFrame = Object.freeze({create});
})(globalThis);
