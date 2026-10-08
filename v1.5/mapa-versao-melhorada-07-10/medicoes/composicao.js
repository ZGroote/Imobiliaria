// Avaliado na pagina (depois da montagem): de onde vem cada triangulo e cada chamada.
// Percorre a cena, so objetos visiveis (cadeia de pais visivel), soma tris*instancias
// por "familia": nome do ancestral de topo + tipo + nome do material.
(() => {
  const sc = __perf.scene, cam = __perf.camera;
  const out = {}; let total = 0, objs = 0, inst = 0;
  const visivel = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const topo = o => { let p = o; const cad = []; while (p && p !== sc) { cad.push(p.name || p.type); p = p.parent; } return cad.reverse().slice(0, 2).join('/'); };
  sc.traverse(o => {
    if (!o.isMesh && !o.isLine && !o.isPoints) return;
    if (!visivel(o)) return;
    const g = o.geometry; if (!g) return;
    const n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
    const dr = g.drawRange && g.drawRange.count !== Infinity ? Math.min(n, g.drawRange.count) : n;
    const k = o.isInstancedMesh ? o.count : (g.isInstancedBufferGeometry ? (g.instanceCount === Infinity ? 1 : g.instanceCount) : 1);
    const tris = o.isMesh ? Math.floor(dr / 3) * k : 0;
    const mat = Array.isArray(o.material) ? o.material.map(m => m.name || m.type).join('+') : (o.material && (o.material.name || o.material.type));
    const chave = topo(o) + ' | ' + (o.isInstancedMesh ? 'Instanced' : o.type) + ' | ' + mat;
    const e = out[chave] || (out[chave] = { objetos: 0, tris: 0, instancias: 0, trisPorInstanciaMax: 0, vertices: 0 });
    e.objetos++; e.tris += tris; e.instancias += k; e.trisPorInstanciaMax = Math.max(e.trisPorInstanciaMax, Math.floor(dr / 3));
    e.vertices += g.attributes.position ? g.attributes.position.count : 0;
    total += tris; objs++; inst += k;
  });
  const lista = Object.entries(out).sort((a, b) => b[1].tris - a[1].tris).slice(0, 30)
    .map(([k, v]) => ({ familia: k, ...v, pct: +(100 * v.tris / total).toFixed(1) }));
  return { totalTris: total, objetosVisiveis: objs, instancias: inst, familias: lista };
})()
