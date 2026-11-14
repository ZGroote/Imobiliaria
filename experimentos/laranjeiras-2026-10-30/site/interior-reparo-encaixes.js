// Encaixes medidos nas quatro fontes congeladas publicadas. As peças novas
// leem as sondas de luz, sem alterar a geometria nem os UVs do atlas gravado.
const ENCAIXES = {
  canto: {
    sha: '2dfedba163a0e70965d454df17b1142eed74fdaa20182f50358c829dc4e46b16',
    ombreiras: [{ x: [.490, .525], y: [1.05, 2.20], z: [-3.315, -3.185] }],
  },
  'canto-espelhado': {
    sha: '5b69f7f3865c37b652b8edbf4fc0d5c3f37ff93f722fe114b883ecc9478c6eca',
    ombreiras: [{ x: [-.525, -.490], y: [1.05, 2.20], z: [-3.315, -3.185] }],
  },
  meio: {
    sha: '08bb9124c5528cedf85eb00e6efdc37b3a4385eb0a3189d501d237d44579b2dc',
    ombreiras: [
      { x: [-2.890, -2.760], y: [1.05, 2.20], z: [-1.450, -1.415] },
      { x: [2.760, 2.890], y: [1.50, 2.10], z: [4.000, 4.035] },
    ],
  },
  'meio-espelhado': {
    sha: 'e47c3ef7c1235a8469c22258720743f7e603758f5e48462f1253bff44ec7a8e5',
    ombreiras: [
      { x: [-2.890, -2.760], y: [1.05, 2.20], z: [1.415, 1.450] },
      { x: [2.760, 2.890], y: [1.50, 2.10], z: [-4.035, -4.000] },
    ],
  },
};

function fecharRodapes(THREE, layout, material, own) {
  const meiaParede = .065, saliencia = .016, meiaRodape = meiaParede + saliencia;
  const base = .02, topo = .115, perto = (a, b) => Math.abs(a - b) < 1e-5;
  const paredes = layout.walls.filter(w => w.y0 < .05).map(w => {
    const eixo = perto(w.a[1], w.b[1]) ? 0 : 1, transversal = 1 - eixo;
    const inicio = w.a[eixo] - (w.remateA ?? (w.pa ? 0 : meiaParede));
    const fim = w.b[eixo] + (w.remateB ?? (w.pb ? 0 : meiaParede));
    return { eixo, inicio, fim, centro: w.a[transversal] };
  });
  const planta = ({ eixo, inicio, fim, centro }, meia) => eixo === 0
    ? [inicio, fim, centro - meia, centro + meia]
    : [centro - meia, centro + meia, inicio, fim];
  const miolos = paredes.map(w => planta(w, meiaParede));
  const rodapes = paredes.map(w => planta(w, meiaRodape));
  const quinas = [];
  for (const h of paredes.filter(w => w.eixo === 0)) {
    for (const v of paredes.filter(w => w.eixo === 1)) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx < 0 ? h.inicio : h.fim, z = sz < 0 ? v.inicio : v.fim;
        // Na quina externa os dois filetes avançam 16 mm além do miolo,
        // mas os comprimentos antigos param nos 65 mm da parede.
        if (!perto(x, v.centro + sx * meiaParede) || !perto(z, h.centro + sz * meiaParede)) continue;
        const xf = x + sx * saliencia, zf = z + sz * saliencia;
        const rect = [Math.min(x, xf), Math.max(x, xf), Math.min(z, zf), Math.max(z, zf)];
        quinas.push({ rect, sx, sz, xf, zf });
      }
    }
  }

  const pos = [], uv = [], cores = [];
  const cor = new THREE.Color(layout.unit.cores?.rodape ?? 0xF4F2EE);
  const corTopo = cor.clone().multiplyScalar(.72);
  function quad(vertices, cima = false, inverter = false) {
    for (const i of inverter ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) {
      const [x, y, z] = vertices[i];
      pos.push(x, y, z);
      uv.push(cima ? x : x + z, cima ? z : y);
      cores.push(...(cima ? corTopo : cor).toArray());
    }
  }
  for (const { rect: [x0, x1, z0, z1], sx, sz, xf, zf } of quinas) {
    quad([[xf, base, z0], [xf, topo, z0], [xf, topo, z1], [xf, base, z1]], false, sx < 0);
    quad([[x0, base, zf], [x1, base, zf], [x1, topo, zf], [x0, topo, zf]], false, sz < 0);
  }
  const faixa = rodapes.concat(quinas.map(q => q.rect));
  const eixos = [0, 2].map(i => [...new Set(faixa.concat(miolos).flatMap(r =>
    [r[i], r[i + 1]].map(n => Math.round(n * 1e5) / 1e5)))].sort((a, b) => a - b));
  const cobre = (r, x, z) => r[0] < x && x < r[1] && r[2] < z && z < r[3];
  const [xs, zs] = eixos;
  // Só tampa a saliência visível. A união evita faces coplanares nos encontros.
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < zs.length; j++) {
    const x0 = xs[i - 1], x1 = xs[i], z0 = zs[j - 1], z1 = zs[j];
    const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    if (faixa.some(r => cobre(r, x, z)) && !miolos.some(r => cobre(r, x, z)))
      quad([[x0, topo, z0], [x0, topo, z1], [x1, topo, z1], [x1, topo, z0]], true);
  }
  const geometry = own(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Rodapés · tampas e encontros';
  mesh.receiveShadow = true;
  return { mesh, quinas: quinas.length };
}

