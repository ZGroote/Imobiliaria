/* Boundary wall geometry, clipping and terrain samples. */
(function(root) {
  "use strict";
const MURO_COR = [[122,78,58], [96,62,47], [186,180,168], [172,158,132],
                  [150,146,138], [108,112,104], [200,196,186], [86,84,78]];
function build(a, {THREE, roadSafety, terrainY, hash, registerTerrain, material, shadows,
                   projeta = false}) {
  const detailSegments=[];
  const sources=[];
  if(roadSafety){
    const clean=[];let x=0,z=0,previousX=0,previousZ=0;
    for(let i=0;i<a.length;i+=4){
      x+=a[i];z+=a[i+1];const dx=a[i+2],dz=a[i+3];
      for(const [lo,hi] of roadSafety.clipSegment([x/10,z/10],[(x+dx)/10,(z+dz)/10])){
        const ax=x+lo*dx,az=z+lo*dz,bx=x+hi*dx,bz=z+hi*dz;
        clean.push(ax-previousX,az-previousZ,bx-ax,bz-az);sources.push(i/4);
        previousX=ax;previousZ=az;
      }
    }
    a=clean;
  }
  const n = a.length/4, H = 2.2;
  // O muro segue o relevo pelas DUAS PONTAS, nao por uma cota so no meio.
  //
  // Com uma amostra no centro o quad nasce HORIZONTAL: numa encosta as duas pontas
  // ficam fora do chao (uma enterrada, outra no ar). Medido nos 175 mil segmentos
  // desta base: 31% erravam mais de 1,1 m na ponta -- metade da altura do muro --,
  // p99 6,8 m, maximo 76 m. E o relevo aqui e exagerado 4,5x (TERRAIN_EXAG), o que
  // multiplica o erro por 4,5. Amostrando as pontas, a base vira uma reta colada no
  // chao e o p99 cai pra 0,64 m.
  //
  // Segmento comprido ainda corta a curvatura do terreno -- o fundo de uma fileira
  // inteira e UMA reta de ate 383 m depois da fusao de colineares do gen_muros --,
  // entao ele e quebrado a cada PASSO metros. A 40 m: +8% de quads (175k -> 188k),
  // erro acima de 1,1 m em 0,29% dos segmentos. E quebra AQUI, na montagem: o
  // arquivo continua com os mesmos 175 mil segmentos delta-encodados.
  //
  // Continua UMA amostra de terrainY por ponta de pedaco (~370k) e nao uma por
  // vertice (3,27M): esta ultima trava o carregamento e o streamPump nao monta os
  // predios.
  const PASSO = 40;
  let px=0, pz=0, quads=0;
  const npedaco = new Int32Array(n);
  for (let i=0;i<n;i++){
    const x0 = px + a[i*4], z0 = pz + a[i*4+1];
    const x1 = x0 + a[i*4+2], z1 = z0 + a[i*4+3];
    px = x0; pz = z0;
    const L = Math.hypot((x1-x0)/10, (z1-z0)/10);
    const k = Math.max(1, Math.ceil(L/PASSO));
    npedaco[i] = k; quads += k;
  }
  const pos = new Float32Array(quads*18), dy = new Float32Array(quads*6);
  // Altura dentro do muro: 0 na base, 1 no topo. Um byte por vertice (1,1 MB na
  // cidade inteira). Nao da pra tirar isso da posicao no shader: o relevo ja foi
  // somado no Y na CPU (applyTerrainToGeo), entao a base de cada pedaco esta numa
  // cota diferente e nao existe "y do muro" pra ler. Ja a direcao ao longo do muro
  // sai de graca da derivada da posicao, e por isso NAO vira atributo.
  const mv = new Uint8Array(quads*6);
  // v10: o muro deixou de ter uma cor so. Na rua ele vai de tijolo a vista a pintado
  // claro, e uma fileira inteira do mesmo cinza era o que mais denunciava geracao
  // automatica. A cor e por SEGMENTO (nao por quad), senao um muro comprido fica
  // xadrez -- e o segmento aqui ja e a divisa inteira, depois da fusao de colineares.
  // Byte normalizado: 3 B por vertice em vez de 12.
  const col = new Uint8Array(quads*18);
  let o=0, q=0; px=0; pz=0;
  for (let i=0;i<n;i++){
    const x0 = px + a[i*4], z0 = pz + a[i*4+1];
    const x1 = x0 + a[i*4+2], z1 = z0 + a[i*4+3];
    px = x0; pz = z0;
    const k = npedaco[i];
    let ax = x0/10, az = z0/10, da = terrainY(ax, az);
    for (let s=1;s<=k;s++){
      const t = s/k;
      const bx = (x0 + (x1-x0)*t)/10, bz = (z0 + (z1-z0)*t)/10;
      const db = terrainY(bx, bz);
      detailSegments.push({ax,az,bx,bz,da,db,vertex:q,seed:sources[i]??i});
      pos[o++]=ax; pos[o++]=0; pos[o++]=az;
      pos[o++]=bx; pos[o++]=0; pos[o++]=bz;
      pos[o++]=bx; pos[o++]=H; pos[o++]=bz;
      pos[o++]=ax; pos[o++]=0; pos[o++]=az;
      pos[o++]=bx; pos[o++]=H; pos[o++]=bz;
      pos[o++]=ax; pos[o++]=H; pos[o++]=az;
      dy[q++]=da; dy[q++]=db; dy[q++]=db; dy[q++]=da; dy[q++]=db; dy[q++]=da;
      mv[q-6]=0; mv[q-5]=0; mv[q-4]=255; mv[q-3]=0; mv[q-2]=255; mv[q-1]=255;
      const c = MURO_COR[(hash((sources[i]??i)*2654435761 % 2147483647) * MURO_COR.length) | 0] || MURO_COR[0];
      for (let v=0; v<6; v++) { col[o-18+v*3] = c[0]; col[o-18+v*3+1] = c[1]; col[o-18+v*3+2] = c[2]; }
      ax = bx; az = bz; da = db;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos,3));
  g.setAttribute("aMv", new THREE.BufferAttribute(mv,1,true));
  const detailHidden=new THREE.BufferAttribute(new Uint8Array(quads*6),1);
  detailHidden.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute("aDetailHidden",detailHidden);
  // v8: sem normal. O muro e um quad vertical plano e a malha nao e
  // indexada -- computeVertexNormals devolvia a normal da FACE, que e
  // exatamente o que flatShading calcula no fragmento. Mesma imagem,
  // menos 12 B x 1,1 M vertices e menos um passo no carregamento.
  g.userData.ground = true;
  g.userData.presetDY = dy;
  registerTerrain(g);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3, true));
  /* O muro tinha cor por segmento e mais nada: visto da rua, 5.500 km de fita lisa.
     Aqui ele ganha o que todo muro de rua tem -- pilarete no ritmo, capa por cima,
     fiada de bloco e o encardido da base. Tudo desenhado no fragmento, com UM byte
     por vertice de atributo novo e zero chamada de desenho a mais.

     A direcao ao longo do muro sai da DERIVADA da posicao de mundo: o quad e
     vertical e plano, entao o produto vetorial das duas derivadas de tela e a normal
     da face, e o horizontal perpendicular a ela corre ao longo do muro. Isso da uma
     coordenada continua em metros que atravessa a emenda entre dois pedacos do mesmo
     segmento (o muro e quebrado a cada 40 m pra acompanhar o relevo) -- um contador
     por quad faria o pilarete pular na emenda. */
  const mat = material;
  const m = new THREE.Mesh(g, mat);
  m.userData.ground = true; m.userData.muros = true;
  m.receiveShadow = shadows; m.castShadow = projeta && shadows;
  return {mesh:m, detailSegments, detailHidden};
}
  root.WorldWalls = Object.freeze({build});
})(globalThis);
