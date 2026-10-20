/* Circular terrain uses the source map's elevation clearance and NDVI material.
 * Grid triangles are clipped numerically before allocating geometry buffers. */
(function(root){
'use strict';
function build(options){
  const {THREE,scene,center,radius,sampleHeight:terrainY,sampleNDVI:ndviBruto,elevation:elevGrid,registry:terrainRegistry,registerTerrain,noiseGLSL:GLSL_RUIDO}=options;
  const ELEV_N=options.n,ELEV_HALF=options.half,TERRENO_SUB=options.subdivisions||4,TERRAIN_EXAG=options.exaggeration||1;
  if(!THREE||!scene||!Array.isArray(center)||center.length!==2||!center.every(Number.isFinite)||!Number.isFinite(radius)||radius<=.02)throw new Error('Invalid circular ground');

  if (!elevGrid) return;
  // Maior termo de torcao da grade -- e o quanto dois triangulos por celula erram
  // contra a bilinear do terrainY. Subdividir por SUB divide o erro por SUB^2.
  let torc = 0;
  for (let j=0;j<ELEV_N-1;j++) for (let i=0;i<ELEV_N-1;i++){
    const t = Math.abs(elevGrid[j*ELEV_N+i] + elevGrid[(j+1)*ELEV_N+i+1]
                     - elevGrid[j*ELEV_N+i+1] - elevGrid[(j+1)*ELEV_N+i]) / 4 * TERRAIN_EXAG;
    if (t > torc) torc = t;
  }
  const folga = Math.max(1.5, torc / (TERRENO_SUB*TERRENO_SUB) * 1.15 + 0.4);
  const N = (ELEV_N - 1) * TERRENO_SUB + 1, passo = 2*ELEV_HALF/(N-1);
  const co = i => -ELEV_HALF + i*passo;
  const loX=Math.max(0,Math.floor((center[0]-radius+ELEV_HALF)/passo)),hiX=Math.min(N-1,Math.ceil((center[0]+radius+ELEV_HALF)/passo));
  const loZ=Math.max(0,Math.floor((center[1]-radius+ELEV_HALF)/passo)),hiZ=Math.min(N-1,Math.ceil((center[1]+radius+ELEV_HALF)/passo));

  /* Quanto CADA no precisa descer alem da folga, por causa do triangulo de detalhe que
     passa por ele. Percorre os triangulos do chao de quarteirao e da malha de rua (os
     dois marcados com `chaoDetalhe`) e, para cada NO do fundo que cai dentro do
     triangulo, mede a distancia entre o plano do triangulo e o terreno real naquele
     ponto exato -- nao uma estimativa. Como o no e o mesmo ponto onde o vertice do
     fundo vai nascer, a garantia e exata, e nao "com folga pra mais".

     Custa o bastante para valer a pena dizer por que e barato: sao ~90 mil triangulos,
     mas o laco de dentro so visita NO, e a cidade inteira tem ~100 mil nos. Triangulo
     de rua normal nao cobre no nenhum e sai na caixa envolvente; quem custa e a meia
     duzia de poligonos gigantes, que sao justamente os que afundam. */
  const desce = new Float32Array(N*N);
  const noMin = c => Math.max(1, Math.ceil((c + ELEV_HALF)/passo));
  const noMax = c => Math.min(N-2, Math.floor((c + ELEV_HALF)/passo));
  for (const geo of terrainRegistry) {
    if (!geo.userData.chaoDetalhe) continue;
    const p = geo.attributes.position, dyv = geo.userData.terrain.dy;
    for (let t = 0; t + 2 < p.count; t += 3) {
      const ax=p.getX(t),   az=p.getZ(t),   ay=dyv[t];
      const bx=p.getX(t+1), bz=p.getZ(t+1), by=dyv[t+1];
      const cx=p.getX(t+2), cz=p.getZ(t+2), cy=dyv[t+2];
      const i0 = noMin(Math.min(ax,bx,cx) - passo), i1 = noMax(Math.max(ax,bx,cx) + passo);
      if (i0 > i1) continue;
      const j0 = noMin(Math.min(az,bz,cz) - passo), j1 = noMax(Math.max(az,bz,cz) + passo);
      if (j0 > j1) continue;
      const det = (bz-cz)*(ax-cx) + (cx-bx)*(az-cz);
      if (!det) continue;
      /* O triangulo vale UMA CELULA a mais para cada lado, e essa margem e o que faz a
         conta fechar na borda. Dentro do triangulo o fundo fica exatamente `folga`
         abaixo (as duas superficies sao lineares entre nos de dentro); mas a celula que
         atravessa a divisa tem um no dentro, rebaixado, e um fora, no zero, e a
         interpolacao entre eles sobe de volta por cima do detalhe. Sem esta margem
         sobravam 4 pontos espetando em Ribeirao, o pior por 15,7 m.

         A margem sai em coordenada baricentrica, nao em "um pouquinho": `wa` vai de 1
         no vertice a a 0 na aresta oposta, ao longo da altura |det|/|bc|, entao andar
         `passo` metros para fora daquela aresta e wa = -passo*|bc|/|det|. Assim a folga
         e um passo de verdade em qualquer triangulo, do esquio ao gigante. */
      const adet = Math.abs(det);
      const mgA = passo * Math.hypot(bx-cx, bz-cz) / adet;
      const mgB = passo * Math.hypot(cx-ax, cz-az) / adet;
      const mgC = passo * Math.hypot(ax-bx, az-bz) / adet;
      for (let j=j0;j<=j1;j++) for (let i=i0;i<=i1;i++){
        const x = -ELEV_HALF + i*passo, z = -ELEV_HALF + j*passo;
        const wa = ((bz-cz)*(x-cx) + (cx-bx)*(z-cz)) / det;
        if (wa < -mgA) continue;
        const wb = ((cz-az)*(x-cx) + (ax-cx)*(z-cz)) / det;
        if (wb < -mgB) continue;
        const wc = 1 - wa - wb;
        if (wc < -mgC) continue;
        /* No de DENTRO: wa/wb/wc ja estao em 0..1 e somam 1, e a conta e a exata. No
           da margem: grampeia e renormaliza, o que amostra o plano no ponto do
           triangulo mais proximo em vez de EXTRAPOLAR o plano para fora dele.
           Extrapolar foi a primeira versao e produziu mergulho de 4.389 m: num
           triangulo esquio a margem de um passo vale uma barbaridade em coordenada
           baricentrica, e o plano continuado por ela desce fora de escala. O poco de
           4 km ficava numa celula so, invisivel para o conferidor (que so pergunta se
           o fundo esta ABAIXO do detalhe) e bem visivel na tela ao lado de um buraco. */
        let ca = wa < 0 ? 0 : wa > 1 ? 1 : wa;
        let cb = wb < 0 ? 0 : wb > 1 ? 1 : wb;
        let cc = wc < 0 ? 0 : wc > 1 ? 1 : wc;
        const sw = ca + cb + cc;
        // afundou = o terreno real esta ACIMA do plano do triangulo neste ponto
        const d = terrainY(x, z) - (ay*ca + by*cb + cy*cc) / sw;
        const k = j*N+i;
        if (d > desce[k]) desce[k] = d;
      }
      /* E quatro amostras DENTRO do triangulo, marcadas nos nos da celula que as contem.
         O laco de cima so olha onde cai um no, e triangulo menor que a celula de 60 m
         pode nao conter nenhum -- foi assim que sobrou um ponto espetando 1,4 m em
         Araraquara, num triangulo de rua afundado 7,3 m entre dois nos de sobra zero.
         Sao ~360 mil amostras de terrainY na cidade inteira, a mesma ordem do muro, que
         ja e paga no boot. */
      for (let a2 = 0; a2 < 4; a2++) {
        const wa = a2 === 0 ? 1/3 : a2 === 1 ? 0.5 : a2 === 2 ? 0.5 : 0;
        const wb = a2 === 0 ? 1/3 : a2 === 1 ? 0.5 : a2 === 2 ? 0   : 0.5;
        const wc = 1 - wa - wb;
        const x = ax*wa + bx*wb + cx*wc, z = az*wa + bz*wb + cz*wc;
        const d = terrainY(x, z) - (ay*wa + by*wb + cy*wc);
        if (d <= 0) continue;
        const fi = (x + ELEV_HALF)/passo, fj = (z + ELEV_HALF)/passo;
        for (let dj=0; dj<2; dj++) for (let di=0; di<2; di++){
          const ii = Math.min(N-2, Math.max(1, Math.floor(fi) + di));
          const jj = Math.min(N-2, Math.max(1, Math.floor(fj) + dj));
          const k = jj*N+ii;
          if (d > desce[k]) desce[k] = d;
        }
      }
    }
  }

  /* Um passe de dilatacao por cima da margem. Sozinha a margem deixava 1 ponto espetando
     em Araraquara por 2,9 m: amostrar o plano no ponto do triangulo mais proximo e mais
     conservador que extrapola-lo, entao na celula de divisa a interpolacao ainda sobe um
     pouco. Espalhar o mergulho mais um no fecha isso, e espalha so 60 m -- a extrapolacao,
     que era a alternativa, espalhava 4 km de poco. */
  {
    const ant = desce.slice();
    for (let j=loZ;j<=hiZ;j++) for (let i=loX;i<=hiX;i++){
      let mx2 = ant[j*N+i];
      for (let dj=-1; dj<=1; dj++) for (let di=-1; di<=1; di++){
        const jj=j+dj, ii=i+di;
        if (jj<0||jj>=N||ii<0||ii>=N) continue;
        const v2 = ant[jj*N+ii]; if (v2 > mx2) mx2 = v2;
      }
      desce[j*N+i] = mx2;
    }
  }


  const sides=720,r=radius-.01,inner=r*Math.cos(Math.PI/sides),edges=[];
  for(let i=0;i<sides;i++){const angle=(i+.5)*2*Math.PI/sides;edges.push([Math.cos(angle),Math.sin(angle),inner]);}
  function clip(poly){
    if(poly.every(p=>Math.hypot(p[0]-center[0],p[2]-center[1])<=inner))return poly;
    for(const [nx,nz,d] of edges){
      const next=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],da=d-nx*(a[0]-center[0])-nz*(a[2]-center[1]),db=d-nx*(b[0]-center[0])-nz*(b[2]-center[1]);
        if(da>=0)next.push(a);
        if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);next.push(a.map((v,k)=>v+(b[k]-v)*t));}
      }
      poly=next;if(poly.length<3)return [];
    }
    return poly;
  }
  const positions=[],colors=[],indices=[],vertices=new Map();let area=0,maxRadius=0;
  function vertex(p){
    const key=p[0].toFixed(6)+','+p[2].toFixed(6);if(vertices.has(key))return vertices.get(key);
    const id=positions.length/3,rr=Math.hypot(p[0]-center[0],p[2]-center[1]);
    if(rr>radius)throw new Error('Circular ground outside radius');maxRadius=Math.max(maxRadius,rr);
    positions.push(...p);const t=Math.max(0,Math.min(1,(ndviBruto(p[0],p[2])-.14)/.42));
    colors.push(34+(48-34)*(1-t),40+(74-40)*t,34+(36-34)*(1-t));vertices.set(key,id);return id;
  }
  function triangle(a,b,c){
    const poly=clip([a,b,c]);for(let k=1;k+1<poly.length;k++){
      const p=poly[0],q=poly[k],v=poly[k+1],cross=(q[0]-p[0])*(v[2]-p[2])-(q[2]-p[2])*(v[0]-p[0]);
      if(Math.abs(cross)<1e-7)continue;area+=Math.abs(cross)/2;indices.push(vertex(p),vertex(q),vertex(v));
    }
  }
  function node(i,j){return [co(i),-(folga+desce[j*N+i]),co(j)];}
  for(let j=loZ;j<hiZ;j++)for(let i=loX;i<hiX;i++){
    const x0=co(i),x1=co(i+1),z0=co(j),z1=co(j+1),qx=Math.max(x0,Math.min(x1,center[0])),qz=Math.max(z0,Math.min(z1,center[1]));
    if(Math.hypot(qx-center[0],qz-center[1])>r)continue;
    const a=node(i,j),b=node(i+1,j),c=node(i,j+1),d=node(i+1,j+1);triangle(a,c,b);triangle(b,c,d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(positions),3));
  g.setAttribute('color',new THREE.BufferAttribute(new Uint8Array(colors),3,true));g.setIndex(indices);
  g.userData.ground=true;g.userData.regionalCircleClipped=true;
  const diagnostics={policy:'continuous-circle',center:center.slice(),radius,vertices:positions.length/3,triangles:indices.length/3,area_m2:area,max_radius_m:maxRadius};
  g.userData.circularGround=diagnostics;registerTerrain(g);
  const mat = new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.DoubleSide, fog:true });
  mat.onBeforeCompile = sh => {
    // Sem isto o fundo e um lencol de cor unica por centenas de metros. Duas oitavas de
    // ruido em espaco de mundo custam quatro senos por fragmento e nenhum byte.
    sh.vertexShader = "varying vec3 vTer;\n" +
      sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvTer=transformed;");
    sh.fragmentShader = "varying vec3 vTer;\n" + (typeof GLSL_RUIDO==='function'?GLSL_RUIDO():GLSL_RUIDO) +
      sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      diffuseColor.rgb *= 0.80 + 0.40 * vnoise(vTer.xz * 0.0055);
      diffuseColor.rgb *= 0.92 + 0.16 * vnoise(vTer.xz * 0.034);`);
  };
  mat.customProgramCacheKey = () => "terrenobase";
  const m = new THREE.Mesh(g, mat);
  m.userData.ground = true;
  m.renderOrder = -4;          // debaixo do chao de quarteirao (-2) e da rua (-1)
  scene.add(m);
  root.__gTerreno = m;

  m.name='liv-chao-circular';m.userData.circularGround=diagnostics;
  m.userData.folga=folga;let descentMax=0;for(const value of desce)descentMax=Math.max(descentMax,value);m.userData.desceMax=descentMax;
  root.__livCircularGround=diagnostics;
  return m;
}
root.LivCircularGround={build};
})(globalThis);