export function repairFrozenJoins({ THREE, scene, layout, typology, sourceSHA256, furniture, materials, own }) {
  const ajustes = ENCAIXES[typology];
  if (!ajustes || ajustes.sha !== sourceSHA256) return { windowJambs: 0, tankApron: false };
  const rodapes = fecharRodapes(THREE, layout, materials.m0, own);
  scene.add(rodapes.mesh);

  function peca(nome, dimensoes, material, cor) {
    const geometry = own(new THREE.BoxGeometry(...dimensoes));
    const { position, normal, uv } = geometry.attributes;
    const cores = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      cor.toArray(cores, i * 3);
      const u = Math.abs(normal.getX(i)) > .5 ? position.getZ(i) : position.getX(i);
      const v = Math.abs(normal.getY(i)) > .5 ? position.getZ(i) : position.getY(i);
      uv.setXY(i, u, v);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = nome;
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  }

  const parede = new THREE.Color('#E2DED5');
  const eixoEspessura = typology.startsWith('canto') ? 2 : 0;
  for (const faixa of ajustes.ombreiras) {
    const eixos = [faixa.x, faixa.y, faixa.z];
    // Sobrepor 1 mm ao contorno do vão. Recuar 1 mm das faces largas da
    // parede evita sobreposição de superfícies coplanares no encontro.
    const dimensoes = eixos.map(([a, b], i) => b - a + (i === eixoEspessura ? -.002 : .002));
    const mesh = peca('Ombreira de janela · fechamento', dimensoes, materials.m0, parede);
    mesh.position.set(...eixos.map(([a, b]) => (a + b) / 2));
    scene.add(mesh);
  }

  const tanque = furniture.find(item => item.nome === 'Tanque');
  const corpo = tanque?.group?.children.find(mesh => mesh.isMesh && mesh.userData.furnitureId === tanque.id);
  if (corpo && !Array.isArray(corpo.material)) {
    // A frente original termina a 0,825 m e a pedra começa a 0,860 m.
    // A travessa recuada fecha o vão sem cobrir o puxador abaixo dele.
    const mesh = peca('Tanque · travessa sob o tampo', [.568, .037, .019], corpo.material, new THREE.Color(tanque.cor));
    mesh.position.set(0, .8425, .2595);
    mesh.userData.furnitureId = tanque.id;
    corpo.add(mesh);
    return { windowJambs: ajustes.ombreiras.length, tankApron: true, skirtingCorners: rodapes.quinas };
  }
  return { windowJambs: ajustes.ombreiras.length, tankApron: false, skirtingCorners: rodapes.quinas };
}
