/* Decode the existing compact city format without DOM or scene state. */
(function(root) {
  'use strict';
  function createDecoder(Q, shoelace) {
    function readPath(arr, i, out) {
      const n = arr[i++]; let lx = 0, lz = 0;
      for (let k = 0; k < n; k++) {
        lx += arr[i++]; lz += arr[i++];
        out.push([lx/Q, lz/Q]);
      }
      return i;
    }

    function decode(data) {
      const B = [], R = [], G = [], names = data.names || [];
      const meta = new Map();
      for (let i = 0; i < (data.bm||[]).length; i += 3)
        meta.set(data.bm[i], { name: names[data.bm[i+1]] || null, addr: names[data.bm[i+2]] || null });
      const q = data.q || 10, scale = q / Q;
      let i = 0, n = 0;
      while (i < data.b.length) {
        const c = data.b[i++], h = data.b[i++]/q;
        const r = []; i = readPath(data.b, i, r);
        if (scale !== 1) for (const p of r) { p[0] *= scale; p[1] *= scale; }
        const m = meta.get(n) || {};
        let a = Math.abs(shoelace(r))/2;
        B.push({ r, h, c, area:a, name:m.name || null, addr:m.addr || null, urbanLot:data.urbanLots?.[n], fa:(data.fa && data.fa[n]!==undefined ? data.fa[n] : 400) });
        n++;
      }
      i = 0;
      while (i < data.r.length) {
        const k = data.r[i++], ni = data.r[i++];
        const pts = []; i = readPath(data.r, i, pts);
        R.push({ pts, k, name: names[ni] || null });
      }
      i = 0;
      while (i < (data.g||[]).length) {
        const r = []; i = readPath(data.g, i, r);
        G.push({ r });
      }
      // v4: bl[] = [cx, cz, raio, inicioB, qtdB] por quarteirao. Os indices batem
      // com a ordem de B porque o build_city_v4.py reordenou data.b agrupando por
      // quadra -- por isso aqui e uma fatia contigua, nao uma lista de indices.
      const grp = [], bl = data.bl || [];
      for (let k = 0; k < bl.length; k += 5)
        grp.push({ cx: bl[k]/Q*scale, cz: bl[k+1]/Q*scale, rad: bl[k+2]/Q*scale,
                   s: bl[k+3], n: bl[k+4] });
      return { B, R, G, grp };
    }
    return decode;
  }
  root.CityData = Object.freeze({createDecoder});
})(globalThis);
