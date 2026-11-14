// Movel do Blender na maquete (exporta.py + prep.py, formato 2): troca o movel do catalogo do MESMO
// tipo pela peca assada, encaixada na caixa do registro (w x h x d). Irmao do cama-assada.js, com o
// mesmo contrato: filho da casa (`maq.planta()`) com userData.registroMovel; o original fica
// escondido, nunca apagado. So baixa quando o visitante ENTRA (Planta 3D ou Visita).
//   ?movelweb=0 desliga   ?movelweb_quando=ja baixa sem esperar a visita
//   (NAO "?moveis=": esse e do app -- o modo Moveis do v16 -- e ?moveis=0 tira TODO movel da casa)
// Estrategias (RELATORIO-MOVEIS.md): B = textura compartilhada (repete, uma por casa) + AO da peca;
// BN = B + relevo assado da malha alta (estofado). Metal reflete a SONDA do comodo (o envMap do
// movel que ele substitui), que roda na entrada e nao conhece quem chega depois.
(function (root) {
  function start({ THREE: T, maq, url = "moveis/", pecas = [], tam = 512, quando = "visita" }) {
    const U = new URL(location.href).searchParams;
    if (U.get("movelweb_quando")) quando = U.get("movelweb_quando");
    // ?movelweb_modo=B forca a estrategia de todas as pecas (A/B sem a pagina nova)
    if (U.get("movelweb_modo")) pecas = pecas.map((p) => ({ ...p, modo: U.get("movelweb_modo") }));
    const t0 = performance.now();
    const st = { t: {}, t0: Math.round(t0), bytes: 0, erro: null, pecas: {}, fmt: null };   // t: ms desde t0 (relogio da pagina)
    const marca = (k) => { st.t[k] = Math.round(performance.now() - t0); };
    root.__movelWeb = { snapshot: () => JSON.parse(JSON.stringify(st)) };
    if (U.get("movelweb") === "0" || !pecas.length) return root.__movelWeb;

    const AVIF1 = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAHgAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAJm1kYXQSAAoIGAAGiAhoNCAyEBlHh4Yhh5555oAAAJBAzeg=";
    const formato = fetch(AVIF1).then((r) => r.blob()).then((b) => createImageBitmap(b)).then(() => "avif", () => "webp");
    async function baixa(nome, tipo) {
      const r = await fetch(url + nome, { priority: "high" });
      if (!r.ok) throw Error(nome + " " + r.status);
      const b = tipo === "json" ? await r.text() : await r.arrayBuffer();
      st.bytes += tipo === "json" ? b.length : b.byteLength;
      return tipo === "json" ? JSON.parse(b) : b;
    }
    const cache = {};
    function textura(nome, cor, canal, repete) {
      if (cache[nome]) return cache[nome];
      return (cache[nome] = baixa(nome).then((buf) => createImageBitmap(new Blob([buf]), { imageOrientation: "flipY" })).then((bmp) => {
        const t = new T.Texture(bmp);
        t.flipY = false;
        t.colorSpace = cor ? T.SRGBColorSpace : T.NoColorSpace;
        t.channel = canal;
        if (repete) t.wrapS = t.wrapT = T.RepeatWrapping;
        t.anisotropy = Math.min(4, maq.ren.capabilities.getMaxAnisotropy());
        t.needsUpdate = true;
        return t;
      }));
    }
    // formato 2: 12 bits em diferenca do vertice anterior; indice em diferenca zigzag
    function geometria(bin, g) {
      const soma = (src, n, c) => { const o = new Float32Array(n * c), a = new Int32Array(c);
        for (let i = 0; i < n * c; i++) { const k = i % c; a[k] = (a[k] + src[i]) & 0xffff; o[i] = a[k]; } return o; };
      const geo = new T.BufferGeometry();
      const p = soma(new Int16Array(bin, g.pos, g.nv * 3), g.nv, 3);
      for (let i = 0; i < p.length; i++) { const k = i % 3; p[i] = g.min[k] + p[i] / g.q * (g.max[k] - g.min[k]); }
      geo.setAttribute("position", new T.BufferAttribute(p, 3));
      geo.setAttribute("normal", new T.InterleavedBufferAttribute(new T.InterleavedBuffer(new Int8Array(bin, g.nor, g.nv * 4), 4), 3, 0, true));
      const u = soma(new Int16Array(bin, g.uv, g.nv * 2), g.nv, 2);
      for (let i = 0; i < u.length; i++) { const k = i % 2; u[i] = g.uvmin[k] + u[i] / g.q * (g.uvmax[k] - g.uvmin[k]); }
      geo.setAttribute("uv", new T.BufferAttribute(u, 2));
      const u2 = soma(new Int16Array(bin, g.uv2, g.nv * 2), g.nv, 2);
      for (let i = 0; i < u2.length; i++) u2[i] /= g.q;
      geo.setAttribute("uv1", new T.BufferAttribute(u2, 2));
      if (g.tan !== undefined) geo.setAttribute("tangent", new T.BufferAttribute(new Int8Array(bin, g.tan, g.nv * 4), 4, true));
      const zz = g.i32 ? new Uint32Array(bin, g.idx, g.ni) : new Uint16Array(bin, g.idx, g.ni);
      const ix = g.nv > 65535 ? new Uint32Array(g.ni) : new Uint16Array(g.ni);
      for (let i = 0, a = 0; i < g.ni; i++) { const z = zz[i]; a += (z >>> 1) ^ -(z & 1); ix[i] = a; }
      geo.setIndex(new T.BufferAttribute(ix, 1));
      geo.computeBoundingSphere();
      return geo;
    }
    const srgb = (c) => new T.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, T.SRGBColorSpace);
    async function monta(p) {
      const f = st.fmt = await formato;
      const pasta = p.pasta + "/";
      const [J, bin] = await Promise.all([baixa(pasta + "peca.json", "json"), baixa(pasta + "geo.bin")]);
      const [ao, rel] = await Promise.all([textura(`${pasta}ao-${tam}.${f}`, false, 1),
        p.modo === "BN" ? textura(`${pasta}relevo-${tam}.${f}`, false, 1) : null]);
      const mats = [], malhas = [];
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const g of J.grupos) {
        const m = J.materiais[g.material];
        const mat = (m.spec ?? 0.5) !== 0.5 ? new T.MeshPhysicalMaterial({ roughness: m.rough, metalness: m.metal, specularIntensity: m.spec * 2 })
          : new T.MeshStandardMaterial({ roughness: m.rough, metalness: m.metal });
        const metal = m.metal > 0.5;
        if (m.tex) {
          mat.map = await textura(`materiais/${m.tex}-cor-${tam}.${f}`, true, 0, true);
          if ((m.escala ?? 1) !== 1) mat.map.repeat.setScalar(1 / m.escala);
          mat.color.setRGB(m.tinta[0], m.tinta[1], m.tinta[2], T.LinearSRGBColorSpace);
          if (m.relevo && !(rel && !metal)) {
            mat.normalMap = await textura(`materiais/${m.tex}-nor-${tam}.${f}`, false, 0, true);
            if ((m.escala ?? 1) !== 1) mat.normalMap.repeat.setScalar(1 / m.escala);
            mat.normalScale.setScalar(m.relevo);
          }
        } else {
          mat.color.copy(srgb(m.cor));
        }
        if (rel && !metal) mat.normalMap = rel;
        mat.aoMap = ao;
        if (m.emissao) { mat.emissive.copy(srgb(m.cor)); mat.emissiveIntensity = m.emissao; }
        if ((m.alpha ?? 1) < 1) { mat.transparent = true; mat.opacity = m.alpha; mat.depthWrite = false; }
        if (m.duplo) mat.side = T.DoubleSide;
        mats.push(mat);
        const geo = geometria(bin, g);
        if (!(rel && !metal)) geo.deleteAttribute("tangent");
        malhas.push([geo, mat]);
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], g.min[k]); mx[k] = Math.max(mx[k], g.max[k]); }
      }
      return { mats, malhas, mn, mx };
    }
    const prontas = {}, instaladas = new Map();
    // Encaixa na caixa do registro: largura x altura x profundidade do cadastro; piso em 0, pegada
    // centrada (frente = +Z, igual ao catalogo e ao exporta.py).
    function instala(obj, P) {
      const it = obj.userData.registroMovel, s = obj.scale;
      const fora = new T.Group(), dentro = new T.Group();
      fora.name = dentro.name = "movel-web";
      for (const [geo, mat] of P.malhas) {
        const me = new T.Mesh(geo, mat);
        me.castShadow = me.receiveShadow = true;
        dentro.add(me);
      }
      const sz = [0, 1, 2].map((k) => P.mx[k] - P.mn[k]);
      if (P.ajuste === "altura") {
        // eletrodomestico: proporcao REAL (esticar 45% um fogao de 43 cm na vaga de 62 deixa ele gordo).
        // Escala uniforme pela altura do registro, encostado na parede (fundo da caixa), centrado na vaga.
        const u = (it.h || sz[1]) / sz[1];
        dentro.position.set(-(P.mn[0] + P.mx[0]) / 2, -P.mn[1], -P.mn[2] - it.d / 2 / u);
        fora.scale.set(u / s.x, u / s.y, u / s.z);
      } else if (P.ajuste === "real") {
        // conjunto (painel + rack): tamanho de verdade, encostado na parede, centrado no registro
        dentro.position.set(-(P.mn[0] + P.mx[0]) / 2, -P.mn[1], -P.mn[2] - it.d / 2);
        fora.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
      } else if (P.ajuste === "plano") {
        // cortina, painel: estica largura e altura ate o registro e MANTEM a profundidade real (esmagar
        // 25 cm de dobra em 12 achata o pano); encosta o fundo na parede (fundo da caixa).
        const ux = it.w / sz[0], uy = (it.h || sz[1]) / sz[1];
        dentro.position.set(-(P.mn[0] + P.mx[0]) / 2, -P.mn[1], -P.mn[2] - it.d / 2);
        fora.scale.set(ux / s.x, uy / s.y, 1 / s.z);
      } else {
        // caixa do registro (w x h x d), pegada centrada
        dentro.position.set(-(P.mn[0] + P.mx[0]) / 2, -P.mn[1], -(P.mn[2] + P.mx[2]) / 2);
        fora.scale.set(it.w / sz[0] / s.x, (it.h || sz[1]) / sz[1] / s.y, it.d / sz[2] / s.z);
      }
      fora.add(dentro);
      obj.add(fora);
      instaladas.set(obj, { grupo: fora, P, env: false });
    }
    function esconde() {
      // o conjunto tira de cena os moveis que ele substitui (painel: ripado e tv do catalogo)
      const casa = maq.planta && maq.planta();
      if (casa) for (const p of pecas) if (p.esconde && prontas[p.tipo]) for (const t of p.esconde) for (const o of acha(t)) o.visible = false;
      for (const [obj, e] of instaladas) {
        for (const c of obj.children) if (c !== e.grupo) c.visible = false;
        if (!e.env) {
          // reflexo do comodo: a SONDA (CubeCamera da entrada) so foi pra parede e piso -- o movel do
          // catalogo nem tem envMap. Pega a textura de quem tem; intensidade da peca (env), padrao 1.
          let env = null;
          const casa = maq.planta && maq.planta();
          if (casa) casa.traverse((o) => { const m = o.material; if (!env && m && !Array.isArray(m) && m.envMap && m.isMeshStandardMaterial) env = m.envMap; });
          if (env) {
            for (const m of e.P.mats) { m.envMap = env; m.envMapIntensity = e.P.env ?? 1; m.needsUpdate = true; }
            e.env = true;
            st.pecas[obj.userData.registroMovel.tipo].env = e.P.env ?? 1;
          }
        }
      }
    }
    function acha(tipo) {
      const h = maq.planta && maq.planta();
      if (!h) return [];
      return h.children.filter((o) => o.userData && o.userData.movel && o.userData.registroMovel && o.userData.registroMovel.tipo === tipo);
    }
    let comecou = false;
    function observa() {
      for (const p of pecas) {
        if (!prontas[p.tipo]) continue;
        for (const obj of acha(p.tipo)) if (!instaladas.has(obj)) { instala(obj, prontas[p.tipo]); marca("instalado_" + p.tipo); }
      }
      esconde();
      const modo = maq.modo ? maq.modo() : "visita";
      if (!comecou && (quando === "ja" || modo === "visita" || modo === "planta3d")) {
        comecou = true;
        marca("pedido");
        for (const p of pecas) {
          st.pecas[p.tipo] = { modo: p.modo };
          monta(p).then((P) => { P.env = p.env; P.ajuste = p.ajuste; prontas[p.tipo] = P; marca("pronto_" + p.tipo); },
                        (e) => { st.erro = String(e); });
        }
      }
      root.requestAnimationFrame(observa);
    }
    marca("inicio");
    root.requestAnimationFrame(observa);
    return root.__movelWeb;
  }
  root.MovelWeb = { start };
})(window);
