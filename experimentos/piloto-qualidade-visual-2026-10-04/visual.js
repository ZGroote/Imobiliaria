/* Piloto isolado: materiais CC0 sobre a mesma arquitetura, sem alterar o gerador. */
(function (root) {
  'use strict';

  function start({THREE:T, maq, base, assets, assetPath, enabled=true, calibration={}}) {
    if (!T || !maq || !base?.MAT || !Array.isArray(assets)) throw new Error('Ponte do piloto ausente');
    // Calibração opcional por material. Sem ela vale a do piloto (parede ×1,7, tint do
    // cadastro preservado). `neutralizeTint` divide paredes e pisos pela cor média por
    // vértice (o tint do cadastro), mantendo o bake; `gain` (número ou [r,g,b] linear)
    // multiplica o albedo real e, por canal, tira o matiz da própria textura. `keepTint` nos
    // móveis mantém a cor de cada peça do cadastro: a textura entra só como trama e relevo.
    for (const [id,c] of Object.entries(calibration)) {
      const num=(v,max)=>v===undefined||Number.isFinite(v)&&v>=0&&v<=max;
      const gain=Array.isArray(c?.gain)?c.gain.length===3&&c.gain.every(v=>num(v,8)):num(c?.gain,8);
      if (!['madeira','tecido','frio','parede','madeira_movel'].includes(id) || !c || !gain ||
          !num(c.normalScale,2) || !num(c.roughness,1) ||
          ['neutralizeTint','keepTint'].some(k=>c[k]!==undefined&&typeof c[k]!=='boolean'))
        throw new Error('Calibração de material inválida');
    }
    const catalog=new Map(), records=[], sofas=[], failures=[], finishes=new Map();
    let active=Boolean(enabled), wallsEnabled=true, loading=null, settled=false, installed=null, extraTriangles=0;
    let wallMeshes=0;
    const furnitureCoverage={},maskFallbacks=[];
    let requestedBytes=0, loadedMaps=0;
    for (const item of assets) {
      if (!['madeira','tecido','frio','parede','madeira_movel'].includes(item.id) || catalog.has(item.id) ||
          !(item.tileMeters>0 && Number.isFinite(item.tileMeters)) ||
          item.tileHeightMeters!==undefined&&!(item.tileHeightMeters>0&&Number.isFinite(item.tileHeightMeters)))
        throw new Error('Manifesto de materiais inválido');
      for (const kind of ['color','normal','roughness']) {
        const map=item.maps?.[kind], limit=kind==='color'?1024:512;
        if (!map || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(webp|png|jpg)$/.test(map.file) ||
            !Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width<1 || map.height<1 ||
            map.width>limit || map.height>limit || !Number.isInteger(map.bytes) || map.bytes<1)
          throw new Error('Manifesto de mapas inválido');
        requestedBytes+=map.bytes;
      }
      catalog.set(item.id,item);
    }
    if (catalog.size!==5 || requestedBytes>3000000 || typeof assetPath!=='string' ||
        !/^(?:\.\/)?[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/$/.test(assetPath))
      throw new Error('Manifesto ou diretório do piloto inválido');

    const loader=new T.TextureLoader();
    const anisotropy=Math.min(4,maq.ren?.capabilities?.getMaxAnisotropy?.() || 1);
    function texture(map, kind) {
      return new Promise((resolve,reject)=>loader.load(assetPath+map.file,tex=>{
        tex.colorSpace=kind==='color'?T.SRGBColorSpace:T.NoColorSpace;
        tex.name=map.file;
        tex.wrapS=tex.wrapT=T.RepeatWrapping;
        tex.anisotropy=anisotropy;
        tex.needsUpdate=true; loadedMaps++; resolve(tex);
      },undefined,()=>reject(new Error('Não foi possível carregar '+map.file))));
    }
    function load() {
      if (loading) return loading;
      loading=Promise.all(Array.from(catalog.values(),async item=>{
        const result=await Promise.allSettled(['color','normal','roughness'].map(kind=>texture(item.maps[kind],kind)));
        const bad=result.find(r=>r.status==='rejected');
        if (bad) {
          result.forEach(r=>{if(r.status==='fulfilled')r.value.dispose();});
          failures.push({material:item.id,message:bad.reason.message});
        } else finishes.set(item.id,{map:result[0].value,normalMap:result[1].value,roughnessMap:result[2].value});
      })).then(()=>{ settled=true;install(); apply(); return snapshot(); });
      return loading;
    }

    const tileHeight=id=>catalog.get(id).tileHeightMeters??catalog.get(id).tileMeters;
    function material(original,id,neutral=false,geo=null) {
      const m=original.clone(), maps=finishes.get(id), cal=calibration[id]||{};
      Object.assign(m,maps);
      m.name='piloto-'+id;
      m.envMap=original.envMap || base.ambientePBR || null;
      m.normalScale.setScalar(cal.normalScale??(id==='tecido'?.75:id==='parede'?.65:.5));
      m.bumpMap=null; m.bumpScale=0;
      m.metalness=0; m.roughness=cal.roughness??(id==='frio'?.65:id==='parede'?1:.95);
      // Calibração específica do reboco desta demonstração: clarear seu albedo
      // real, mantendo tint/bake e iluminação originais (sem emissão ou luz extra).
      const gain=Array.isArray(cal.gain)?new T.Color().setRGB(...cal.gain):new T.Color().setScalar(cal.gain??(id==='parede'?1.7:1));
      m.color.multiply(gain);
      const c=cal.neutralizeTint&&geo?.attributes.color;
      if(c) {
        // Média da cor por vértice = tint do cadastro. Dividir por ela deixa na cor por
        // vértice só a variação do bake, e o albedo real (×gain) decide a superfície.
        let r=0,g=0,b=0;for(let i=0;i<c.count;i++){r+=c.getX(i);g+=c.getY(i);b+=c.getZ(i);}
        if(r>0&&g>0&&b>0)m.color.multiply(new T.Color().setRGB(c.count/r,c.count/g,c.count/b));
      }
      m.onBeforeCompile=original.onBeforeCompile;m.customProgramCacheKey=original.customProgramCacheKey;
      // As cores dos móveis são tint do catálogo, não o bake da casa. O albedo real
      // substitui esse tint só nos grupos de acabamento; ferragens permanecem originais.
      if(neutral){m.vertexColors=Boolean(cal.keepTint);m.color.copy(gain);}
      m.needsUpdate=true;
      return m;
    }
    // A maquete do Cedros troca material e geometria das malhas da casa a cada quadro
    // (`luzDaPlanta`): a verdade fica em userData.materialVisita/geoVisita/geoPlanta.
    const sourceOf=mesh=>({material:mesh.userData.materialVisita||mesh.material,
      geometry:mesh.userData.geoVisita||mesh.geometry,planta:mesh.userData.geoPlanta||null});
    function plantaWith(planta,name,attr) {
      if(!planta)return null;const g=planta.clone();g.setAttribute(name,attr);return g;
    }

    function uvProjected(geo, id, scale) {
      const g=geo.index?geo.toNonIndexed():geo.clone();
      const p=g.attributes.position,n=g.attributes.normal, uvs=new Float32Array(p.count*2);
      const s=scale || {x:1,y:1,z:1};
      for (let i=0;i<p.count;i+=3) {
        const nx=Math.abs(n.getX(i)+n.getX(i+1)+n.getX(i+2));
        const ny=Math.abs(n.getY(i)+n.getY(i+1)+n.getY(i+2));
        const nz=Math.abs(n.getZ(i)+n.getZ(i+1)+n.getZ(i+2));
        for (let j=i;j<i+3;j++) {
          const x=p.getX(j)*s.x, y=p.getY(j)*s.y, z=p.getZ(j)*s.z;
          uvs[j*2]=(nx>=ny && nx>=nz?z:x)/catalog.get(id).tileMeters;
          uvs[j*2+1]=(ny>=nx && ny>=nz?z:y)/tileHeight(id);
        }
      }
      g.setAttribute('uv',new T.BufferAttribute(uvs,2));
      return g;
    }

    function finishWall(mesh) {
      if(!finishes.has('parede')||!mesh?.isMesh)return;
      const src=sourceOf(mesh);
      if(Array.isArray(src.material)||!src.geometry.attributes.normal)return;
      try {
        const g=src.geometry.clone(),p=g.attributes.position,n=g.attributes.normal;
        const uv=new Float32Array(p.count*2),tile=catalog.get('parede').tileMeters;
        // Mantém index/posição/normais e uv1. A tangente à normal horizontal dá
        // metros de parede também quando a casa está girada no referencial global.
        for(let i=0;i<p.count;i++) {
          const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=n.getX(i),nz=n.getZ(i),length=Math.hypot(nx,nz);
          uv[i*2]=(length>.5?(-nz*x+nx*z)/length:x)/tile;
          uv[i*2+1]=(length>.5?y:z)/tileHeight('parede');
        }
        g.setAttribute('uv',new T.BufferAttribute(uv,2));
        if(src.geometry.attributes.color)g.setAttribute('color',src.geometry.attributes.color);
        const m=material(src.material,'parede',false,src.planta||g);
        records.push({mesh,kind:'wall',originalMaterial:src.material,originalGeometry:src.geometry,
          nextMaterial:m,nextGeometry:g,originalPlanta:src.planta,nextPlanta:plantaWith(src.planta,'uv',g.attributes.uv)});wallMeshes++;
      }catch(error){failures.push({material:'parede',message:error.message});}
    }

    function finishFloor(mesh,id,oldTile) {
      if (!mesh?.isMesh || !finishes.has(id)) return;
      const src=sourceOf(mesh);
      if (!src.geometry.attributes.uv) return;
      const g=src.geometry.clone(), uv=g.attributes.uv, ratio=oldTile/catalog.get(id).tileMeters;
      // O bake progressivo pode continuar depois do download. Compartilhar somente
      // a cor mantém a mesma iluminação em A e B; a UV de repetição continua isolada.
      if(src.geometry.attributes.color)g.setAttribute('color',src.geometry.attributes.color);
      for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*ratio,uv.getY(i)*oldTile/tileHeight(id));
      uv.needsUpdate=true;
      records.push({mesh,originalMaterial:src.material,originalGeometry:src.geometry,
        nextMaterial:material(src.material,id,false,src.planta||g),nextGeometry:g,
        originalPlanta:src.planta,nextPlanta:plantaWith(src.planta,'uv',uv)});
    }

    function sourceMask(g,item,wood=false) {
      if(item.tipo==='tapete')return new Uint8Array(g.attributes.position.count).fill(1);
      const FURN=base.FURN,def=FURN?.MOVEIS?.[item.tipo],mask=[];
      const fromLibrary=(name,override)=>{
        const d=FURN?.MOVEIS_LIB?.[name];if(!d)return false;
        for(const i of d.idx){const fixed=override??((d.col[i*3]<<16)|(d.col[i*3+1]<<8)|d.col[i*3+2]);
          mask.push(d.herda[i]||wood&&fixed===0xA9793F?1:0);}return true;
      };
      if(def?.param)for(const part of def.param({w:item.w,h:item.h,d:item.d,estilo:item.estilo})) {
        if(part.malha){if(!fromLibrary(part.malha,part.c))break;}
        // FurnitureParam.caixaEm tem44triângulos/132vértices por caixa chanfrada.
        else for(let i=0;i<132;i++)mask.push(part.c==null||wood&&part.c===0xA9793F?1:0);
      }
      else if(def?.malha)fromLibrary(def.malha);
      if(mask.length!==g.attributes.position.count){maskFallbacks.push({tipo:item.tipo,reason:'Máscara do catálogo incompatível'});return null;}
      return Uint8Array.from(mask);
    }

    function finishFurniture(mesh,id,item,scale) {
      if (!mesh.isMesh) return;
      const src=sourceOf(mesh);
      if (Array.isArray(src.material) || !mesh.geometry.attributes.color) return;
      const g=uvProjected(mesh.geometry,id,scale), c=g.attributes.color;
      const mask=sourceMask(g,item,id==='madeira_movel');if(!mask){g.dispose();return;}
      const next=material(src.material,id,true);
      // Somente faces que herdam a cor do cadastro recebem o acabamento. Ferragens,
      // pés e peças de cor fixa preservam o material original; não viram madeira.
      const triangles=[[],[]];
      g.clearGroups();
      for(let i=0;i<c.count;i+=3) {
        const slot=mask[i]&&mask[i+1]&&mask[i+2]?0:1;
        triangles[slot].push(i);
      }
      if(!triangles[0].length){g.dispose();next.dispose();return;}
      groupTriangles(g,triangles);
      records.push({mesh,originalMaterial:src.material,originalGeometry:mesh.geometry,
        nextMaterial:[next,src.material],nextGeometry:g});
    }

    function groupTriangles(g,triangles) {
      // Agrupar faces por acabamento evita uma chamada por transição tecido/ferragem.
      const order=triangles.flat();
      for(const name of Object.keys(g.attributes)) {
        const attr=g.attributes[name], values=new attr.array.constructor(attr.array.length);
        let cursor=0;
        for(const first of order)for(let j=0;j<3;j++)for(let k=0;k<attr.itemSize;k++)
          values[cursor++]=attr.array[(first+j)*attr.itemSize+k];
        g.setAttribute(name,new T.BufferAttribute(values,attr.itemSize,attr.normalized));
      }
      g.clearGroups();let start=0;
      triangles.forEach((indices,slot)=>{if(indices.length)g.addGroup(start,indices.length*3,slot);
        start+=indices.length*3;});
    }

    function finishBed(mesh,item,scale) {
      if(!mesh.isMesh) return;
      const src=sourceOf(mesh);
      if(Array.isArray(src.material) || !mesh.geometry.attributes.color) return;
      if(!finishes.has('tecido')&&!finishes.has('madeira_movel'))return;
      const clothTile=catalog.get('tecido').tileMeters,woodTile=catalog.get('madeira_movel').tileMeters;
      const g=uvProjected(mesh.geometry,'tecido',scale),p=g.attributes.position,c=g.attributes.color;
      const mask=sourceMask(g,item);if(!mask){g.dispose();return;}
      const groups=[[],[],[]];
      g.computeBoundingBox();const box=g.boundingBox;
      // Contrato da cama atual (moveis.py): ROUPA fixa no colchão/travesseiros;
      // cor herdada no box, cabeceira e edredom. Este último fica acima do colchão
      // e à frente da cabeceira. Pés de cor fixa mantêm o material original.
      const white=[242/255,239/255,232/255];
      const inherited=i=>mask[i]===1;
      const linen=i=>!mask[i]&&Math.abs(c.getX(i)-white[0])<.009&&Math.abs(c.getY(i)-white[1])<.009&&Math.abs(c.getZ(i)-white[2])<.009;
      for(let i=0;i<p.count;i+=3) {
        const same=[i,i+1,i+2].every(inherited), roupa=[i,i+1,i+2].every(linen);
        const y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
        const duvet=same && y>box.min.y+(box.max.y-box.min.y)*.43 && z>box.min.z+(box.max.z-box.min.z)*.22;
        let slot=roupa||duvet?0:same?1:2;
        if(slot===0&&!finishes.has('tecido')||slot===1&&!finishes.has('madeira_movel'))slot=2;
        groups[slot].push(i);
        if(slot===1)for(let j=i;j<i+3;j++) {
          const uv=g.attributes.uv;uv.setXY(j,uv.getX(j)*clothTile/woodTile,uv.getY(j)*tileHeight('tecido')/tileHeight('madeira_movel'));
        }
      }
      if(!groups[0].length&&!groups[1].length){g.dispose();return;}
      groupTriangles(g,groups);
      records.push({mesh,originalMaterial:src.material,originalGeometry:mesh.geometry,
        nextMaterial:[finishes.has('tecido')?material(src.material,'tecido',true):src.material,
          finishes.has('madeira_movel')?material(src.material,'madeira_movel',true):src.material,src.material],nextGeometry:g});
    }

    function roundedBox(w,h,d,r) {
      const shape=new T.Shape(), x=w/2-r, y=h/2-r;
      shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth:Math.max(.001,d-2*r),bevelEnabled:true,
        bevelThickness:r,bevelSize:r,bevelSegments:3,steps:1,curveSegments:1});
      g.translate(0,0,-(d-2*r)/2); return g;
    }

    function merge(parts,id,original,tint) {
      const position=[],normal=[],uv=[];
      for(const part of parts) {
        const source=roundedBox(...part.size,part.radius), g=uvProjected(source,id);
        source.dispose(); g.translate(...part.at);
        for(const name of ['position','normal','uv']) {
          const dst=name==='position'?position:name==='normal'?normal:uv;
          const values=g.attributes[name].array;
          for(const value of values)dst.push(value);
        }
        g.dispose();
      }
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(position,3));
      g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      g.computeBoundingSphere();
      extraTriangles+=position.length/9;
      const m=material(original,id,true);
      // A malha própria não tem cor por vértice: a cor da peça entra no material.
      if(tint){m.vertexColors=false;m.color.multiply(tint);}
      const mesh=new T.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
    }

    function replaceSofa(obj,item) {
      if(!finishes.has('tecido') || !finishes.has('madeira_movel') || sofas.length) return;
      const w=item.w,h=item.h,d=item.d;
      if (![w,h,d].every(v=>Number.isFinite(v)&&v>0)) return;
      const arm=Math.min(.15,w*.09), leg=h*.14, seat=h*.36, back=d*.18;
      const parts=[], feet=[], modules=Math.max(2,Math.min(4,Math.round(w/.75)));
      const add=(size,at,radius)=>parts.push({size,at,radius});
      add([w-2*arm,h*.2,d*.91],[0,leg+h*.1,0],Math.min(.025,h*.025));
      add([w-2*arm,h*.48,back],[0,h*.76,-d/2+back/2],Math.min(.045,back*.25));
      for(const side of [-1,1]) add([arm,h*.56,d],[side*(w-arm)/2,leg+h*.28,0],Math.min(.025,arm*.2));
      const cell=(w-2*arm)/modules, gap=Math.min(.018,cell*.04);
      for(let i=0;i<modules;i++) {
        const x=-(w-2*arm)/2+cell*(i+.5);
        add([cell-gap,h*.2,d-back-.025],[x,seat+h*.1,back/2],Math.min(.038,h*.04));
        add([cell-gap,h*.32,back*.8],[x,h*.78,-d/2+back],Math.min(.035,back*.2));
      }
      for(const x of [-1,1])for(const z of [-1,1])feet.push({size:[arm*.4,leg,arm*.4],
        at:[x*(w/2-arm*.7),leg/2,z*(d/2-arm*.7)],radius:Math.min(.008,arm*.04)});
      const gr=new T.Group();gr.name='sofa-piloto';
      const cor=item.cor??base.FURN?.MOVEIS?.[item.tipo]?.cor;
      const body=merge(parts,'tecido',base.matMovel,calibration.tecido?.keepTint&&cor!=null?new T.Color(cor):null);
      gr.add(body,merge(feet,'madeira_movel',base.matMovel));
      // Dimensões nominais exatas, sem ampliar footprint nem alterar o objeto selecionável.
      gr.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(gr), size=box.getSize(new T.Vector3());
      const shift=new T.Vector3((box.min.x+box.max.x)/2,box.min.y,(box.min.z+box.max.z)/2);
      gr.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.translate(-shift.x,-shift.y,-shift.z);
        mesh.geometry.scale(w/size.x,h/size.y,d/size.z);mesh.geometry.computeBoundingSphere();}});
      const originals=obj.children.map(child=>({child,visible:child.visible}));
      obj.add(gr);sofas.push({obj,gr,originals});
    }

    function install() {
      const house=maq.planta();
      if(!house || installed===house || !settled || finishes.size===0) return false;
      installed=house;
      finishWall(house.children[0]);
      finishFloor(house.children[1],'frio',1.2);
      finishFloor(house.children[2],'madeira',2.4);
      for(const obj of house.children.slice()) {
        const item=obj.userData?.registroMovel;
        if(!obj.userData?.movel || !item)continue;
        const count=furnitureCoverage[item.tipo]??(furnitureCoverage[item.tipo]={total:0,textured:0});count.total++;
        const before=records.length+sofas.length;
        // Sofá com `estilo` já vem da biblioteca do Blender (pé, braço e encosto do
        // estilo): recebe o tecido pela máscara, como as outras peças. A troca pela
        // caixa arredondada daqui fica só para o sofá padrão.
        if(item.tipo==='sofa' && !item.estilo && finishes.has('tecido')&&finishes.has('madeira_movel')&&!sofas.length)replaceSofa(obj,item);
        else if(item.tipo==='cama')obj.traverse(mesh=>finishBed(mesh,item,obj.scale));
        else {
          const id=['armario','guardaroupa','estante','mesa','criado','ripado','rack','aereo','cadeira','pia','balcao','bancada'].includes(item.tipo)
            ?'madeira_movel':['sofa','cortina','tapete'].includes(item.tipo)?'tecido':null;
          if(id && finishes.has(id))obj.traverse(mesh=>finishFurniture(mesh,id,item,obj.scale));
        }
        if(records.length+sofas.length>before)count.textured++;
      }
      return true;
    }

    function apply() {
      for(const r of records){const use=active&&(r.kind!=='wall'||wallsEnabled),ud=r.mesh.userData;
        r.mesh.material=use?r.nextMaterial:r.originalMaterial;
        r.mesh.geometry=use?r.nextGeometry:r.originalGeometry;
        if(ud.materialVisita)ud.materialVisita=r.mesh.material;
        if(r.originalPlanta){ud.geoVisita=r.mesh.geometry;ud.geoPlanta=use?r.nextPlanta:r.originalPlanta;}}
      for(const sofa of sofas){sofa.gr.visible=active;
        for(const r of sofa.originals)r.child.visible=active?false:r.visible;}
    }
    function snapshot() {
      return {enabled:active,loadedMaterials:Array.from(finishes.keys()),loadedMaps,requestedBytes,
        changedMeshes:records.length,sofas:sofas.length,extraTriangles,failures:failures.map(f=>({...f})),
        installed:installed!==null,wallsEnabled,wallMeshes,proceduralTextures:0,
        furnitureCoverage:Object.fromEntries(Object.entries(furnitureCoverage).map(([type,value])=>[type,{...value}])),
        maskFallbacks:maskFallbacks.map(value=>({...value}))};
    }
    const api={setEnabled(value){active=Boolean(value);if(active)load();install();apply();return active;},
      setWallsEnabled(value){wallsEnabled=Boolean(value);apply();return wallsEnabled;},
      getWallTextureDownload(){if(!finishes.has('parede'))return null;const file=catalog.get('parede').maps.color.file;
        return {url:assetPath+file,filename:file};},
      get ready(){return loading || Promise.resolve(snapshot());},snapshot};
    root.__pilotoVisual=api;
    function observe(){if(install())apply();root.requestAnimationFrame(observe);}
    if(active)load(); root.requestAnimationFrame(observe);
    return api;
  }
  root.PilotoVisual={start};
})(window);
