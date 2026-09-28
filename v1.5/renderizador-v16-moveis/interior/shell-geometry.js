/* Interior shell geometry: the wall prism (faces, vertical gradient, light-atlas UVs) and a segment quad. */
(function(root) {
  "use strict";
/* `fy` e uma gradacao VERTICAL opcional, aplicada na cor por vertice.

   Parede de comodo nao tem uma cor so, e era isso que deixava o interior sonso: cada
   face saia num tom chapado do rodape ao forro, e tres faces chapadas lado a lado leem
   como maquete de papel. Na vida a parede escurece no encontro com o piso (contato),
   clareia na faixa da janela -- que e por onde a luz entra e por onde ela ricocheteia
   do chao -- e cai um pouco de novo no forro.

   Sai de graca porque o prisma ja emite o vertice de baixo e o de cima separados: a
   gradacao e interpolada pelo proprio rasterizador, sem um triangulo a mais. */
function prismaQuad(P, N, C, U, q, y0, y1, rgb, fy, U2, pecas, semTampa, semPontas, fPonta, cortesPontas) {
  // `U2`/`pecas`: a UV do atlas de luz. `pecas` e um vetor de 5 funcoes, uma por
  // face deste prisma, ja enderecadas por quem chamou -- ver `cursorDeLuz`.
  /* `fPonta`: quanto a PONTA do prisma escurece. A ponta que sobra (a que morre num
     vao) e a face do rasgo da porta, e ela tem a normal virada pro comodo enquanto as
     duas faces ao lado dela estao quase de perfil pra camera. So por isso ela recebe
     mais luz difusa e sai como um FIO CLARO ao lado de toda ombreira -- provado por
     A/B: com a luz desligada (emissive chapado) o fio some; com sombra desligada,
     lightmap desligado, textura desligada ou cor-de-vertice sozinha, o fio FICA.
     Nao e vazamento de sombra nem costura de atlas: e a resposta difusa de uma tira de
     10 cm de frente pra sala. Num rasgo de verdade essa faixa esta na sombra da propria
     abertura -- e e isso que o fator repoe. */
  let _ponta = false;
  const put = (x,y,z,nx,ny,nz,u,v) => {
    const f = (fy ? fy(y) : 1) * (_ponta ? fPonta : 1);
    P.push(x,y,z); N.push(nx,ny,nz); U.push(u,v);
    C.push(Math.min(255, rgb[0]*f), Math.min(255, rgb[1]*f), Math.min(255, rgb[2]*f));
  };
  let mapa = null;
  const put2 = (a, b) => { if (U2) { const t = mapa ? mapa(a, b) : [0, 0]; U2.push(t[0], t[1]); } };
  // Com `fy` a face e fatiada em quatro. Sem isso a gradacao vira uma RETA entre o
  // vertice do rodape e o do forro -- a curva existiria no codigo e nao na tela, que
  // foi exatamente o que aconteceu na primeira tentativa.
  const NF = fy ? 4 : 1;
  const H = (y1 - y0) || 1;
  /* `semPontas`: nao emitir as duas faces CURTAS (i = 1 e 3), que sao as pontas do
     prisma. Elas nao existem em obra: toda ponta de parede ou morre dentro de outra
     parede, ou morre num vao -- e vao e acabado com marco e guarnicao, que e geometria
     que ja esta la (ver `ESQ_MARCO`). Desenhar a ponta e desenhar reboco virando a
     esquina do rasgo.

     E nao e so redundancia: a ponta e uma tira de ~10 cm cuja NORMAL olha pro comodo,
     encravada entre duas faces que estao no canto. O bake entrega a ela irradiancia de
     superficie exposta e sombra as vizinhas -- listra clara vertical em toda quina e em
     toda ombreira, que e o segundo "vazamento de luz" que o usuario apontou. Provado
     pintando as pontas de magenta: as listras que ele fotografou ficaram magenta.     */
  for (let i = 0; i < 4; i++) {
    // `semPontas` e MASCARA, nao booleano: bit 1 apaga a ponta do lado `a` (face i=3),
    // bit 2 a do lado `b` (face i=1). Por que por ponta e nao pelas duas: a ponta que
    // morre numa OUTRA parede nao existe (esta dentro dela) e so entrega a listra; a
    // ponta que morre num VAO e o rasgo da porta, que existe e tem que aparecer.
    if ((semPontas & 2) && i === 1) continue;
    if ((semPontas & 1) && i === 3) continue;
    _ponta = (fPonta != null) && (i === 1 || i === 3);
    const a = q[i], b = q[(i+1)%4];
    let nx = b[1]-a[1], nz = -(b[0]-a[0]);
    const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    const c = Math.hypot(b[0]-a[0], b[1]-a[1]);   // UV corre com o comprimento real
    mapa = pecas ? pecas[i] : null;
    if (!cortesPontas?.[i]?.length) {
    for (let k = 0; k < NF; k++) {
      const ya = y0 + (y1-y0)*k/NF, yb = y0 + (y1-y0)*(k+1)/NF;
      const va = (ya-y0)/H, vb = (yb-y0)/H;
      put(a[0],ya,a[1],nx,0,nz,0,ya); put2(0, va);
      put(b[0],ya,b[1],nx,0,nz,c,ya); put2(1, va);
      put(b[0],yb,b[1],nx,0,nz,c,yb); put2(1, vb);
      put(a[0],ya,a[1],nx,0,nz,0,ya); put2(0, va);
      put(b[0],yb,b[1],nx,0,nz,c,yb); put2(1, vb);
      put(a[0],yb,a[1],nx,0,nz,0,yb); put2(0, vb);
    }
      continue;
    }
    // Recorta somente a parte da ponta coberta por outro prisma. A parte
    // exposta continua opaca; a coberta nao duplica a face da parede vizinha.
    let retangulos = [[0, 1, y0, y1]];
    for (const [l,r,baixo,alto] of (cortesPontas?.[i] || [])) {
      retangulos = retangulos.flatMap(([x0,x1,z0,z1]) => {
        const a=Math.max(x0,l), b=Math.min(x1,r), c=Math.max(z0,baixo), d=Math.min(z1,alto);
        if (b-a < 1e-7 || d-c < 1e-7) return [[x0,x1,z0,z1]];
        return [[x0,a,z0,z1],[b,x1,z0,z1],[a,b,z0,c],[a,b,d,z1]]
          .filter(q => q[1]-q[0]>1e-7 && q[3]-q[2]>1e-7);
      });
    }
    for (const [t0,t1,baixo,alto] of retangulos) for (let k = 0; k < NF; k++) {
      const ya = Math.max(baixo,y0+(y1-y0)*k/NF), yb = Math.min(alto,y0+(y1-y0)*(k+1)/NF);
      if (yb <= ya) continue;
      const va = (ya-y0)/H, vb = (yb-y0)/H;
      const ax=a[0]+(b[0]-a[0])*t0, az=a[1]+(b[1]-a[1])*t0;
      const bx=a[0]+(b[0]-a[0])*t1, bz=a[1]+(b[1]-a[1])*t1;
      put(ax,ya,az,nx,0,nz,c*t0,ya); put2(t0, va);
      put(bx,ya,bz,nx,0,nz,c*t1,ya); put2(t1, va);
      put(bx,yb,bz,nx,0,nz,c*t1,yb); put2(t1, vb);
      put(ax,ya,az,nx,0,nz,c*t0,ya); put2(t0, va);
      put(bx,yb,bz,nx,0,nz,c*t1,yb); put2(t1, vb);
      put(ax,yb,az,nx,0,nz,c*t0,yb); put2(t0, vb);
    }
  }
  /* `semTampa`: NAO emitir a face de cima. Existe pro rodape, e o motivo e o
     "vazamento de luz" que o usuario reportou na junta chao-parede.

     O rodape e um prisma 1,4 cm mais grosso que a parede, entao a tampa dele e uma
     PRATELEIRA de 7 mm virada pra cima. Virada pra cima ela ve o comodo inteiro, e
     tanto o bake quanto o lightmap entregam a ela a irradiancia de quem esta exposto
     -- enquanto tudo em volta esta no canto chao-parede, no escuro. Resultado: um fio
     branco de 1 px na base de toda parede, picotado porque 7 mm a 5 m de distancia nao
     chega a um pixel (medido: escurecer a tampa pra 0,72 da cor da parede nao resolveu,
     porque o problema e a EXPOSICAO dela, nao o albedo).

     Sem a tampa, o que se ve no lugar dela e a face interna do proprio prisma, que esta
     na sombra -- que e o que se ve num rodape de verdade: uma linha de sombra, nao uma
     de luz. Nao ha o que vazar por ali: o prisma continua fechado dos lados que
     importam, e a fresta de 7 mm da pro miolo da parede.                            */
  if (semTampa) return;
  // tampa de cima: a peca corre em (q0->q1) por (q0->q3), igual ao exportador
  mapa = pecas ? pecas[4] : null;
  const ux = q[1][0]-q[0][0], uz = q[1][1]-q[0][1];
  const vx = q[3][0]-q[0][0], vz = q[3][1]-q[0][1];
  const uu = (ux*ux + uz*uz) || 1, vv = (vx*vx + vz*vz) || 1;
  for (const k of [0,1,2, 0,2,3]) {
    put(q[k][0], y1, q[k][1], 0,1,0, q[k][0], q[k][1]);
    const dx = q[k][0]-q[0][0], dz = q[k][1]-q[0][1];
    put2((dx*ux + dz*uz)/uu, (dx*vx + dz*vz)/vv);
  }
}
function quadDoSeg(seg, esp) {
  const a = seg[0], b = seg[1];
  let dx = b[0]-a[0], dz = b[1]-a[1];
  const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  const nx = -dz*esp/2, nz = dx*esp/2;
  return [[a[0]+nx,a[1]+nz], [b[0]+nx,b[1]+nz], [b[0]-nx,b[1]-nz], [a[0]-nx,a[1]-nz]];
}

  root.ShellGeometry = Object.freeze({prismaQuad, quadDoSeg});
})(globalThis);
