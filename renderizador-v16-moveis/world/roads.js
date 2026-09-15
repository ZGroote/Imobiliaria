/* Owns the city-wide junction index and road/sidewalk strip geometry. */
(function(root) {
  "use strict";
  function create({THREE, widthOf, registerTerrain}) {
// Shared node index: junctions must also see streets from neighboring blocks.
const viaJunctions = new Map();
function indexaJuncoes(roads) {
  viaJunctions.clear();
  for(const w of roads) for(let i=1;i<w.pts.length;i++) {
    const a=w.pts[i-1],b=w.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    if(len<.2)continue;
    for(const p of [a,b]) {
      const key=Math.round(p[0])+':'+Math.round(p[1]);
      let list=viaJunctions.get(key);if(!list)viaJunctions.set(key,list=[]);
      list.push({w,x:p[0],z:p[1],ux:dx/len,uz:dz/len,half:widthOf(w)/2});
    }
  }
}
function recuoJuncao(w,p,ux,uz,outer) {
  let cut=0;
  const x=Math.round(p[0]),z=Math.round(p[1]);
  for(let ix=x-1;ix<=x+1;ix++)for(let iz=z-1;iz<=z+1;iz++) {
    for(const other of viaJunctions.get(ix+':'+iz)||[]) {
      if(other.w===w||Math.hypot(p[0]-other.x,p[1]-other.z)>.75)continue;
      const sine=Math.abs(ux*other.uz-uz*other.ux),cosine=Math.abs(ux*other.ux+uz*other.uz);
      if(sine<.12)continue; // continuation of the same street, not a crossing
      cut=Math.max(cut,(other.half+outer*cosine)/sine+.30);
    }
  }
  return cut;
}
function buildRibbons(recs, y, mul, opt) {
  opt = opt || {};
  const de = opt.de || 0, junta = opt.junta !== false, meio = !!opt.meiofio;
  const yBaixo = opt.y_baixo != null ? opt.y_baixo : 0.10;
  const P = [], V = [], SURF = [];
  const quad = (ax,ay,az, bx,by,bz, cx,cy,cz, dx2,dy2,dz2, va,vb,vc,vd, ua,ub,base, flip=false,surface=0) => {
    if (flip) {
      P.push(ax,ay,az, cx,cy,cz, bx,by,bz, ax,ay,az, dx2,dy2,dz2, cx,cy,cz);
      V.push(ua,va,base, ub,vc,base, ub,vb,base, ua,va,base, ua,vd,base, ub,vc,base);
    } else {
      P.push(ax,ay,az, bx,by,bz, cx,cy,cz, ax,ay,az, cx,cy,cz, dx2,dy2,dz2);
      V.push(ua,va,base, ub,vb,base, ub,vc,base, ua,va,base, ub,vc,base, ua,vd,base);
    }
    for(let k=0;k<6;k++) SURF.push(surface);
  };
  for (const w of recs) {
    const base = widthOf(w) / 2, pts = w.pts;
    let total = 0;
    for (let i = 0; i < pts.length-1; i++) total += Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]);
    const corte = de > 0 ? Math.min(base * mul * 1.35, total * 0.32) : 0;
    let acc = 0;
    for (let i = 0; i < pts.length-1; i++) {
      const a = pts[i], b = pts[i+1];
      const dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx,dz);
      if (L < 0.2) continue;
      const ux = dx/L, uz = dz/L, px = -uz, pz = ux;
      // recorte do trecho pra respeitar a folga das pontas da VIA (nao do trecho)
      let s0 = Math.max(acc, corte), s1 = Math.min(acc + L, total - corte);
      if(de>0) {
        s0=Math.max(s0,acc+recuoJuncao(w,a,ux,uz,base*mul));
        s1=Math.min(s1,acc+L-recuoJuncao(w,b,ux,uz,base*mul));
      }
      if (s1 - s0 > 0.2) {
        const t0 = s0 - acc, t1 = s1 - acc;
        const a0x = a[0]+ux*t0, a0z = a[1]+uz*t0, b0x = a[0]+ux*t1, b0z = a[1]+uz*t1;
        const hd = base*de, ha = base*mul;
        if (de > 0) {
          for (const sg of [1, -1]) {
            const bevel=meio?Math.min(.04,(ha-hd)*.1,(y-yBaixo)*.25):0;
            const edge=hd+bevel, gutter=Math.min(.30,base*.12);
            // Each side needs opposite winding: both tops face up, both risers
            // face the asphalt. Previously half the sidewalk was back-face culled.
            quad(a0x+px*edge*sg, y, a0z+pz*edge*sg,  b0x+px*edge*sg, y, b0z+pz*edge*sg,
                 b0x+px*ha*sg, y, b0z+pz*ha*sg,  a0x+px*ha*sg, y, a0z+pz*ha*sg,
                 edge*sg, edge*sg, ha*sg, ha*sg, s0, s1, base,sg>0);
            if (meio) {
              quad(a0x+px*(hd-gutter)*sg,yBaixo+.005,a0z+pz*(hd-gutter)*sg,
                   b0x+px*(hd-gutter)*sg,yBaixo+.005,b0z+pz*(hd-gutter)*sg,
                   b0x+px*hd*sg,yBaixo+.015,b0z+pz*hd*sg,
                   a0x+px*hd*sg,yBaixo+.015,a0z+pz*hd*sg,
                   (hd-gutter)*sg,(hd-gutter)*sg,hd*sg,hd*sg,s0,s1,base,sg>0,2);
              quad(a0x+px*hd*sg, yBaixo+.015, a0z+pz*hd*sg, b0x+px*hd*sg, yBaixo+.015, b0z+pz*hd*sg,
                   b0x+px*hd*sg, y-bevel, b0z+pz*hd*sg, a0x+px*hd*sg, y-bevel, a0z+pz*hd*sg,
                   hd*sg, hd*sg, hd*sg, hd*sg, s0, s1, base,sg>0,1);
              quad(a0x+px*hd*sg,y-bevel,a0z+pz*hd*sg,b0x+px*hd*sg,y-bevel,b0z+pz*hd*sg,
                   b0x+px*edge*sg,y,b0z+pz*edge*sg,a0x+px*edge*sg,y,a0z+pz*edge*sg,
                   hd*sg,hd*sg,edge*sg,edge*sg,s0,s1,base,sg>0,3);
              // Close the exposed outside and cut ends: no paper-thin slab.
              quad(a0x+px*ha*sg,yBaixo,a0z+pz*ha*sg,b0x+px*ha*sg,yBaixo,b0z+pz*ha*sg,
                   b0x+px*ha*sg,y,b0z+pz*ha*sg,a0x+px*ha*sg,y,a0z+pz*ha*sg,
                   ha*sg,ha*sg,ha*sg,ha*sg,s0,s1,base,sg<0,1);
              for(const end of [0,1]) {
                if(end===0?!(s0>acc||i===0):!(s1<acc+L||i===pts.length-2))continue;
                const ex=end?b0x:a0x,ez=end?b0z:a0z,u=end?s1:s0;
                quad(ex+px*hd*sg,yBaixo,ez+pz*hd*sg,ex+px*ha*sg,yBaixo,ez+pz*ha*sg,
                     ex+px*ha*sg,y,ez+pz*ha*sg,ex+px*hd*sg,y-bevel,ez+pz*hd*sg,
                     hd*sg,ha*sg,ha*sg,hd*sg,u,u,base,end?sg>0:sg<0,1);
              }
            }
          }
        } else {
          quad(a0x+px*ha, y, a0z+pz*ha,  b0x+px*ha, y, b0z+pz*ha,
               b0x-px*ha, y, b0z-pz*ha,  a0x-px*ha, y, a0z-pz*ha,
               ha, ha, -ha, -ha, s0, s1, base);
        }
      }
      if (junta && i > 0) {
        const h = base*mul;
        const c = [[-h,-h],[h,-h],[h,h],[-h,-h],[h,h],[-h,h]];
        for (const [cx, cz] of c) {
          P.push(a[0]+cx, y, a[1]+cz);
          V.push(acc + cx*ux + cz*uz, cx*px + cz*pz, base);
          SURF.push(0);
        }
      }
      acc += L;
    }
  }
  if (!P.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(P,3));
  g.setAttribute("aVia", new THREE.BufferAttribute(new Float32Array(V), 3));
  g.setAttribute("aViaSurface", new THREE.BufferAttribute(new Float32Array(SURF), 1));
  registerTerrain(g); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

    function meshes(records, {material, K, shadows}) {
      const meshes = [];
  // A pista NAO pode descer perto do chao: o poligono da quadra vai ate o EIXO da
  // via, entao o chao do quarteirao passa por baixo do asfalto inteiro. Com a pista a
  // 0,02 sobravam 8 cm sobre ele e a rua sumia embaixo do terreno. 0,10 devolve folga
  // A calcada sobe a 0,32: 22 cm acima da pista, com sarjeta e quina chanfrada.
  const rd = buildRibbons(records, 0.10, 1.0);
  if (rd) { const m = new THREE.Mesh(rd, material(K.asfalto, false)); m.receiveShadow = shadows; meshes.push(m); }
  const wk = buildRibbons(records, 0.32, 1.55, { de: 1.0, junta: false, meiofio: true, y_baixo: 0.10 });
  if (wk) { const m = new THREE.Mesh(wk, material(K.walk, true)); m.receiveShadow = shadows; meshes.push(m); }
      return meshes;
    }
    return {indexaJuncoes, buildRibbons, meshes};
  }
  root.WorldRoads = {create};
})(globalThis);
