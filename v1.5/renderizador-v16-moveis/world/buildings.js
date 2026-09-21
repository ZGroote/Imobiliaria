/* Procedural building geometry, palette and roofs. Scene insertion remains with streaming. */
(function(root) {
  "use strict";
  function create({THREE, APAR, CLS, TILE_M, LV, geometry, types, hash, terrainY,
                   registerTerrain, triangulateRing, explicitBuilding, getRoadSafety}) {
    const {shoelace, safeInset, obbOf} = geometry;
    const {ST, tipoDe, BUILDING_INSET} = types;
const PAL = [
  { // CASA
    wall:[0xEFE7D8,0xE8ECE6,0xDCE4EC,0xF0E2CC,0xE6DED4,0xD9E3D8,0xF2E8CE,0xE3CBB4,0xE8D9A8,
          0xCF7F5C,0xB86A4E,0xC98F62,0xA8724F,0x9FA9A2,0x8E9AA6,0xBFB08C,0x7E8C82,0xD4A98A,
          0xC2C6C0,0xAA9E90],
    roof:0x8E452E, telha:1, laje:0x81807B,
    roofs:[0x8E452E,0x9D5637,0xA35E3C,0x8A4A34,0x7B412D,0x96543D,0x9B5E48,0x7D7B76,0x6B6964,0x6E4A3A] },
  { // SOBRADO
    wall:[0xEAE1D0,0xDFE6EA,0xEDE6DA,0xE2DACE,0xD7DFE6,0xEFDFC4,0xD8BCA6,
          0xC08A66,0xA6B0AA,0x98A4B0,0xB9A882,0x8F7F6E],
    roof:0x864029, telha:1, laje:0x7E7C77,
    roofs:[0x864029,0x924C32,0x9A563B,0x8A4B36,0x723725,0x76746F,0x633D32] },
  { wall:[0xDCDFE3,0xE4E1DA,0xD2D8DE,0xE7E4DD,0xCFD6D9],          roof:0x6E757D, telha:0, laje:0x75797C },  // PREDIO
  { wall:[0xE6E3DC,0xE9DED2,0xDDE3E7,0xEFEAE0,0xD8DCD6],          roof:0x6A7079, telha:0, laje:0x74777B },  // COMERCIO
  { wall:[0xB9C4CE,0xAFBCC7,0xC3CBD2,0xA8B6C2],                   roof:0x5C646E, telha:0, laje:0x6B7076 },  // TORRE
  { wall:[0xC9CFD4,0xD5D8D6,0xBFC7CD,0xDCDEDB],                   roof:0x6F757C, telha:2, laje:0x6B7073 },  // GALPAO
  { wall:[0xEDE9E0,0xE3E7EA,0xF0EADF,0xDFE4E2],                   roof:0x7A6F66, telha:0, laje:0x79756E },  // CIVICO
  { // ANEXO — garagem/edícula: laje ou meia-água de fibrocimento
    wall:[0xD8D5CE,0xCFD4D6,0xDEDAD2,0xE2D6C6],                   roof:0x6E6661, telha:0, laje:0x7B7974,
    roofs:[0x6E6661,0x787673,0x65615D,0x804530] }
];

/* `parede_grande`: o leque de parede das cinco tipologias GRANDES.

   O v11 abriu a paleta da CASA e do SOBRADO e parou ali. Prédio, comércio, torre,
   galpão e institucional continuaram com 4 ou 5 tons cada, todos entre 0xAF e 0xF0 --
   e a saída sRGB mais o ACES levantam justamente essa ponta da curva, então os cinco
   arquétipos chegavam na tela como a MESMA caixa branca. É o que se via de cima: casa
   variada embaixo, cidade grande unânime.

   Aqui não há cor inventada. Cada leque é a mesma leitura de foto de rua que a CASA já
   tinha, aplicada ao porte: claro ainda é a maioria (prédio brasileiro é claro mesmo),
   mas entra bege e areia (pastilha), cimento e cinza médio (concreto aparente), e uma
   ponta de terracota/ocre. Torre ganha o azul de pele de vidro e o granito escuro;
   galpão, a telha metálica; institucional, o creme de escola estadual.

   Os valores continuam ~20% abaixo da cor de catálogo, pelo motivo de sempre. E o leque
   é sorteado uniformemente (`s1`), então a PROPORÇÃO de cada família é literalmente
   quantas entradas ela tem na lista -- é assim que se dosa, não com peso. */
if (APAR.parede_grande) {
  PAL[ST.PREDIO].wall = [
    0xCBD0D3,0xD2CCC0,0xC2C8CB,0xD0C8B6,                              // claros
    0xC4AF8E,0xC8B392,0xBBA47E,0xAD9670,                              // bege / areia
    0xA3A8AA,0x9C978C,0x8B8880,0x7E8386,                              // cimento
    0xB4785A,0xA8825E,0xAC8A46,0x96694F];                             // terracota / ocre
  PAL[ST.COMERCIO].wall = [
    0xD0CCC2,0xC8CCCE,0xD4CCBA,
    0xC6B292,0xB4A07C,0xA6906C,
    0xA0A09A,0x8E8D88,0x7C7B76,
    0xB88264,0xA86A56,0xBC9450,0x92A099,0x7C8E98];
  PAL[ST.TORRE].wall = [
    0xAEBCC6,0xA3B4C2,0x8FA4B6,0x7B93A8,                              // pele de vidro
    0xC8CCCF,0xBEC2C4,                                                // claros
    0x6E7176,0x5C6065,0x4E5257,                                       // granito escuro
    0xB0A183,0x9C8C6E,0x86765C];                                      // pastilha bege
  PAL[ST.GALPAO].wall = [
    0xBAC0C4,0xC4C7C2,0xACB3B8,                                       // telha metalica
    0x999FA2,0x868C8F,0x74797C,
    0xB4A88E,0xA0947C,
    0x88A0B0,0x789080];
  PAL[ST.CIVICO].wall = [
    0xD4D0C4,0xC8CED0,0xD8D0BE,
    0xD4C084,0xC0A860,                                                // creme de escola
    0xC0AE90,0xAC9C80,
    0xA09D95,0x8A8880,
    0xA67E60];
}

/* Platibanda por arquétipo. É o detalhe mais barato e mais brasileiro que
   existe: a parede sobe além da laje e esconde a cobertura. Sem ela, prédio de
   laje vira caixa cortada a faca — que é o visual de hoje. */
const PLATIBANDA = [0.45, 0.55, 1.15, 0.95, 1.45, 0.35, 1.20, 0.30];
// Caixa de agua: azul de polietileno (o comum na rua), concreto, azul escuro, fibra.
const CAIXA_COR = [0x4A7FB5, 0x8F9295, 0x2B5F8A, 0xD4D4D4];

/* --- arquétipo de COBERTURA ---------------------------------------------
   v7. Até aqui só existiam duas coberturas: "duas/quatro águas sobre o eixo
   maior" e "laje". Numa rua inteira de casa térrea isso dá o mesmo teto em
   todo lote, e é o teto que se vê num mapa olhado de cima.

   As formas abaixo são as que aparecem na rua em São Carlos:

     HIP    quatro águas, cumeeira curta                  telha cerâmica
     GABLE  duas águas com a cumeeira no eixo COMPRIDO    telha cerâmica
     CROSS  duas águas com a cumeeira ATRAVESSADA — a empena olha pra rua
     SHED   meia-água, um plano só                        cerâmica ou fibrocimento
     LAJE   laje escondida atrás de platibanda            casa "de laje"

   CROSS só entra em casa pouco alongada: numa casa 3x mais funda que larga a
   cumeeira atravessada exigiria uma água de 8 m de altura. `elong` decide.

   O sorteio é o mesmo `s2` determinístico do prédio — o mesmo lote tira sempre
   a mesma cobertura, em qualquer sessão. */
const RF = { HIP:0, GABLE:1, CROSS:2, SHED:3, LAJE:4 };

function coberturaDe(st, ob, s2) {
  if (st === ST.GALPAO) return RF.SHED;
  if (st === ST.ANEXO)  return (ob.rect > 0.70 && s2 > 0.55) ? RF.SHED : RF.LAJE;
  if (st !== ST.CASA && st !== ST.SOBRADO) return RF.LAJE;
  // faixas cumulativas: 30% quatro águas, 26% duas águas, 16% empena pra rua,
  // 14% meia-água, 14% laje com platibanda.
  if (s2 < 0.30) return RF.HIP;
  if (s2 < 0.56) return RF.GABLE;
  if (s2 < 0.72) return ob.elong < 1.75 ? RF.CROSS : RF.GABLE;
  if (s2 < 0.86) return RF.SHED;
  return RF.LAJE;
}

function roofFootprint(ob,overhang) {
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[
    ob.cx+ob.ux*u*(ob.hu+overhang)-ob.uz*v*(ob.hv+overhang),
    ob.cz+ob.uz*u*(ob.hu+overhang)+ob.ux*v*(ob.hv+overhang)]);
}
function buildBuildings(recs, cx, cz) {
  const roadSafety = getRoadSafety();
  const P=[],N=[],C=[],F=[],D=[],DY=[],CXY=[],S=[], LP=[],LD=[],LDY=[],LCXY=[];
  // Retangulo minimo de cada predio, pra sombra de contato (ver refazSombras).
  // 8 floats: centro, eixo u, meias-larguras, o relevo da base e a altura.
  const SOM = [];
  const c = new THREE.Color(), rc = new THREE.Color();
  let count = 0;

  for (const b of recs) {
    const r = b.r, h = b.h, cls = CLS[b.c];
    let mx=0, mz=0; for (const p of r) { mx+=p[0]; mz+=p[1]; }
    mx/=r.length; mz/=r.length;
    // Prédio real fica nivelado sobre o terreno (a fundação absorve a inclinação):
    // um valor de relevo por edificação, medido no centro. Ver comentário do v5.
    let by = terrainY(mx, mz);
    for (let bi = 0; bi < r.length; bi++) {
      const bt = terrainY(r[bi][0], r[bi][1]);
      if (bt > by) by = bt;            // telhado nunca abaixo do chao mais alto da pegada
    }
    const dist = Math.min(1, Math.hypot(mx-cx, mz-cz) / (TILE_M*0.75));

    /* --- ORIENTAÇÃO DO ANEL — o bug que apagou o telhado do v7 -----------
       `insetRing` calcula a normal externa assumindo shoelace < 0, que é a
       convenção da base do Overture. Os volumes que o `build_v7_city.py`
       gera saem com o sinal CONTRÁRIO (o frame (t,n) do lote inverte a
       orientação ao passar por `utm_to_map`, que espelha o eixo Y): medido
       nesta base, 57.607 anéis com shoelace > 0 contra 1.389 com < 0.

       Com o sinal trocado o "inset" vira OUTSET. Duas consequências, as duas
       visíveis: a casa era desenhada 1 m maior POR LADO (uma casa de
       11,7 x 7,4 m virava 13,7 x 9,4 m, +50% de área), e o `rect` — que é
       area/área do OBB — caía de 0,99 pra 0,66, abaixo do 0,76 que libera
       telhado inclinado. Resultado medido na página: 9.520 casas de laje
       contra 65 com telhado. Por isso o bairro inteiro saía como uma laje
       escura só, que é o que o usuário apontou.

       Normalizar aqui conserta os dois de uma vez, e conserta também a normal
       das paredes, que segue a mesma convenção. */
    const gerado = shoelace(r) > 0;
    const rOK = gerado ? r.slice().reverse() : r;
    // O contorno gerado JÁ É A CASA: recuo frontal, afastamento lateral e
    // quintal foram calculados no build_v7_city sobre o lote da planta. O
    // 1 m de BUILDING_INSET existe pro contorno do Overture, que vem colado
    // no lote — aplicá-lo de novo comeria 2 m de cada dimensão da casa.
    const rw = safeInset(rOK, gerado ? 0.25 : BUILDING_INSET);
    const ob = obbOf(rw, Math.abs(shoelace(rw)) / 2);
    const st = tipoDe(b.c, h, b.area, ob);
    const pal = PAL[st];

    // Semente estável: centroide em decímetros. Não depende da ordem de leitura
    // nem do quarteirão em que o prédio caiu — o mesmo prédio sorteia o mesmo
    // número em toda sessão, e continua sorteando depois de atualizar a base.
    const seed = ((Math.round(mx*10) * 73856093) ^ (Math.round(mz*10) * 19349663)) >>> 0;
    const s1 = hash(seed), s2 = hash(seed ^ 0x9E37), s3 = hash(seed ^ 0x85EB);
    const sd = Math.min(255, Math.floor(s1 * 256));

    const s4 = hash(seed ^ 0xC2B2), s5 = hash(seed ^ 0x27D4);
    // s6/s7 sao sementes NOVAS de proposito: s2 e s3 ja escolhem cor de parede, forma
    // de agua e indice do leque de telha. Reusa-los pra matiz amarraria o desvio de
    // matiz ao indice da telha -- cada cor do leque sairia sempre com o mesmo desvio,
    // que e o oposto de variedade.
    const s6 = hash(seed ^ 0x165667B1), s7 = hash(seed ^ 0x9E3779B9);

    c.setHex(pal.wall[Math.floor(s1 * pal.wall.length) % pal.wall.length]);
    // A rua de casa aguenta (e pede) mais variacao que um corredor de torre: pintura
    // de casa e escolha de morador, fachada de predio e projeto. O desvio de matiz e
    // pequeno de proposito -- o suficiente pra separar dois beges vizinhos, longe de
    // inventar cor que nao esta na paleta da tipologia.
    const varSat = st <= ST.SOBRADO ? 0.10 : 0.05;
    const varLum = st <= ST.SOBRADO ? 0.10 : 0.075;
    c.offsetHSL((s6 - 0.5) * 0.03, (s2 - 0.5) * varSat, (s3 - 0.5) * varLum);
    // Cor DECLARADA vence o sorteio, e vence DEPOIS do desvio de matiz: o desvio existe
    // pra separar dois beges sorteados iguais, e nao ha o que separar quando alguem
    // mediu a cor na perspectiva do anuncio (ver `parede` em recDoLancamento). Hoje so
    // lancamento declara; a base do Overture nao tem esse dado.
    if (b.parede != null) c.setHex(b.parede);
    const rr = c.r, gg = c.g, bb = c.b;

    /* --- cobertura ------------------------------------------------------
       Quem é retangular o bastante ganha água inclinada; o resto cai pra laje
       com platibanda. Julgar isso pelo contorno evita telhado torto em cima de
       polígono que não comporta — e polígono que não comporta é comum.

       v7: a FORMA da água virou sorteio (ver `coberturaDe`), e não mais "duas
       ou quatro águas sobre o eixo maior" pra todo mundo. `rk` é o arquétipo;
       daqui pra baixo só se calcula quanto ele sobe, quanto avança de beiral e
       de que cor é a telha. */
    const podeAgua = ob.rect > 0.76 && ob.hv > 1.6;
    let rk = RF.LAJE;
    if (pal.telha === 1 && podeAgua) rk = coberturaDe(st, ob, s2);
    else if (pal.telha === 2 && ob.rect > 0.62) rk = RF.SHED;
    else if (st === ST.ANEXO && podeAgua) rk = coberturaDe(st, ob, s2);

    // A cumeeira do CROSS atravessa a casa: a água passa a vencer o vão do
    // eixo COMPRIDO, então a meia-largura que define a altura troca junto.
    const across = rk === RF.CROSS ? ob.hu : ob.hv;
    let pitched = rk !== RF.LAJE;
    let rise = 0, ph = 0, ov = 0;
    if (pitched) {
      if (pal.telha === 2) { rise = Math.min(2.4, across * 0.17); ov = 0.35; }
      else if (rk === RF.SHED) {
        // meia-água vence o vão inteiro numa tacada só: inclinação bem menor,
        // senão a casa vira rampa. É a cobertura da garagem e da casa simples.
        rise = Math.min(2.6, across * (0.30 + s4 * 0.16)); ov = 0.45 + s5 * 0.45;
      } else {
        rise = Math.min(4.2, across * (0.72 + s4 * 0.26));
        ov = 0.45 + s5 * 0.60;            // beiral de 45 cm a 1,05 m
      }
    } else {
      // Platibanda: a de casa varia, senão a rua de casa "de laje" fica com
      // todo mundo na mesma altura de parapeito.
      ph = PLATIBANDA[st] * (st <= ST.SOBRADO ? (0.7 + s4 * 1.4) : 1);
    }

    // A valid wall footprint is not enough: procedural eaves can extend 1.05 m.
    // First remove the overhang; if the rectangular roof still crosses a street,
    // use the flat roof on the original wall ring instead of moving the building.
    if (pitched && roadSafety && !explicitBuilding(b) && roadSafety.hit(roofFootprint(ob,ov))) {
      ov=0;
      if (roadSafety.hit(roofFootprint(ob,0))) {
        rk=RF.LAJE; pitched=false; rise=0; ph=PLATIBANDA[st];
      }
    }
    // Cor da telha: leque, não cor única (ver PAL em tipologia.js). Laje não é
    // telha — puxa a cor de concreto, senão o teto plano fica quase preto.
    const leque = pal.roofs;
    rc.setHex(pitched && leque ? leque[Math.floor(s3 * leque.length) % leque.length]
                               : (pitched ? pal.roof : (pal.laje || pal.roof)));
    // O leque ja da a cor; isto e o desvio DENTRO da cor. Dobrado (0,06 -> 0,12) porque
    // duas casas de telha da mesma entrada do leque saiam praticamente identicas vistas
    // de cima, que e como o mapa e olhado. A matiz anda pouco (barro varia de queima,
    // nao de pigmento) e usa s7, nao s3 -- s3 e quem escolhe a entrada do leque.
    rc.offsetHSL((s7 - 0.5) * 0.02, 0, (s2 - 0.5) * 0.12);
    const hw = h + ph;                       // topo da parede
    const hUse = Math.max(0, Math.min(2600, Math.round(h * 10)));  // até onde vai janela

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
    const roofFlat = rc.clone().lerp(c, pitched ? 0.10 : 0.22);
    // A tampa sai VIRADA PRA BAIXO: earcut preserva a orientação do anel, e o
    // anel é o mesmo que desenha as paredes. Com o material em DoubleSide o
    // three inverte a normal da face de trás (`faceDirection` em
    // normal_fragment_begin), então a laje ficava com a normal apontando pro
    // chão e recebia SÓ luz ambiente — vista de cima aparecia quase preta.
    // Medido trocando a cor da laje por magenta puro: 466 mil pixels saíam
    // (77,0,99) em vez de (255,0,255). Inverter a ordem dos três índices custa
    // zero e conserta todo prédio de laje da cidade, não só a casa.
    for (const f of triRoof) for (const k of [f[2], f[1], f[0]])
      vtx(rw[k][0], h, rw[k][1], 0,1,0, roofFlat.r, roofFlat.g, roofFlat.b, 0,-1, by);

    /* --- águas do telhado, sobre o retângulo mínimo --------------------
       Um só desenho serve as quatro formas. O eixo (a) é sempre o da CUMEEIRA
       e o eixo (b) é o que a água vence; HIP/GABLE põem a cumeeira no lado
       comprido, CROSS troca os dois (é o que faz a empena olhar pra rua) e
       SHED usa um plano só. Trocar a moldura em vez de escrever quatro
       telhados mantém tudo em ~6 triângulos e dentro da malha do quarteirão —
       zero chamada de desenho a mais. */
    if (pitched) {
      const alongU = rk !== RF.CROSS;
      const ax = alongU ? ob.ux : -ob.uz, az = alongU ? ob.uz : ob.ux;
      const bx = -az, bz = ax;
      const A = (alongU ? ob.hu : ob.hv) + ov;      // meia-cumeeira
      const B = (alongU ? ob.hv : ob.hu) + ov;      // meio-vão da água
      const pt = (a, b2, y) => [ob.cx + ax*a + bx*b2, y, ob.cz + az*a + bz*b2];
      const ref = [ob.cx, h + rise*0.35, ob.cz];

      if (rk === RF.SHED) {
        // Meia-água: um plano só, caindo pro lado sorteado. Fecha com as duas
        // empenas triangulares das pontas e a testeira alta do lado de cima.
        const L = s3 > 0.5 ? 1 : -1;                // pra que lado a água cai
        const lo1=pt(-A,-B*L,h), lo2=pt(A,-B*L,h);
        const hi1=pt(-A,B*L,h+rise), hi2=pt(A,B*L,h+rise);
        const tp1=pt(-A,B*L,h), tp2=pt(A,B*L,h);
        tri(lo1,lo2,hi2,ref); tri(lo1,hi2,hi1,ref);   // a água
        tri(lo1,hi1,tp1,ref); tri(lo2,tp2,hi2,ref);   // empena de cada ponta
        tri(tp1,hi1,hi2,ref); tri(tp1,hi2,tp2,ref);   // testeira alta
      } else {
        // Quatro águas encurta a cumeeira; duas águas mantém ela até a ponta, e
        // aí os mesmos dois triângulos das pontas viram empena vertical.
        const RA = rk === RF.HIP ? Math.max(0, A - B * 0.92) : A;
        const c1=pt(-A,-B,h), c2=pt(A,-B,h), c3=pt(A,B,h), c4=pt(-A,B,h);
        const r1=pt(-RA,0,h+rise), r2=pt(RA,0,h+rise);
        tri(c1,c2,r2,ref); tri(c1,r2,r1,ref);      // água de um lado
        tri(c3,c4,r1,ref); tri(c3,r1,r2,ref);      // água do outro
        tri(c2,c3,r2,ref); tri(c4,c1,r1,ref);      // tacaniça (4 águas) ou empena (2 águas)
      }
    }

    /* --- paredes ------------------------------------------------------ */
    /* v11: varanda em prédio alto. Só na face MAIS LONGA -- que é a que olha a rua na
       esmagadora maioria dos lotes. Fatiar as quatro faces multiplicaria por quatro a
       malha de parede, que já é a maior da cena, pra devolver relevo em fachadas que
       quase nunca aparecem. E só PRÉDIO/TORRE: são 1,5% dos vértices de parede da
       cidade (medido), então o custo do fatiamento cabe num canto do orçamento. */
    let iVar = -1;
    if ((st === ST.PREDIO || st === ST.TORRE) && h > 8) {
      let melhor = 0;
      for (let i = 0, n = rw.length; i < n; i++) {
        const A2 = rw[i], B2 = rw[(i+1)%n];
        const Ls = Math.hypot(B2[0]-A2[0], B2[1]-A2[1]);
        if (Ls > melhor) { melhor = Ls; iVar = i; }
      }
      if (melhor < 6) iVar = -1;     // fachada curta não comporta varanda
    }
    let run = 0;
    for (let i = 0, n = rw.length; i < n; i++) {
      const a = rw[i], b2 = rw[(i+1)%n];
      const dx = b2[0]-a[0], dz = b2[1]-a[1], L = Math.hypot(dx,dz);
      if (L < 0.05) continue;
      const nx = -dz/L, nz = dx/L, u0 = run, u1 = run + L; run = u1;
      // Rampa do CORPO da parede (base -> topo), por vertice. Subiu de 0,76 pra 0,82:
      // a faixa escura de baixo passou a ser desenhada no shader, em metros, e nao
      // mais esticada ao longo do predio inteiro pela interpolacao. Virou FUNCAO
      // porque a parede com varanda tem vertice no meio, nao so em 0 e hw.
      const lo = 0.82;
      /* 3.4 do plano da Fase 3, na forma pedida: uma faixa de ~0,90 m na base da face
         frontal, escurecida por COR DE VERTICE, sem triangulo novo.

         O que isso de fato consegue, medido: a parede e um quad de quatro cantos e nada
         entre eles, entao so ha vertice pra escurecer quando a porta cai a menos de
         45 cm de uma das pontas do pano -- em pano largo o efeito nao existe, e onde
         existe sai como degrade ate o outro canto, nao como faixa. A porta que DE FATO
         aparece em toda fachada e a do shader (`porta` em facadeMaterial), que desenha
         por fragmento e por isso consegue a faixa; ela foi estendida logo abaixo pras
         tipologias que ainda nao tinham. As duas convivem. */
      const doorX = L * 0.4 + hash(seed ^ 0x5F35 ^ i) * L * 0.2;
      const porta = L > 2 ? u0 + doorX : -1e9;
      const fy = (y, u) => {
        let f = Math.min(1, lo + (1 - lo) * (y / hw));
        if (y === 0 && u !== undefined && Math.abs(u - porta) < 0.45) f *= 0.65;
        return f;
      };
      // Trecho reto da parede, de y0 a y1. A base (y = 0) segue o relevo no proprio
      // ponto; o resto usa o valor unico do predio, pra o telhado ficar nivelado.
      const paredeDe = (y0, y1) => {
        const q = [[a[0],a[1],u0,y0],[b2[0],b2[1],u1,y0],[b2[0],b2[1],u1,y1],
                   [a[0],a[1],u0,y0],[b2[0],b2[1],u1,y1],[a[0],a[1],u0,y1]];
        for (const pt of q) {
          const yy = pt[3], dyv = yy === 0 ? terrainY(pt[0],pt[1]) : by, f = fy(yy, pt[2]);
          vtx(pt[0],yy,pt[1], nx,0,nz, rr*f, gg*f, bb*f, pt[2], yy, dyv);
        }
      };
      if (i === iVar) {
        const REC = 0.20;      // profundidade da varanda
        const VAO = 1.05;      // altura do vao
        // Ritmo da fachada. ESTES DOIS NUMEROS SAO COPIA do GLSL de `facadeMaterial`
        // (peD e pv por tipologia): sem bater com ele, a varanda cortaria a fileira de
        // janela no meio. E divida do mesmo naipe da tabela de vias -- o certo seria
        // uma fonte so, e o shader nao le JS.
        const peD = st === ST.TORRE ? 4.7 : 3.7, pv = st === ST.TORRE ? 3.20 : 3.15;
        const ix = a[0] - nx*REC, iz = a[1] - nz*REC;
        const jx = b2[0] - nx*REC, jz = b2[1] - nz*REC;
        // Retorno horizontal (piso e teto da varanda). Marcado com aFace.y = -1, igual
        // ao telhado: e laje, nao fachada -- sem isso o shader desenharia uma fileira
        // de janela atravessada na soleira.
        const retorno = (yy, sgn) => {
          const q = [[a[0],a[1],u0],[b2[0],b2[1],u1],[jx,jz,u1],
                     [a[0],a[1],u0],[jx,jz,u1],[ix,iz,u0]];
          const f = Math.min(1, fy(yy) * (sgn > 0 ? 1.06 : 0.70));
          for (const pt of q) vtx(pt[0],yy,pt[1], 0,sgn,0, rr*f, gg*f, bb*f, pt[2], -1, by);
        };
        // Fundo recuado: continua sendo FACHADA (aFace.y real), entao a janela do
        // shader e desenhada la dentro -- que e onde ela fica numa varanda de verdade.
        const fundo = (y0, y1) => {
          const q = [[ix,iz,u0,y0],[jx,jz,u1,y0],[jx,jz,u1,y1],
                     [ix,iz,u0,y0],[jx,jz,u1,y1],[ix,iz,u0,y1]];
          for (const pt of q) {
            const f = Math.min(1, fy(pt[3]) * 0.88);
            vtx(pt[0],pt[3],pt[1], nx,0,nz, rr*f, gg*f, bb*f, pt[2], pt[3], by);
          }
        };
        let base = 0;
        for (let y = peD; y + VAO < h - 0.6; y += pv) {
          paredeDe(base, y);
          retorno(y, 1);          // piso da varanda: pega luz
          fundo(y, y + VAO);
          retorno(y + VAO, -1);   // teto da varanda: sombra, e o que da o relevo
          base = y + VAO;
        }
        paredeDe(base, hw);
      } else paredeDe(0, hw);
      LP.push(a[0],hw,a[1], b2[0],hw,b2[1]); LD.push(dist,dist); LDY.push(by,by); LCXY.push(mx,mz,mx,mz);
    }

    /* --- SACADA DE VERDADE (lancamento) ---------------------------------
       A `varanda` do v11 acima e um RECUO de 20 cm na face mais longa: ela devolve uma
       sombra fina e nada mais. Numa torre de lancamento isso e pouco -- o que se ve na
       perspectiva publicada e uma pilha de lajes que AVANCAM da fachada, com
       guarda-corpo cheio, e sao elas que dao a listra horizontal e o relevo do predio.

       Por que a geometria nasce aqui e nao vem de um .blend: laje e guarda-corpo entram
       na MESMA malha do quarteirao, com os mesmos atributos -- entao herdam de graca o
       furo do interior (`uFuro` corta por posicao de mundo), a sombra, o clique, a
       tonalizacao por distancia e o descarte do streaming, e custam ZERO chamada de
       desenho. Uma malha importada precisaria de material proprio e perderia os cinco.

       So lancamento declara (`sacadas` no bloco): a base do Overture nao sabe onde ha
       sacada em 96 mil edificacoes, e inventar em todas trocaria uma monotonia por
       outra. ~48 triangulos por sacada. */
    if (b.sacadas || b.faixa_pav) {
      // Comprimento das faces, pra saber quais sao as LONGAS sem depender do indice do
      // anel (que muda de sinal com o enrolamento).
      const comp = [];
      for (let i = 0, n = rw.length; i < n; i++) {
        const A2 = rw[i], B2 = rw[(i+1)%n];
        comp.push(Math.hypot(B2[0]-A2[0], B2[1]-A2[1]));
      }
      const maior = Math.max.apply(null, comp);
      const triSac = (p1, p2, p3, ref, f) => {
        const ux=p2[0]-p1[0], uy=p2[1]-p1[1], uz2=p2[2]-p1[2];
        const vx=p3[0]-p1[0], vy=p3[1]-p1[1], vz=p3[2]-p1[2];
        let nx2=uy*vz-uz2*vy, ny2=uz2*vx-ux*vz, nz2=ux*vy-uy*vx;
        const Ln = Math.hypot(nx2,ny2,nz2) || 1; nx2/=Ln; ny2/=Ln; nz2/=Ln;
        const gx=(p1[0]+p2[0]+p3[0])/3-ref[0], gy=(p1[1]+p2[1]+p3[1])/3-ref[1],
              gz=(p1[2]+p2[2]+p3[2])/3-ref[2];
        if (nx2*gx+ny2*gy+nz2*gz < 0) { nx2=-nx2; ny2=-ny2; nz2=-nz2; }
        // aFace.y = -1: isto e LAJE, nao pano de fachada. Sem isso o shader desenharia
        // uma fileira de janela atravessada no guarda-corpo.
        for (const p of [p1,p2,p3])
          vtx(p[0],p[1],p[2], nx2,ny2,nz2, rr*f, gg*f, bb*f, 0, -1, by);
      };
      // Caixa orientada no frame da face: eixo U ao longo da parede, V pra fora.
      const caixa = (cx2, cy, cz2, ex, ez, hu2, hv2, hy, f) => {
        const fx = -ez, fz = ex, V = [];
        for (const sy of [-1,1]) for (const sv of [-1,1]) for (const su of [-1,1])
          V.push([cx2 + ex*hu2*su + fx*hv2*sv, cy + hy*sy, cz2 + ez*hu2*su + fz*hv2*sv]);
        const ref = [cx2, cy, cz2];
        for (const q of [[0,1,3,2],[4,5,7,6],[0,1,5,4],[2,3,7,6],[0,2,6,4],[1,3,7,5]]) {
          triSac(V[q[0]], V[q[1]], V[q[2]], ref, f);
          triSac(V[q[0]], V[q[2]], V[q[3]], ref, f);
        }
      };
    /* --- FAIXA DE PAVIMENTO ---------------------------------------------
       O elemento que mais aparece na perspectiva publicada do Wish, e o que faltava:
       a testeira da laje AVANCA e da a volta no predio inteiro -- inclusive na empena
       cega, onde nao ha janela nenhuma e ela e a unica coisa que se ve. E ela que faz
       a torre ter 21 linhas horizontais em vez de ser um pano liso com janela pintada.

       Medida na imagem 03 do anuncio: a faixa ocupa ~1/5 da altura do pavimento
       (0,55 m de 3,15) e avanca pouco -- o suficiente pra lancar sombra na parede logo
       abaixo. Nas quatro faces, sempre: e testeira de laje, e laje nao escolhe fachada. */
    if (b.faixa_pav) {
      const FA = b.faixa_pav.altura_m || 0.55, FV = b.faixa_pav.avanco_m || 0.22;
      for (let i = 0, n = rw.length; i < n; i++) {
        const L = comp[i];
        if (L < 1) continue;
        const a = rw[i], b2 = rw[(i+1)%n];
        const ex = (b2[0]-a[0])/L, ez = (b2[1]-a[1])/L;
        const nx2 = -ez, nz2 = ex;
        const mxF = (a[0]+b2[0])/2 + nx2*(FV/2), mzF = (a[1]+b2[1])/2 + nz2*(FV/2);
        for (let pav = 1; pav*LV < h - 0.3; pav++) {
          const y = pav * LV;
          const f = Math.min(1, (0.82 + 0.18*(y/hw)) * 1.10);   // testeira pega luz
          caixa(mxF, y - FA/2, mzF, ex, ez, L/2, FV/2, FA/2, f);
        }
      }
    }

    if (b.sacadas) {
      const sc = b.sacadas;
      const LARG = sc.largura_m || 3.4, AV = sc.avanco_m || 1.4;
      const PEIT = sc.peitoril_m || 1.05, ESP = 0.10;   // guarda-corpo cheio, 10 cm
      const LAJE = 0.16;                                // espessura da laje da sacada
      const dePav = sc.de_pav != null ? sc.de_pav : 1;
      const nPor = sc.por_face || 3;
      const alvo = sc.faces || "longas";
      for (let i = 0, n = rw.length; i < n; i++) {
        const L = comp[i];
        if (L < LARG + 1) continue;
        if (alvo === "longa" && L < maior - 0.01) continue;
        if (alvo === "longas" && L < maior * 0.8) continue;
        const a = rw[i], b2 = rw[(i+1)%n];
        const ex = (b2[0]-a[0])/L, ez = (b2[1]-a[1])/L;    // ao longo da parede
        const nx2 = -ez, nz2 = ex;                          // pra FORA (mesma convencao
                                                            // da parede, ver `paredeDe`)
        // As sacadas ficam centradas na face, com o mesmo vao entre elas e nas pontas:
        // encostar uma sacada na quina do predio nao acontece em projeto nenhum.
        const cabe = Math.max(1, Math.min(nPor, Math.floor((L - 1.2) / (LARG + 0.8))));
        const passo = L / cabe;
        for (let pav = dePav; pav * LV + PEIT < h - 0.4; pav++) {
          const y = pav * LV;
          // Escurece com a altura pelo mesmo motivo da parede: sem isso a pilha de
          // sacada sai chapada e desmente a rampa do pano ao lado dela.
          const f = Math.min(1, 0.82 + 0.18 * (y / hw));
          for (let k = 0; k < cabe; k++) {
            const s = passo * (k + 0.5);
            const px2 = a[0] + ex*s, pz2 = a[1] + ez*s;
            const cxL = px2 + nx2*(AV/2), czL = pz2 + nz2*(AV/2);
            // A laje leva f MAIOR, nao menor: ela e o piso da sacada e vive na sombra
            // da sacada de cima -- vista de cima, com a cor rebaixada junto, cada sacada
            // virava um buraco preto na fachada.
            caixa(cxL, y - LAJE/2, czL, ex, ez, LARG/2, AV/2, LAJE/2, Math.min(1, f*1.18));
            caixa(px2 + nx2*(AV - ESP/2), y + PEIT/2, pz2 + nz2*(AV - ESP/2),
                  ex, ez, LARG/2, ESP/2, PEIT/2, f);                             // frente
            for (const sgn of [-1, 1])                                           // laterais
              caixa(px2 + ex*sgn*(LARG/2 - ESP/2) + nx2*(AV/2),
                    y + PEIT/2,
                    pz2 + ez*sgn*(LARG/2 - ESP/2) + nz2*(AV/2),
                    ex, ez, ESP/2, AV/2, PEIT/2, f*0.97);
          }
        }
      }
    }
    }

    /* --- caixa d'água da casa ----------------------------------------
       O detalhe de telhado mais reconhecível do Brasil, e o mapa é olhado de
       cima: uma caixa de 1 m no teto distingue duas casas de mesma planta sem
       tocar em nada da silhueta da rua. Custa 10 triângulos e entra na malha
       que já existe. Só em ~35% das casas — em todas viraria outra monotonia,
       e cada caixa também é VRAM, que é o limite real aqui. */
    if ((st === ST.CASA || st === ST.SOBRADO) && s5 > 0.65 && b.area > 55) {
      const rcHex = rc.getHex();
      // Uma cor so fazia o telhado brasileiro inteiro ter a MESMA caixa. O azul de
      // polietileno e o mais comum na rua; concreto e a caixa velha, e a branca e a
      // de fibra. Sorteado por s4, que aqui so mexia na largura -- semente nova nao
      // pagaria a si mesma pra escolher entre quatro valores.
      rc.setHex(CAIXA_COR[Math.floor(s4 * CAIXA_COR.length) % CAIXA_COR.length]);
      const w = 0.55 + s4*0.20, hh = 0.95 + s3*0.55;
      const off = (s1 - 0.5) * ob.hu * 1.1;
      const bx = ob.cx + ob.ux*off, bz = ob.cz + ob.uz*off;
      const y0 = h + (pitched ? rise*0.45 : 0), y1 = y0 + hh + (pitched ? 0 : ph);
      const vx = -ob.uz, vz = ob.ux;
      const cn = [[-w,-w],[w,-w],[w,w],[-w,w]].map(p => [bx + ob.ux*p[0] + vx*p[1], bz + ob.uz*p[0] + vz*p[1]]);
      const ref = [bx, (y0+y1)/2, bz];
      for (let i = 0; i < 4; i++) {
        const A2 = cn[i], B2 = cn[(i+1)%4];
        tri([A2[0],y0,A2[1]], [B2[0],y0,B2[1]], [B2[0],y1,B2[1]], ref);
        tri([A2[0],y0,A2[1]], [B2[0],y1,B2[1]], [A2[0],y1,A2[1]], ref);
      }
      tri([cn[0][0],y1,cn[0][1]], [cn[1][0],y1,cn[1][1]], [cn[2][0],y1,cn[2][1]], ref);
      tri([cn[0][0],y1,cn[0][1]], [cn[2][0],y1,cn[2][1]], [cn[3][0],y1,cn[3][1]], ref);
      rc.setHex(rcHex);
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
    SOM.push(ob.cx, ob.cz, ob.ux, ob.uz, ob.hu, ob.hv, by, hw);
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
  return { g, lg, count, sombras: new Float32Array(SOM) };
}

    return {buildBuildings};
  }
  root.WorldBuildings = {create};
})(globalThis);
