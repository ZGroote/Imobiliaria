/* ============================================================
   5. Geometria a partir dos registros  (versão com tipologia)
   ============================================================
   Substitui o buildBuildings do v5. O contrato com o resto da página é o
   mesmo — mesma assinatura, mesmo { g, lg, count }, mesmos presetDY/
   presetCenter — porque o streaming por quarteirão do v4 depende disso.

   O que muda é só o que sai por prédio: além da caixa extrudada, agora saem
   telhado inclinado, platibanda, caixa de água e um atributo de tipologia que
   o shader lê pra desenhar a fachada certa.

   Custo: tudo isso entra nas MALHAS QUE JÁ EXISTEM (uma por quarteirão), sem
   criar nenhuma chamada de desenho nova. Num renderizador limitado por draw
   call — que é o caso medido aqui, 23 us por chamada — triângulo extra é de
   graça. O que não é de graça é VRAM, e por isso o atributo novo é Uint16
   (6 B/vértice) em vez de três floats (12 B).
   ============================================================ */
const V2 = THREE.Vector2;
const parcels = [];

function buildBuildings(recs, cx, cz) {
  const P=[],N=[],C=[],F=[],D=[],DY=[],CXY=[],S=[], LP=[],LD=[],LDY=[],LCXY=[];
  const c = new THREE.Color(), rc = new THREE.Color();
  let count = 0;

  for (const b of recs) {
    const r = b.r, h = b.h, cls = CLS[b.c];
    let mx=0, mz=0; for (const p of r) { mx+=p[0]; mz+=p[1]; }
    mx/=r.length; mz/=r.length;
    // Prédio real fica nivelado sobre o terreno (a fundação absorve a inclinação):
    // um valor de relevo por edificação, medido no centro. Ver comentário do v5.
    const by = terrainY(mx, mz);
    const dist = Math.min(1, Math.hypot(mx-cx, mz-cz) / (TILE_M*0.75));

    const rw = safeInset(r, BUILDING_INSET);
    const ob = obbOf(rw, b.area);
    const st = tipoDe(b.c, h, b.area, ob);
    const pal = PAL[st];

    // Semente estável: centroide em decímetros. Não depende da ordem de leitura
    // nem do quarteirão em que o prédio caiu — o mesmo prédio sorteia o mesmo
    // número em toda sessão, e continua sorteando depois de atualizar a base.
    const seed = ((Math.round(mx*10) * 73856093) ^ (Math.round(mz*10) * 19349663)) >>> 0;
    const s1 = hash(seed), s2 = hash(seed ^ 0x9E37), s3 = hash(seed ^ 0x85EB);
    const sd = Math.min(255, Math.floor(s1 * 256));

    c.setHex(pal.wall[Math.floor(s1 * pal.wall.length) % pal.wall.length]);
    c.offsetHSL(0, (s2 - 0.5) * 0.05, (s3 - 0.5) * 0.075);
    const rr = c.r, gg = c.g, bb = c.b;
    rc.setHex(pal.roof).offsetHSL(0, 0, (s2 - 0.5) * 0.06);

    // Cobertura: quem é retangular o bastante ganha água inclinada; o resto cai
    // pra laje com platibanda. Julgar isso pelo contorno evita telhado torto em
    // cima de polígono que não comporta — e polígono que não comporta é comum.
    let rise = 0, ph = 0, ov = 0, pitched = false;
    if (pal.telha === 1 && ob.rect > 0.76 && ob.hv > 1.6) {
      pitched = true; rise = Math.min(3.4, ob.hv * 0.62); ov = 0.55;
    } else if (pal.telha === 2 && ob.rect > 0.62) {
      pitched = true; rise = Math.min(2.4, ob.hv * 0.17); ov = 0.35;
    } else {
      ph = PLATIBANDA[st];
    }
    const hw = h + ph;                       // topo da parede
    const hUse = Math.max(0, Math.min(2600, Math.round(h * 10)));  // até onde vai janela

    if (b.c !== 0 && (b.name || b.addr || b.area > 500) && parcels.length < 2000)
      parcels.push({ x:mx, y:hw, z:mz, cls, tipo: ST_NOME[st],
        name: b.name || (b.c === 2 ? "Ponto comercial" : b.c === 3 ? "Equipamento público" : "Edificação residencial"),
        addr: b.addr, area: Math.round(b.area),
        lv: Math.max(1, Math.round((h-1.1)/LV)), h });

    const vtx = (x,y,z, nx,ny,nz, cr,cg,cb, fu,fv, dyv) => {
      P.push(x,y,z); N.push(nx,ny,nz); C.push(cr*255, cg*255, cb*255);
      F.push(fu,fv); D.push(dist); DY.push(dyv); CXY.push(mx,mz); S.push(st, sd, hUse);
    };
    // Triângulo com normal calculada e virada pra fora (o material é DoubleSide,
    // então a face aparece de qualquer jeito; quem decide a luz é a normal).
    const tri = (a, p2, p3, ref) => {
      const ux=p2[0]-a[0], uy=p2[1]-a[1], uz2=p2[2]-a[2];
      const vx=p3[0]-a[0], vy=p3[1]-a[1], vz=p3[2]-a[2];
      let nx=uy*vz-uz2*vy, ny=uz2*vx-ux*vz, nz=ux*vy-uy*vx;
      const L = Math.hypot(nx,ny,nz) || 1; nx/=L; ny/=L; nz/=L;
      const gx=(a[0]+p2[0]+p3[0])/3 - ref[0], gy=(a[1]+p2[1]+p3[1])/3 - ref[1], gz=(a[2]+p2[2]+p3[2])/3 - ref[2];
      if (nx*gx + ny*gy + nz*gz < 0) { nx=-nx; ny=-ny; nz=-nz; }
      for (const p of [a, p2, p3]) vtx(p[0],p[1],p[2], nx,ny,nz, rc.r,rc.g,rc.b, 0,-1, by);
    };

    /* --- laje / forro: fecha o volume por cima em h ------------------- */
    let triRoof; try { triRoof = triangulateRing(rw); } catch (e) { continue; }
    const roofFlat = new THREE.Color(pal.roof).lerp(c, pitched ? 0.10 : 0.34);
    for (const f of triRoof) for (const k of f)
      vtx(rw[k][0], h, rw[k][1], 0,1,0, roofFlat.r, roofFlat.g, roofFlat.b, 0,-1, by);

    /* --- águas do telhado, sobre o retângulo mínimo -------------------- */
    if (pitched) {
      const ux = ob.ux, uz = ob.uz, vx = -uz, vz = ux;
      const A = ob.hu + ov, B = ob.hv + ov;
      // Quatro águas encurta a cumeeira; duas águas mantém ela até a ponta, e aí
      // os mesmos dois triângulos das pontas viram empena vertical. É o mesmo
      // código: só o comprimento da cumeeira muda.
      const hip = pal.telha === 1 && s2 > 0.42;
      const RA = hip ? Math.max(0, A - B * 0.92) : A;
      const pt = (a, b2, y) => [ob.cx + ux*a + vx*b2, y, ob.cz + uz*a + vz*b2];
      const c1=pt(-A,-B,h), c2=pt(A,-B,h), c3=pt(A,B,h), c4=pt(-A,B,h);
      const r1=pt(-RA,0,h+rise), r2=pt(RA,0,h+rise);
      const ref = [ob.cx, h + rise*0.35, ob.cz];
      tri(c1,c2,r2,ref); tri(c1,r2,r1,ref);      // água de um lado
      tri(c3,c4,r1,ref); tri(c3,r1,r2,ref);      // água do outro
      tri(c2,c3,r2,ref); tri(c4,c1,r1,ref);      // tacaniça (4 águas) ou empena (2 águas)
    }

    /* --- paredes ------------------------------------------------------ */
    let run = 0;
    for (let i = 0, n = rw.length; i < n; i++) {
      const a = rw[i], b2 = rw[(i+1)%n];
      const dx = b2[0]-a[0], dz = b2[1]-a[1], L = Math.hypot(dx,dz);
      if (L < 0.05) continue;
      const nx = -dz/L, nz = dx/L, u0 = run, u1 = run + L; run = u1;
      const lo = 0.76;
      const q = [[a[0],0,a[1],u0,0,lo],[b2[0],0,b2[1],u1,0,lo],[b2[0],hw,b2[1],u1,hw,1],
                 [a[0],0,a[1],u0,0,lo],[b2[0],hw,b2[1],u1,hw,1],[a[0],hw,a[1],u0,hw,1]];
      // Base de cada parede segue o relevo no próprio ponto; o topo usa o valor
      // único do prédio, pra o telhado ficar nivelado. Igual ao v5.
      for (const p of q) {
        const dyv = p[1] === 0 ? terrainY(p[0],p[2]) : by;
        vtx(p[0],p[1],p[2], nx,0,nz, rr*p[5], gg*p[5], bb*p[5], p[3], p[4], dyv);
      }
      LP.push(a[0],hw,a[1], b2[0],hw,b2[1]); LD.push(dist,dist); LDY.push(by,by); LCXY.push(mx,mz,mx,mz);
    }

    /* --- caixa de água / casa de máquinas ----------------------------- */
    // Silhueta é o que se lê de longe. Uma caixinha no topo dos prédios altos
    // quebra a linha reta do skyline por ~30 triângulos cada.
    if ((st === ST.PREDIO || st === ST.TORRE || st === ST.CIVICO) && h > 13) {
      const w = Math.min(3.6, ob.hv * 0.55), d2 = Math.min(3.0, ob.hv * 0.45), hh = 2.3 + s3*1.4;
      if (w > 1.0 && d2 > 0.8) {
        const ux = ob.ux, uz = ob.uz, vx = -uz, vz = ux;
        const off = (s2 - 0.5) * ob.hu * 0.8;
        const bx = ob.cx + ux*off, bz = ob.cz + uz*off, y0 = hw, y1 = hw + hh;
        const cn = [[-w,-d2],[w,-d2],[w,d2],[-w,d2]].map(p => [bx + ux*p[0] + vx*p[1], bz + uz*p[0] + vz*p[1]]);
        const ref = [bx, (y0+y1)/2, bz];
        for (let i = 0; i < 4; i++) {
          const A2 = cn[i], B2 = cn[(i+1)%4];
          tri([A2[0],y0,A2[1]], [B2[0],y0,B2[1]], [B2[0],y1,B2[1]], ref);
          tri([A2[0],y0,A2[1]], [B2[0],y1,B2[1]], [A2[0],y1,A2[1]], ref);
        }
        tri([cn[0][0],y1,cn[0][1]], [cn[1][0],y1,cn[1][1]], [cn[2][0],y1,cn[2][1]], ref);
        tri([cn[0][0],y1,cn[0][1]], [cn[2][0],y1,cn[2][1]], [cn[3][0],y1,cn[3][1]], ref);
      }
    }
    count++;
  }

  if (!count) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P),3));
  g.setAttribute("normal",   new THREE.BufferAttribute(new Float32Array(N),3));
  g.setAttribute("color",    new THREE.BufferAttribute(new Uint8Array(C), 3, true));
  g.setAttribute("aFace",    new THREE.BufferAttribute(new Float32Array(F),2));
  g.setAttribute("aDist",    new THREE.BufferAttribute(new Float32Array(D),1));
  // Uint16 sem normalizar: chega no shader como float com o valor inteiro.
  // (tipo, semente 0-255, altura útil em decímetros) em 6 B em vez de 12.
  g.setAttribute("aStyle",   new THREE.BufferAttribute(new Uint16Array(S),3));
  g.computeBoundingSphere();
  g.userData.dynamicHeight = true;
  g.userData.presetDY = new Float32Array(DY);
  g.userData.presetCenter = new Float32Array(CXY);
  registerTerrain(g);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LP),3));
  lg.setAttribute("aDist",    new THREE.BufferAttribute(new Float32Array(LD),1));
  lg.computeBoundingSphere();
  lg.userData.presetDY = new Float32Array(LDY);
  lg.userData.presetCenter = new Float32Array(LCXY);
  return { g, lg, count };
}
