// Cama assada na maquete: troca a cama do catalogo pela cama do Blender, SUBINDO DE NIVEL
// conforme chega. A pagina abre como sempre (nivel q0 = cama do catalogo). Quando o visitante
// entra na Planta 3D ou na Visita, baixa geometria + textura minima (q1, ~30 KB) e troca;
// depois sobe ate o teto -- direto, se a rede e rapida; nivel a nivel, se e lenta.
//   ?cama=q0  desliga   ?cama=q2  para no q2   ?cama_quando=ja  baixa sem esperar a visita
// Mesmo contrato do visual.js do piloto: o movel e filho da casa (`maq.planta()`) com
// userData.registroMovel; o original fica escondido, nunca apagado.
(function (root) {
  function start({ THREE: T, maq, url = "cama/", ate = "q3", ganho = [1, 1, 1], luz = 0, tam = null,
                  quando = "visita" }) {
    const ORDEM = ["q1", "q2", "q3", "q4"];
    const U = new URL(location.href).searchParams;
    const pedido = U.get("cama") || ate;
    // Calibracao contra a luz do interior (quase toda ceu azul): `ganho` por canal no albedo e
    // `luz` = um pouco de brilho proprio QUENTE no proprio albedo (a cama do catalogo traz a luz
    // quente assada nos vertices; esta nao). Na URL pra calibrar: ?cama_ganho=r,g,b&cama_luz=e
    if (U.get("cama_ganho")) ganho = U.get("cama_ganho").split(",").map(Number);
    if (U.get("cama_luz")) luz = +U.get("cama_luz");
    if (U.get("cama_quando")) quando = U.get("cama_quando");
    // BN (pacote versao 3): bump de DETALHE que repete (o matelasse da cena) por cima do relevo assado
    const BUMP = U.get("cama_bump") ? +U.get("cama_bump") : 1.0;
    const teto = ORDEM.indexOf(pedido);
    const t0 = performance.now();
    const st = { nivel: "q0", t: {}, t0: Math.round(t0), bytes: 0, erro: null, instalado: false, fmt: null, pulou: false };
    const marca = (k) => { st.t[k] = Math.round(performance.now() - t0); };
    root.__camaAssada = { snapshot: () => JSON.parse(JSON.stringify(st)) };
    if (teto < 0) return;

    let M = null, grupo = null, alvo = null, casa = null;
    const mats = [];
    // relevo plano 1x1: o material ja nasce COM normalMap, entao trocar de nivel so troca a
    // textura e nao recompila o shader (recompilar e o que trava quadro).
    const plano = new T.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    plano.needsUpdate = true;

    // AVIF quando o navegador abre (relevo 30-44% menor que WebP); senao WebP. O teste decodifica
    // um AVIF de 1 px embutido -- nao custa rede.
    const AVIF1 = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAHgAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAJm1kYXQSAAoIGAAGiAhoNCAyEBlHh4Yhh5555oAAAJBAzeg=";
    const formato = fetch(AVIF1).then((r) => r.blob()).then((b) => createImageBitmap(b))
      .then(() => "avif", () => "webp");
    async function baixa(nome, tipo) {
      const r = await fetch(url + nome, { priority: "high" });
      if (!r.ok) throw Error(nome + " " + r.status);
      const b = tipo === "json" ? await r.text() : await r.blob();
      st.bytes += tipo === "json" ? b.length : b.size;
      return tipo === "json" ? JSON.parse(b) : b;
    }
    async function textura(nome, cor) {
      const bmp = await createImageBitmap(await baixa(nome), { imageOrientation: "flipY" });
      const t = new T.Texture(bmp);
      t.flipY = false;
      t.colorSpace = cor ? T.SRGBColorSpace : T.NoColorSpace;
      t.anisotropy = Math.min(4, maq.ren.capabilities.getMaxAnisotropy());
      t.needsUpdate = true;
      return t;
    }
    function geometria(bin, o) {
      const g = new T.BufferGeometry(), q = new Uint16Array(bin, o.pos, o.nv * 3), p = new Float32Array(o.nv * 3);
      for (let i = 0; i < p.length; i++) { const k = i % 3; p[i] = o.min[k] + q[i] / 65535 * (o.max[k] - o.min[k]); }
      g.setAttribute("position", new T.BufferAttribute(p, 3));
      // normal Int8 em passo de 4 (o 4o byte e enchimento): le direto, sem converter
      g.setAttribute("normal", new T.InterleavedBufferAttribute(
        new T.InterleavedBuffer(new Int8Array(bin, o.nor, o.nv * 4), 4), 3, 0, true));
      g.setAttribute("uv", new T.BufferAttribute(new Uint16Array(bin, o.uv, o.nv * 2), 2, true));
      if (o.det !== undefined) {           // UV de detalhe (em repeticoes do padrao): canal 1
        const q = new Uint16Array(bin, o.det, o.nv * 2), d = new Float32Array(o.nv * 2);
        for (let i = 0; i < d.length; i++) { const k = i % 2; d[i] = o.dmin[k] + q[i] / 65535 * (o.dmax[k] - o.dmin[k]); }
        g.setAttribute("uv1", new T.BufferAttribute(d, 2));
      }
      g.setIndex(new T.BufferAttribute(new Uint16Array(bin, o.idx, o.ni), 1));
      g.computeBoundingSphere();
      return g;
    }
    function acha() {
      const h = maq.planta && maq.planta();
      if (!h) return null;
      if (!st.t.casa) marca("casa");
      casa = h;
      return h.children.find((o) => o.userData && o.userData.movel && o.userData.registroMovel
        && o.userData.registroMovel.tipo === "cama") || null;
    }
    // A cama assada mede LARGURA x COMPRIMENTO do bake; o registro do cadastro tem a sua (w, d).
    // Largura ajusta ao registro (2% no Cedros); comprimento fica o natural e a cabeceira encosta
    // na parede, no fundo da caixa do registro (frente = +Z do catalogo).
    function instala(obj) {
      const it = obj.userData.registroMovel, s = obj.scale;
      if (grupo.parent) grupo.parent.remove(grupo);
      const sx = it.w / M.largura;
      grupo.scale.set(sx / s.x, 1 / s.y, 1 / s.z);
      grupo.position.set(0, 0, -(it.d - M.comprimento) / 2 / s.z);
      obj.add(grupo);
      alvo = obj;
      st.instalado = true;
      marca("instalado");
    }
    function esconde() {
      if (!alvo) return;
      for (const c of alvo.children) if (c !== grupo) c.visible = false;
    }
    // os quatro arquivos de um nivel saem JUNTOS: em fila eram 4 latencias (1,2 s no 3G)
    async function pedeNivel(q) {
      const [tc, tt] = (tam || (M && M.tam) || { q1: [256, 128], q2: [512, 256], q3: [1024, 512], q4: [2048, 1024] })[q];
      const f = st.fmt = await formato, rel = q !== "q1";
      return Promise.all([textura(`corpo-cor-${tc}.${f}`, true), textura(`trav-cor-${tt}.${f}`, true),
        rel ? textura(`corpo-relevo-${tc}.${f}`, false) : plano, rel ? textura(`trav-relevo-${tt}.${f}`, false) : plano]);
    }
    // Detalhe: o matelasse (celula do box, da lateral, bordado do tampo) e periodico -- vem como bump
    // pequeno que REPETE, no canal de UV 1, por cima do relevo assado (que agora e de 384-512 px). O three
    // faz normalMap OU bumpMap (e #elif): o patch aplica o bump DEPOIS do relevo e escurece o fundo da
    // costura na cor (o "escuro" da cena), normalizado pela media pra nao escurecer a cama inteira.
    // Nasce com um bump plano 1x1 no mesmo canal: chegar o detalhe nao recompila o shader.
    const bumpPlano = new T.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    bumpPlano.channel = 1; bumpPlano.needsUpdate = true;
    const detTex = {};
    let detPedido = false;
    function comDetalhe(m, det) {
      m.bumpMap = bumpPlano;
      m.bumpScale = BUMP;
      m.userData.uDet = { value: 0 };
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uDet = m.userData.uDet;
        sh.uniforms.uEscuro = { value: det.escuro };
        sh.uniforms.uMedia = { value: det.media };
        sh.fragmentShader = "uniform float uDet; uniform float uEscuro; uniform float uMedia;\n" + sh.fragmentShader
          .replace("#include <map_fragment>", `#include <map_fragment>
  diffuseColor.rgb *= mix(1.0, mix(uEscuro, 1.0, texture2D(bumpMap, vBumpMapUv).x) / uMedia, uDet);`)
          .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
  #ifdef USE_NORMALMAP_TANGENTSPACE
  normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(), faceDirection);
  #endif`);
      };
    }
    async function sobe(q, pedido) {
      const [corpo, trav, corpoN, travN] = await (pedido || pedeNivel(q));
      const tex = { corpo, trav, corpoN, travN };
      for (const { m, mapa } of mats) {
        const velho = [m.map, m.normalMap];
        m.map = tex[mapa];
        if (m.userData.brilho) m.emissiveMap = tex[mapa];
        m.normalMap = tex[mapa + "N"];
        for (const v of velho) if (v && v !== plano && v !== m.map && v !== m.normalMap) v.dispose();
      }
      if (q !== "q1" && !detPedido) {
        detPedido = true;
        const f = st.fmt;
        for (const { m, det } of mats) if (det) {
          if (!detTex[det.img]) detTex[det.img] = textura(`${det.img}.${f}`, false);
          detTex[det.img].then((t) => {
            t.wrapS = t.wrapT = T.RepeatWrapping; t.channel = 1;
            m.bumpMap = t; m.userData.uDet.value = 1;
            if (!st.t.detalhe) marca("detalhe");
          });
        }
      }
      st.nivel = q;
      marca(q);
    }
    async function roda() {
      // indice, geometria e textura do q1 em paralelo (os nomes sao fixos, nao precisam do indice)
      const [m, geo, q1] = [baixa("cama.json", "json"), baixa("geo.bin"), pedeNivel("q1")];
      M = await m;
      const corpo = M.objetos.filter((o) => o.mapa === "corpo");
      M.largura = Math.max(...corpo.map((o) => o.max[0])) - Math.min(...corpo.map((o) => o.min[0]));
      M.comprimento = Math.max(...corpo.map((o) => o.max[2])) - Math.min(...corpo.map((o) => o.min[2]));
      const bin = await (await geo).arrayBuffer();
      const g = new T.Group();
      g.name = "cama-assada";
      for (const o of M.objetos) {
        const m = new T.MeshStandardMaterial({ roughness: o.rough, metalness: 0, normalMap: o.mapa ? plano : null });
        if (o.cor) m.color.setRGB(o.cor[0], o.cor[1], o.cor[2], T.LinearSRGBColorSpace);
        m.color.multiply(new T.Color(ganho[0], ganho[1], ganho[2]));
        if (o.mapa && luz > 0) { m.emissive.setRGB(1.0, 0.93, 0.84).multiplyScalar(luz); m.userData.brilho = true; }
        if (o.detalhe) comDetalhe(m, o.detalhe);
        if (o.mapa) mats.push({ m, mapa: o.mapa, det: o.detalhe });
        const me = new T.Mesh(geometria(bin, o), m);
        me.castShadow = me.receiveShadow = true;
        g.add(me);
      }
      marca("geo");
      await sobe("q1", q1);
      grupo = g;          // so entra na cena com textura: a cama do catalogo fica ate aqui
      // Rede rapida pula os niveis do meio: baixar q2 pra jogar fora meio segundo depois e peso
      // a toa (78 KB). Rapida = o que o navegador diz (downlink) ou o que o q1 mediu de fato.
      const kbs = st.bytes / 1024 / Math.max(0.05, (st.t.q1 - st.t.pedido) / 1000);
      const dl = navigator.connection && navigator.connection.downlink;
      st.pulou = (dl && dl >= 5) || kbs >= 400;
      st.kbs = Math.round(kbs);
      // nivel que o pacote nao tem e pulado (BN: q1 -> q3 direto; o q2 de 58 KB nao pagava o meio segundo)
      const tem = (q) => !!(tam || M.tam || {})[q];
      for (let i = st.pulou ? teto : 1; i <= teto; i++) if (tem(ORDEM[i])) await sobe(ORDEM[i]);
    }
    // BAIXA logo depois do primeiro quadro (nunca disputa a abertura) e so INSTALA quando a casa
    // existe -- e ela so existe depois de entrar na visita. Esperar a casa pra baixar fazia a
    // cama comecar aos 5,5 s no 4G bom, com o visitante ja dentro do quarto.
    // So baixa quando o visitante ENTRA (Planta 3D ou Visita): quem so olha o predio nao paga
    // os bytes da cama. Com ~30 KB no q1 ela chega logo depois da entrada.
    let comecou = false;
    function observa() {
      const obj = acha();
      if (obj && obj !== alvo && grupo) instala(obj);
      esconde();
      const modo = maq.modo ? maq.modo() : "visita";
      if (!comecou && (quando === "ja" || modo === "visita" || modo === "planta3d")) {
        comecou = true;
        marca("pedido");
        roda().catch((e) => { st.erro = String(e); });
      }
      root.requestAnimationFrame(observa);
    }
    marca("inicio");
    root.requestAnimationFrame(observa);
    return root.__camaAssada;
  }
  root.CamaAssada = { start };
})(window);
