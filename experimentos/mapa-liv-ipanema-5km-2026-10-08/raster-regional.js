/* Run as a prefix of __app, after data inflation and before the renderer starts.
   Preserve the municipal origin and original sampling grid. Only transfer shrinks;
   the runtime grids still contain the original number of cells. */
(function (root) {
  "use strict";
  function base64(bytes) {
    const parts = [];
    for (let i = 0; i < bytes.length; i += 8192)
      parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    return btoa(parts.join(""));
  }

  function expand(data) {
    if (data && data.format === "regional-raster-sparse-v2") {
      const n=data.source_grid?.n,half=data.source_grid?.half_m,indices=data.indices;
      if(!Number.isInteger(n)||n<2||!Number.isFinite(half)||half<=0||!Array.isArray(indices)||!indices.length)
        throw Error("Invalid sparse regional raster");
      const step=2*half/(n-1),cx=data.center_m?.x,cz=data.center_m?.z,r=data.radius_m;
      if(![cx,cz,r].every(Number.isFinite)||r<=0)throw Error("Invalid sparse circle");
      let last=-1;
      for(const i of indices){
        if(!Number.isInteger(i)||i<=last||i>=n*n||i<0||Math.hypot(-half+(i%n)*step-cx,-half+Math.floor(i/n)*step-cz)>r+1e-7)
          throw Error("Sparse raster contains a sample outside the circle");
        last=i;
      }
      let compact,result;
      if(data.kind==="ndvi"){
        compact=Uint8Array.from(atob(data.ndvi_b64),c=>c.charCodeAt(0));
        if(compact.length!==indices.length)throw Error("Invalid sparse NDVI count");
        const full=new Uint8Array(n*n);
        indices.forEach((i,j)=>{full[i]=compact[j];});
        result={...data,n,half_m:half,format:"expanded-sparse-regional-v2",ndvi_b64:base64(full)};
      }else if(data.kind==="elevation"){
        compact=data.values;
        if(!Array.isArray(compact)||compact.length!==indices.length||!compact.every(Number.isFinite))
          throw Error("Invalid sparse elevation values");
        result=new Array(n*n);indices.forEach((i,j)=>{result[i]=compact[j];});
        // Missing border neighbors are derived from the nearest transmitted
        // sample. They contain no municipal data from outside the circle.
        const cols=indices.map(i=>i%n),rows=indices.map(i=>Math.floor(i/n));
        for(let i=0;i<result.length;i++){
          if(result[i]!==undefined)continue;
          const col=i%n,row=Math.floor(i/n);let best=Infinity,k=0;
          for(let j=0;j<indices.length;j++){
            const d=(col-cols[j])**2+(row-rows[j])**2;
            if(d<best){best=d;k=j;}
          }
          result[i]=compact[k];
        }
      }else throw Error("Unknown sparse raster kind");
      return {data:result,report:{kind:data.kind,format:data.format,source_grid:data.source_grid,
        outside:"not-transmitted",edge_policy:data.edge_policy,exported_cells:indices.length,
        runtime_cells:n*n,max_sample_radius_m:Math.max(...indices.map(i=>Math.hypot(-half+(i%n)*step-cx,-half+Math.floor(i/n)*step-cz)))}};
    }
    if (!data || data.format !== "regional-raster-v1") return null;
    const n = data.source_grid?.n, half = data.source_grid?.half_m, w = data.window;
    if (!Number.isInteger(n) || n < 2 || !Number.isFinite(half) || half <= 0 || !w ||
        ![w.row0, w.col0, w.width, w.height].every(Number.isInteger) ||
        w.row0 < 0 || w.col0 < 0 || w.width < 1 || w.height < 1 ||
        w.row0 + w.height > n || w.col0 + w.width > n)
      throw new Error("Invalid regional raster grid/window");
    let compact, result;
    if (data.kind === "ndvi") {
      compact = Uint8Array.from(atob(data.ndvi_b64), c => c.charCodeAt(0));
      if (compact.length !== w.width * w.height)
        throw new Error("Invalid regional NDVI cell count");
      const full = new Uint8Array(n * n); // Outside the transported window: zero.
      for (let row = 0; row < w.height; row++)
        full.set(compact.subarray(row * w.width, (row + 1) * w.width),
                 (w.row0 + row) * n + w.col0);
      result = {...data, format: "expanded-regional-raster-v1", n, half_m: half,
                ndvi_b64: base64(full)};
    } else if (data.kind === "elevation") {
      compact = data.values;
      if (!Array.isArray(compact) || compact.length !== w.width * w.height ||
          !compact.every(Number.isFinite))
        throw new Error("Invalid regional elevation cell count/values");
      // This only supplies the renderer's background beyond the window. Actual
      // source samples in the circle and its two-cell halo stay byte-for-byte equal.
      result = new Array(n * n);
      for (let row = 0; row < n; row++) {
        const localRow = Math.max(0, Math.min(w.height - 1, row - w.row0));
        for (let col = 0; col < n; col++) {
          const localCol = Math.max(0, Math.min(w.width - 1, col - w.col0));
          result[row * n + col] = compact[localRow * w.width + localCol];
        }
      }
    } else throw new Error("Unknown regional raster kind");
    return {data: result, report: {kind: data.kind, source_grid: data.source_grid,
      window: w, halo_cells: data.halo_cells, outside: data.outside,
      exported_cells: compact.length, runtime_cells: n * n}};
  }

  function hydrate(doc) {
    const reports = {};
    for (const id of ["__vegetacao", "__elevdata"]) {
      const el = doc.getElementById(id);
      if (!el) continue;
      const unpacked = expand(JSON.parse(el.textContent));
      if (!unpacked) continue;
      el.textContent = JSON.stringify(unpacked.data);
      reports[unpacked.report.kind] = unpacked.report;
    }
    return reports;
  }
  root.RegionalRasters = Object.freeze({expand, hydrate});
  if (typeof document !== "undefined") root.__regionalRaster = hydrate(document);
})(globalThis);
