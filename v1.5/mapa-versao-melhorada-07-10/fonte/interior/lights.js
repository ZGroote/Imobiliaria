/* Interior lighting: the city light giving way to the window, the lamp pool with switches, and their restore on exit. */
(function(root) {
  "use strict";
  function create({THREE, INT, scene, gInteriores, sun, hemi, renderer, camera, NIVEL, LUZ_PI, FILL, cursorDeLuz, CEU_LINHA, inside, ESP}) {
const MAX_LUZES = 6;
function acendeInterior(pl) {
  apagaInterior();
  // A luz da cidade NAO some, ela cede espaco. Sol e hemisferica foram calibrados pra
  // iluminar telhado a ceu aberto; mantidos no valor cheio, somados a luminaria de teto
  // e ao ACES, o apartamento inteiro estourava em branco chapado -- foi o que apareceu
  // no primeiro teste. Aqui eles caem pro papel de luz que entra pela janela.
  INT.brilho = { sol: sun.intensity, hemi: hemi.intensity, exp: renderer.toneMappingExposure,
                 hcima: hemi.color.getHex(), hbaixo: hemi.groundColor.getHex(),
                 fog: scene.fog.color.getHex() };
  // O sol e quem faz SOMBRA; luminaria de teto so preenche. Na primeira mistura o
  // preenchimento era mais forte que ele e a sombra sumia: existia no mapa e nao
  // aparecia na tela. A proporcao aqui e ~60% sol / 40% preenchimento.
  // v15: COM ATLAS DO UNREAL, O PREENCHIMENTO SAI DE CENA.
  //
  // As luzes deste bloco existiam pra FINGIR o que o bake agora mede: a hemisferica
  // quente embaixo era a luz que ricocheteia do piso, e a luminaria de teto por comodo
  // era o preenchimento indireto. Mantidas junto com o lightmap, a mesma luz e contada
  // duas vezes -- medido: media 189,7 (o teto do portao e 175) e faixa dinamica 49,9
  // (o piso e 80). A cena ficava clara E chapada ao mesmo tempo, que e a assinatura de
  // luz somada em cima de luz.
  //
  // Com o atlas fica so o SOL, e fraco: ele nao ilumina, ele desenha o retangulo
  // nitido que entra pela janela. Todo o resto -- ambiente, ricochetada, canto escuro,
  // sombra suave -- ja esta no atlas, e veio de um caminho de luz de verdade.
  const assado = !!cursorDeLuz(pl);
  sun.intensity = (assado ? 1.05 : 1.95) * LUZ_PI;
  renderer.toneMappingExposure = assado ? 0.58 : 0.72;
  /* A nevoa fecha na cor do ceu, senao o bairro visto pela janela morre num cinza que
     o ceu nao tem em lugar nenhum, com azul atras dele -- e a emenda cai bem na linha
     do horizonte. Mesmo conserto de conversao da cupula da cidade (ver mostraCeu).
     O fator e uma RAZAO DE EXPOSICAO, e o antigo 0,72 estava invertido. A cupula tem
     `toneMapped:false`, entao o pixel de ceu e o mesmo aqui e na cidade; a nevoa passa
     pelo ACES. Pra sair na MESMA cor de tela com exposicao menor, o que entra tem que
     ser MAIOR na mesma proporcao -- ACES e a mesma funcao nos dois casos, e canal acima
     de 1 e justamente o que ela existe pra comprimir. */
  scene.fog.color.set(CEU_LINHA)
    .multiplyScalar(INT.brilho.exp / renderer.toneMappingExposure);
  /* A HEMISFERICA DA CIDADE E O QUE DEIXAVA A PAREDE SONSA. Ela vem calibrada pra
     telhado a ceu aberto: azul palido em cima, 0x1A222C (quase preto, e frio) embaixo.
     Dentro de casa a parede que nao pega sol fica com essa mistura e mais nada -- e
     duas fontes cinza-azuladas dao cinza sem croma nenhum. O olho le "sem cor", nao
     "na sombra", e a diferenca entre a parede iluminada e a do lado vira degrau de
     BRILHO quando na vida e degrau de MATIZ.

     Aqui ela troca de cor enquanto se esta dentro: continua fria em cima (o que entra
     pela janela e ceu) e vira quente embaixo, porque o que ilumina a parede por baixo
     e a luz que ja bateu no piso. A parede na sombra passa a ser bege, nao cinza. */
  // Azul palido em cima ANULAVA o bege da parede: numa superficie vertical a
  // hemisferica entra meio a meio, e uma metade fria contra uma quente da cinza. Aqui
  // o alto e quase neutro (e ceu filtrado por vidro, nao ceu) e o chao e francamente
  // quente, que e a luz que ja bateu no piso. As duas metades empurram pro mesmo lado.
  hemi.color.setHex(0xE9EDF4);
  hemi.groundColor.setHex(0xE2BC8E);
  // Nem tudo la dentro tem lightmap: batente, folha de porta, caixilho e vidro sao
  // malhas de esquadria, sem peca no atlas. Com hemisferica em zero elas ficavam
  // CINZA no meio de uma parede iluminada -- a moldura branca virava a coisa mais
  // escura do quadro. O resto de hemisferica existe pra elas.
  /* SO A JANELA ILUMINA. A hemisferica e a ambiente entram em TODA face, olhando ou
     nao pra fora -- e no valor antigo o fundo do corredor recebia quase a mesma luz
     que o peitoril. A casa saia acesa "por todos os cantos" sem haver de onde, que e
     exatamente o defeito reclamado olhando a tela. Aqui elas caem pro minimo que as
     pecas SEM lightmap precisam (batente, folha, caixilho e movel nao tem bake nem
     atlas; em zero eles viram silhueta preta no meio de parede iluminada). Quem
     ilumina o comodo passa a ser o sol pela abertura, o ceu que o bake mediu por essa
     mesma abertura e, quando alguem acende, a lampada -- ver `montaLuminarias`. */
  hemi.intensity = (assado ? 0.085 : 0.11) * LUZ_PI * FILL;
  const amb = new THREE.AmbientLight(0xFFEDD8, (assado ? 0.025 : 0.022) * LUZ_PI * FILL);
  gInteriores.add(amb); INT.luzes.push(amb);   // ver a nota em montaLuminarias
  // A luminaria de teto nao acende mais sozinha: virou LAMPADA, tem interruptor na
  // parede, comeca apagada e a luz dela para na parede. Ver secao 12d.
  montaLuminarias(pl);
  // A camera de sombra do sol e dimensionada pra CIDADE (1.280 m de lado, 2048 px =
  // 60 cm por texel). Isso nao enxerga um pe de cadeira. Aqui ela e reapontada pro
  // apartamento: ~25 m de lado dao 8 cm por texel, e a sombra de contato aparece.
  const sc2 = sun.shadow.camera;
  INT.sombra = { l:sc2.left, r:sc2.right, t:sc2.top, b:sc2.bottom,
                 n:sc2.near, f:sc2.far, bias:sun.shadow.bias, nb:sun.shadow.normalBias };
  const R = Math.max(pl.ob.hu, pl.ob.hv) + 4;
  sc2.left = -R; sc2.right = R; sc2.top = R; sc2.bottom = -R;
  // O near/far tambem: a camera de sombra da cidade cobre 3 km de profundidade, e a
  // 24 bits isso da ~0,2 mm de passo -- que parece muito ate lembrar que a sombra de
  // uma cadeira mede 2 cm de deslocamento. Com o plano longe assim, o `bias` que evita
  // acne come a sombra inteira. O sol fica sempre a 1.250 m do alvo (o deslocamento e
  // constante em frame()), entao aqui a faixa encolhe pra 80 m em volta dele.
  const D = Math.hypot(520, 940, 640);
  sc2.near = D - 40; sc2.far = D + 40;
  sc2.updateProjectionMatrix();
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.02;
}
function apagaInterior() {
  for (const l of INT.luzes) gInteriores.remove(l);
  INT.luzes.length = 0;
  // As malhas morrem junto com INT.raiz (`descarta`); aqui so caem as referencias e o
  // pool, que vive na cena e nao na raiz.
  INT.lamps = []; INT.pool = []; INT.chaveLuz = "";
  INT.plafons = INT.chaves = null;
  if (INT.brilho) {
    sun.intensity = INT.brilho.sol;
    hemi.intensity = INT.brilho.hemi;
    hemi.color.setHex(INT.brilho.hcima);
    hemi.groundColor.setHex(INT.brilho.hbaixo);
    scene.fog.color.setHex(INT.brilho.fog);
    renderer.toneMappingExposure = INT.brilho.exp;
    INT.brilho = null;
  }
  if (INT.sombra) {
    const sc2 = sun.shadow.camera, a = INT.sombra;
    sc2.left = a.l; sc2.right = a.r; sc2.top = a.t; sc2.bottom = a.b;
    sc2.near = a.n; sc2.far = a.f;
    sc2.updateProjectionMatrix();
    sun.shadow.bias = a.bias; sun.shadow.normalBias = a.nb;
    INT.sombra = null;
  }
}

/* ============================================================
   12d. Lampada, interruptor e o que a luz nao atravessa  (v16)
   ============================================================
   Ate aqui "luz de dentro" eram tres pontuais que nasciam acesas nos tres maiores
   comodos, sem nada na cena que dissesse de onde vinham, e que atravessavam parede:
   luz pontual sem sombra ilumina os dois lados da divisoria igual. Somado ao
   preenchimento uniforme (hemisferica + ambiente), o apartamento saia aceso por
   inteiro num dia em que ninguem acendeu nada.

   Agora a instalacao e a de uma casa: cada comodo tem um plafom no teto e uma placa
   de interruptor na parede, ao lado do batente da porta. Clicar em qualquer um dos
   dois acende ou apaga aquele comodo, e a luz acesa PARA na parede.

   Tres decisoes de custo, que sao o motivo de isto caber:

   - POOL DE QUATRO LUZES, NAO UMA POR COMODO. Uma planta destas tem de 6 a 11
     comodos. Luz pontual com sombra e um cubemap -- SEIS renderizacoes da cena por
     luz -- e, pior, cada luz na cena entra no shader de TODO material, acesa ou
     apagada: a contagem de luzes e o que decide a compilacao. Entao existem quatro
     luzes de verdade, criadas na entrada e nunca removidas (mexer na contagem
     recompilaria a cidade inteira no meio da visita), e elas sao emprestadas as
     lampadas acesas mais proximas de quem olha. Acender a quinta acende o plafom e
     move a luz de quem ficou longe: o comodo que voce nao esta vendo e o que fica
     sem luz calculada.

   - CUBEMAP SO QUANDO MUDA. Dentro de casa o mapa de sombra do sol e redesenhado
     todo quadro (a nota do `sombraSuja` explica por que). Quatro cubemaps nesse
     ritmo seriam 24 passadas por quadro. `shadow.autoUpdate = false` por luz: a
     sombra da lampada e refeita quando alguem aciona um interruptor, quando a luz
     troca de comodo e quando um movel muda de lugar -- nunca por andar pela sala,
     porque a lampada nao anda com voce.

   - DUAS CHAMADAS DE DESENHO PRA INSTALACAO INTEIRA. Plafom e placa sao
     `InstancedMesh` com cor por instancia, pela mesma conta do resto do projeto:
     triangulo e barato, chamada e cara. Onze plafons custam o mesmo que um.

   O plafom aceso e `MeshBasic` sem mapeamento de tom: o vidro de uma luminaria acesa
   e a fonte, nao uma superficie iluminada -- passado pelo ACES ele sairia cinza, que
   e o que acontece com todo autoluminoso deste projeto (ver a cupula do ceu). */
const LAMP = {
  pool:    4,      // luzes com sombra vivas ao mesmo tempo
  int:     2.4,    // intensidade de uma lampada acesa (antes do fator PI)
  alcance: 9.0,    // distancia em que a luz zera (m)
  altura:  1.05,   // altura do interruptor (m) -- a de norma, e a que a mao acha
  cor:     0xFFEFD6
};
const LAMP_ACESA = 0xFFF7E2, LAMP_APAGADA = 0x6F6B64;
const CHAVE_ON = 0xFFFFFF, CHAVE_OFF = 0xE6E2DA;

function montaLuminarias(pl) {
  const n = pl.comodos.length;
  if (!n) return;
  const mapa = NIVEL.somMap >= 2048 ? 512 : 256;
  for (let k = 0; k < Math.min(LAMP.pool, n); k++) {
    const l = new THREE.PointLight(LAMP.cor, 0, LAMP.alcance, 2);
    l.castShadow = true;
    l.shadow.mapSize.set(mapa, mapa);
    l.shadow.camera.near = 0.08;
    l.shadow.camera.far = LAMP.alcance;
    l.shadow.bias = -0.001;
    l.shadow.normalBias = 0.10;
    l.shadow.autoUpdate = false;
    l.position.set(pl.cx, INT.baseY + pl.pd - 0.28, pl.cz);
    // `gInteriores`, nao `scene`. O grupo inteiro troca de cena na etapa 3 (ver
    // `entraPlanta`), e luz pendurada direto na cena da cidade nao iria junto -- a
    // planta abriria sem lampada e a cidade ficaria com quatro pontuais orfas. O
    // grupo nao tem transformacao, entao a posicao continua sendo a do mundo.
    gInteriores.add(l); INT.luzes.push(l); INT.pool.push(l);
  }

  // Plafom: calota de 23 cm rente ao forro. A luz mora 18 cm abaixo dela, pra que a
  // propria calota nao seja o primeiro oclusor do cubemap.
  const gBul = new THREE.SphereGeometry(0.115, 12, 8);
  gBul.scale(1, 0.58, 1);
  const bul = new THREE.InstancedMesh(gBul, new THREE.MeshBasicMaterial({ toneMapped:false }), n);
  bul.userData.luz = "plafon";
  bul.castShadow = bul.receiveShadow = false;
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const c = pl.comodos[i];
    d.position.set(c.cx, pl.pd - 0.09, c.cz);
    d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
    d.updateMatrix(); bul.setMatrixAt(i, d.matrix);
    INT.lamps.push({ i, on:false, p:new THREE.Vector3(c.cx, INT.baseY + pl.pd - 0.28, c.cz) });
  }
  bul.instanceMatrix.needsUpdate = true; bul.computeBoundingSphere();
  INT.raiz.add(bul); INT.plafons = bul;

  // Interruptor: ao lado do batente da porta do comodo, do lado de dentro. O vao ja
  // traz a normal (`nx,nz`) e o versor ao longo dele (`ux,uz`) -- o que falta decidir
  // e o SINAL dos dois: de que lado da porta esta este comodo, e de que lado do vao
  // sobra parede pra placa. Os dois saem de um teste de pertinencia no poligono do
  // proprio comodo, que e o mesmo criterio que o resto do interior usa.
  const chaves = [];
  for (let i = 0; i < n; i++) {
    const c = pl.comodos[i];
    let alvo = null, dm = 1e9;
    for (const e of pl.esquadrias) {
      if (!e.porta) continue;
      const mx = (e.a[0]+e.b[0])/2, mz = (e.a[1]+e.b[1])/2;
      const s = inside(c.poly, mx + e.nx*0.30, mz + e.nz*0.30) ?  1
              : inside(c.poly, mx - e.nx*0.30, mz - e.nz*0.30) ? -1 : 0;
      if (!s) continue;
      const dd = Math.hypot(mx - c.cx, mz - c.cz);
      if (dd < dm) { dm = dd; alvo = { e, s, mx, mz }; }
    }
    if (!alvo) continue;                       // comodo sem porta propria (varanda):
    const e = alvo.e;                          // fica so com o plafom, que e clicavel
    const nx = e.nx*alvo.s, nz = e.nz*alvo.s;
    for (const t of [1, -1]) {
      const off = e.L/2 + 0.17;
      const qx = alvo.mx + e.ux*off*t, qz = alvo.mz + e.uz*off*t;
      if (!inside(c.poly, qx + nx*0.35, qz + nz*0.35)) continue;
      chaves.push({ i, x: qx + nx*(ESP/2 + 0.008), z: qz + nz*(ESP/2 + 0.008),
                    ang: Math.atan2(nx, nz) });
      break;
    }
  }
  if (chaves.length) {
    const gCh = new THREE.BoxGeometry(0.086, 0.128, 0.014);
    const ch = new THREE.InstancedMesh(gCh, new THREE.MeshStandardMaterial({
      roughness:0.75, metalness:0, emissive:0x0E0D0B }), chaves.length);
    ch.userData.luz = "chave";
    ch.userData.mapa = chaves.map(q => q.i);
    ch.castShadow = ch.receiveShadow = false;
    for (let k = 0; k < chaves.length; k++) {
      const q = chaves[k];
      d.position.set(q.x, LAMP.altura, q.z);
      d.rotation.set(0, q.ang, 0); d.scale.set(1, 1, 1);
      d.updateMatrix(); ch.setMatrixAt(k, d.matrix);
    }
    ch.instanceMatrix.needsUpdate = true; ch.computeBoundingSphere();
    INT.raiz.add(ch); INT.chaves = ch;
  }
  pintaLuminarias();
  distribuiLuzes(true);
}

// Cor por instancia: e o unico jeito de um plafom aceso e um apagado dividirem a
// mesma malha -- e dividir a malha e o que faz a instalacao caber em duas chamadas.
function pintaLuminarias() {
  const cor = new THREE.Color();
  if (INT.plafons) {
    for (const L of INT.lamps)
      INT.plafons.setColorAt(L.i, cor.setHex(L.on ? LAMP_ACESA : LAMP_APAGADA));
    INT.plafons.instanceColor.needsUpdate = true;
  }
  if (INT.chaves) {
    const m = INT.chaves.userData.mapa;
    for (let k = 0; k < m.length; k++)
      INT.chaves.setColorAt(k, cor.setHex(INT.lamps[m[k]].on ? CHAVE_ON : CHAVE_OFF));
    INT.chaves.instanceColor.needsUpdate = true;
  }
}

/* Empresta as quatro luzes as lampadas acesas mais proximas da camera. Sai cedo
   quando a lista nao muda: e chamada de dentro do laco de quadro. */
function distribuiLuzes(forca) {
  if (!INT.pool.length) return;
  const acesas = INT.lamps.filter(L => L.on)
    .sort((a, b) => a.p.distanceToSquared(camera.position)
                  - b.p.distanceToSquared(camera.position))
    .slice(0, INT.pool.length);
  const chave = acesas.map(L => L.i).join(",");
  if (!forca && chave === INT.chaveLuz) return;
  INT.chaveLuz = chave;
  for (let k = 0; k < INT.pool.length; k++) {
    const L = acesas[k], pt = INT.pool[k];
    pt.intensity = L ? LAMP.int * LUZ_PI : 0;
    if (L) { pt.position.copy(L.p); pt.shadow.needsUpdate = true; }
  }
}
// Movel mudou de lugar: a sombra da lampada e que nao sabe (a do sol e refeita todo
// quadro). Chamada de `salvaMoveis`, que e por onde toda edicao de mobilia passa.
function sujaLuzes() {
  for (const pt of INT.pool) if (pt.intensity > 0) pt.shadow.needsUpdate = true;
}
function alternaLuz(i) {
  const L = INT.lamps[i];
  if (!L) return;
  L.on = !L.on;
  pintaLuminarias();
  distribuiLuzes(true);
}
// O raio bate na malha instanciada e volta com `instanceId`; nos plafons ele ja e o
// indice do comodo, nas placas passa pelo mapa (comodo sem porta nao tem placa).
function luzDoHit(h) {
  const k = h.object.userData.luz;
  if (!k) return -1;
  return k === "plafon" ? h.instanceId : h.object.userData.mapa[h.instanceId];
}

    return {acendeInterior, apagaInterior, LAMP, montaLuminarias, pintaLuminarias, distribuiLuzes, sujaLuzes, alternaLuz, luzDoHit};
  }
  root.InteriorLights = Object.freeze({create});
})(globalThis);
