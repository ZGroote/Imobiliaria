/* v4: era assemble(). Além de montar, agora REGISTRA em `rec` tudo o que criou —
   malhas, parcelas e uniforms de animação — porque uma quadra que entra na visão
   também precisa poder sair. No v3 nada era descartado, então nada precisava ser
   rastreado. */
function assembleInto(rec, B, R, G, cx, cz) {
  const add = (o, parent) => { parent.add(o); rec.objs.push(o); return o; };
  const gp = buildPatches(G);
  if (gp.m) { const m = new THREE.Mesh(gp.m, flat(K.green)); m.receiveShadow = true; add(m, gRest); }
  const wk = buildRibbons(R, 0.18, 1.55);
  if (wk) { const m = new THREE.Mesh(wk, flat(K.walk)); m.receiveShadow = true; add(m, gRoad); }
  const rd = buildRibbons(R, 0.35, 1.0);
  if (rd) { const m = new THREE.Mesh(rd, flat(K.road)); m.receiveShadow = true; add(m, gRoad); }
  if (!LIGHT()) {
    const ds = buildDashes(R);
    if (ds) add(new THREE.Mesh(ds, new THREE.MeshBasicMaterial({ color:K.mark })), gRoad);
    const tm = buildTrees(gp.polys, R);
    if (tm) { add(tm, gRest); treeRegistry.push(tm); }
  }
  const p0 = parcels.length;
  const b = buildBuildings(B, cx, cz);
  // buildBuildings empurra em `parcels` (global); a fatia nova pertence a ESTA
  // quadra e volta pra ela, pra o overlay poder ser refeito só com o que vive.
  for (let i = p0; i < parcels.length; i++) rec.parcels.push(parcels[i]);
  if (b) {
    const u = { value: slow ? 1 : 0 };
    risers.push({ u, t0: performance.now() });
    rec.risers.push(u);
    const bm = new THREE.Mesh(b.g, facadeMaterial(u));
    // Mesmo motivo do v3: a esfera de corte é calculada antes de o shader deslocar
    // pelo relevo, então o Three.js às vezes descartava o bloco inteiro. Aqui o
    // descarte por distância já é feito pelo streaming, que é mais agressivo que
    // o frustum — manter desligado não custa o que custava no v3.
    bm.frustumCulled = false;
    bm.castShadow = true; bm.receiveShadow = true; add(bm, gBuild);
    if (!LIGHT()) {
      b.lg.userData.dynamicHeight = true; registerTerrain(b.lg);
      const lgLines = new THREE.LineSegments(b.lg, riseLine(u));
      lgLines.frustumCulled = false;
      add(lgLines, gLines);
    }
    else b.lg.dispose();
    blocks += b.count;
  }
  built++;
  return b ? b.count : 0;
}
