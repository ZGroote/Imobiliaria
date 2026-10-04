/* Piloto isolado: materiais CC0 sobre a mesma arquitetura, sem alterar o gerador. */
(function (root) {
  'use strict';

  // Mesmos pixels no browser e no PNG estático do build, sem DOM, Three ou rede.
  function paintPixels() {
    const {imul,sin,floor,tanh,round,min,max,PI}=Math;
    const width=256,height=256,bump=new Uint8Array(width*height*4);
    const roughness=new Uint8Array(bump.length),color=new Uint8Array(bump.length);
    let seed=0x51A3D1;
    const random=()=>{seed=(imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const gridSize=64,field=new Float32Array(gridSize*gridSize);
    for(let i=0;i<field.length;i++)field[i]=random()*2-1;
    const smooth=t=>t*t*(3-2*t);
    for(let y=0;y<height;y++) {
      const gy=y*gridSize/height,y0=floor(gy),fy=smooth(gy-y0);
      const row0=y0*gridSize,row1=((y0+1)%gridSize)*gridSize;
      const rollerPhase=.6*sin(2*PI*y/height*3);
      for(let x=0;x<width;x++) {
        // Grão fino + casca de laranja de rolo (~6,25 mm), sem manchas grandes.
        // O campo periódico interpolado continua legível nos mipmaps a 1–3 m;
        // somente ruído por pixel desaparecia e deixava B mais liso que A.
        const gx=x*gridSize/width,x0=floor(gx),x1=(x0+1)%gridSize,fx=smooth(gx-x0);
        const a=field[row0+x0]*(1-fx)+field[row0+x1]*fx;
        const b=field[row1+x0]*(1-fx)+field[row1+x1]*fx;
        const broad=a*(1-fy)+b*fy,grain=10*(random()+random()-1);
        const roller=sin(2*PI*x/width*11+rollerPhase);
        const relief=round(128+44*broad+grain+roller*1.4);
        const rugosity=round(230+broad*5+grain*.25+roller*.6);
        // Pigmento quase branco em faixa de 4%: relevo sozinho fica invisível
        // neste ambiente difuso. O mesmo grão pequeno dá legibilidade sem sujeira.
        const pigment=max(242,min(252,round(247+5*tanh(broad*2.2)+grain*.1)));
        const i=(y*width+x)*4;
        for(let k=0;k<3;k++){bump[i+k]=relief;roughness[i+k]=rugosity;color[i+k]=pigment;}
        bump[i+3]=roughness[i+3]=color[i+3]=255;
      }
    }
    return {width,height,bump,roughness,color};
  }

  function start({THREE:T, maq, base, assets, assetPath, enabled=true}) {
    if (!T || !maq || !base?.MAT || !Array.isArray(assets)) throw new Error('Ponte do piloto ausente');
    const catalog=new Map(), records=[], sofas=[], failures=[], finishes=new Map();
    let active=Boolean(enabled), wallsEnabled=true, loading=null, settled=false, installed=null, extraTriangles=0;
    let paint=null, wallMeshes=0;
    let requestedBytes=0, loadedMaps=0;
    for (const item of assets) {
      if (!['madeira','tecido','frio'].includes(item.id) || catalog.has(item.id) ||
          !(item.tileMeters>0 && Number.isFinite(item.tileMeters))) throw new Error('Manifesto de materiais inválido');
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
    if (catalog.size!==3 || requestedBytes>1500000 || typeof assetPath!=='string' ||
        !/^(?:\.\/)?[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/$/.test(assetPath))
      throw new Error('Manifesto ou diretório do piloto inválido');

    const loader=new T.TextureLoader();
    const anisotropy=Math.min(4,maq.ren?.capabilities?.getMaxAnisotropy?.() || 1);
    function texture(map, kind) {
      return new Promise((resolve,reject)=>loader.load(assetPath+map.file,tex=>{
        tex.colorSpace=kind==='color'?T.SRGBColorSpace:T.NoColorSpace;
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

    function material(original,id) {
      const m=original.clone(), maps=finishes.get(id);
      Object.assign(m,maps);
      m.name='piloto-'+id;
      m.envMap=original.envMap || base.ambientePBR || null;
      m.normalScale.setScalar(id==='tecido'?.28:.42);
      m.bumpMap=null; m.bumpScale=0;
      m.metalness=0; m.roughness=id==='frio'?.65:.9;
      m.needsUpdate=true;
      return m;
    }

    function uvProjected(geo, tile, scale) {
      const g=geo.index?geo.toNonIndexed():geo.clone();
      const p=g.attributes.position,n=g.attributes.normal, uvs=new Float32Array(p.count*2);
      const s=scale || {x:1,y:1,z:1};
      for (let i=0;i<p.count;i+=3) {
        const nx=Math.abs(n.getX(i)+n.getX(i+1)+n.getX(i+2));
        const ny=Math.abs(n.getY(i)+n.getY(i+1)+n.getY(i+2));
        const nz=Math.abs(n.getZ(i)+n.getZ(i+1)+n.getZ(i+2));
        for (let j=i;j<i+3;j++) {
          const x=p.getX(j)*s.x, y=p.getY(j)*s.y, z=p.getZ(j)*s.z;
          uvs[j*2]=(nx>=ny && nx>=nz?z:x)/tile;
          uvs[j*2+1]=(ny>=nx && ny>=nz?z:y)/tile;
        }
      }
      g.setAttribute('uv',new T.BufferAttribute(uvs,2));
      return g;
    }

    function paintMaps() {
      if(paint)return paint;
      const pixels=paintPixels();
      const bumpCanvas=root.document.createElement('canvas'),roughCanvas=root.document.createElement('canvas');
      const colorCanvas=root.document.createElement('canvas');
      for(const canvas of [bumpCanvas,roughCanvas,colorCanvas]){canvas.width=pixels.width;canvas.height=pixels.height;}
      const bumpContext=bumpCanvas.getContext('2d'),roughContext=roughCanvas.getContext('2d'),colorContext=colorCanvas.getContext('2d');
      if(!bumpContext||!roughContext||!colorContext)throw new Error('Não foi possível preparar a textura de pintura');
      for(const [context,name] of [[bumpContext,'bump'],[roughContext,'roughness'],[colorContext,'color']]) {
        const image=context.createImageData(pixels.width,pixels.height);image.data.set(pixels[name]);
        context.putImageData(image,0,0);
      }
      const configure=(canvas,name,colorSpace=T.NoColorSpace)=>{const texture=new T.CanvasTexture(canvas);texture.name=name;
        texture.colorSpace=colorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
        texture.anisotropy=anisotropy;return texture;};
      paint={bump:configure(bumpCanvas,'pintura-rolo-relevo'),roughness:configure(roughCanvas,'pintura-rolo-rugosidade'),
        color:configure(colorCanvas,'pintura-rolo-pigmento',T.SRGBColorSpace)};
      return paint;
    }

    function finishWall(mesh) {
      if(!mesh?.isMesh||Array.isArray(mesh.material)||!mesh.geometry.attributes.normal)return;
      try {
        const maps=paintMaps(),g=mesh.geometry.clone(),p=g.attributes.position,n=g.attributes.normal;
        const uv=new Float32Array(p.count*2),tile=.4;
        // Mantém index/posição/normais e uv1. A tangente à normal horizontal dá
        // metros de parede também quando a casa está girada no referencial global.
        for(let i=0;i<p.count;i++) {
          const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=n.getX(i),nz=n.getZ(i),length=Math.hypot(nx,nz);
          uv[i*2]=(length>.5?(-nz*x+nx*z)/length:x)/tile;
          uv[i*2+1]=(length>.5?y:z)/tile;
        }
        g.setAttribute('uv',new T.BufferAttribute(uv,2));
        if(mesh.geometry.attributes.color)g.setAttribute('color',mesh.geometry.attributes.color);
        const m=mesh.material.clone();m.name='piloto-pintura';
        // Three prioriza normalMap sobre bumpMap. A mantém o normal original;
        // B usa microrelevo + pigmento quase branco, preservando cor/lightMap do material.
        m.normalMap=null;m.bumpMap=maps.bump;m.bumpScale=.0055;
        m.map=maps.color;
        m.roughnessMap=maps.roughness;m.roughness=.98;
        m.onBeforeCompile=mesh.material.onBeforeCompile;
        m.customProgramCacheKey=mesh.material.customProgramCacheKey;m.needsUpdate=true;
        records.push({mesh,kind:'wall',originalMaterial:mesh.material,originalGeometry:mesh.geometry,
          nextMaterial:m,nextGeometry:g});wallMeshes++;
      }catch(error){failures.push({material:'pintura',message:error.message});}
    }

    function finishFloor(mesh,id,oldTile) {
      if (!mesh?.isMesh || !mesh.geometry.attributes.uv || !finishes.has(id)) return;
      const g=mesh.geometry.clone(), uv=g.attributes.uv, ratio=oldTile/catalog.get(id).tileMeters;
      // O bake progressivo pode continuar depois do download. Compartilhar somente
      // a cor mantém a mesma iluminação em A e B; a UV de repetição continua isolada.
      if(mesh.geometry.attributes.color)g.setAttribute('color',mesh.geometry.attributes.color);
      for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*ratio,uv.getY(i)*ratio);
      uv.needsUpdate=true;
      records.push({mesh,originalMaterial:mesh.material,originalGeometry:mesh.geometry,
        nextMaterial:material(mesh.material,id),nextGeometry:g});
    }

    function finishFurniture(mesh,id,item,scale) {
      if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.geometry.attributes.color) return;
      const g=uvProjected(mesh.geometry,catalog.get(id).tileMeters,scale), c=g.attributes.color;
      const tint=new T.Color(item.cor ?? 0x8A7660), next=material(mesh.material,id);
      // Somente faces que herdam a cor do cadastro recebem o acabamento. Ferragens,
      // pés e peças de cor fixa preservam o material original; não viram madeira.
      const triangles=[[],[]];
      g.clearGroups();
      const matches=i=>Math.abs(c.getX(i)-tint.r)<.009 && Math.abs(c.getY(i)-tint.g)<.009 && Math.abs(c.getZ(i)-tint.b)<.009;
      for(let i=0;i<c.count;i+=3) {
        const slot=matches(i)&&matches(i+1)&&matches(i+2)?0:1;
        triangles[slot].push(i);
      }
      if(!triangles[0].length){g.dispose();next.dispose();return;}
      groupTriangles(g,triangles);
      records.push({mesh,originalMaterial:mesh.material,originalGeometry:mesh.geometry,
        nextMaterial:[next,mesh.material],nextGeometry:g});
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
      if(!mesh.isMesh || Array.isArray(mesh.material) || !mesh.geometry.attributes.color) return;
      if(!finishes.has('tecido')&&!finishes.has('madeira'))return;
      const clothTile=catalog.get('tecido').tileMeters, woodTile=catalog.get('madeira').tileMeters;
      const g=uvProjected(mesh.geometry,clothTile,scale),p=g.attributes.position,c=g.attributes.color;
      const tint=new T.Color(item.cor ?? 0x8A7660),groups=[[],[],[]];
      g.computeBoundingBox();const box=g.boundingBox;
      // Contrato da cama atual (moveis.py): ROUPA fixa no colchão/travesseiros;
      // cor herdada no box, cabeceira e edredom. Este último fica acima do colchão
      // e à frente da cabeceira. Pés de cor fixa mantêm o material original.
      const white=[242/255,239/255,232/255];
      const inherited=i=>Math.abs(c.getX(i)-tint.r)<.009&&Math.abs(c.getY(i)-tint.g)<.009&&Math.abs(c.getZ(i)-tint.b)<.009;
      const linen=i=>Math.abs(c.getX(i)-white[0])<.009&&Math.abs(c.getY(i)-white[1])<.009&&Math.abs(c.getZ(i)-white[2])<.009;
      for(let i=0;i<p.count;i+=3) {
        const same=[i,i+1,i+2].every(inherited), roupa=[i,i+1,i+2].every(linen);
        const y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
        const duvet=same && y>box.min.y+(box.max.y-box.min.y)*.43 && z>box.min.z+(box.max.z-box.min.z)*.22;
        let slot=roupa||duvet?0:same?1:2;
        if(slot===0&&!finishes.has('tecido')||slot===1&&!finishes.has('madeira'))slot=2;
        groups[slot].push(i);
        if(slot===1)for(let j=i;j<i+3;j++) {
          const uv=g.attributes.uv;uv.setXY(j,uv.getX(j)*clothTile/woodTile,uv.getY(j)*clothTile/woodTile);
        }
      }
      if(!groups[0].length&&!groups[1].length){g.dispose();return;}
      groupTriangles(g,groups);
      records.push({mesh,originalMaterial:mesh.material,originalGeometry:mesh.geometry,
        nextMaterial:[finishes.has('tecido')?material(mesh.material,'tecido'):mesh.material,
          finishes.has('madeira')?material(mesh.material,'madeira'):mesh.material,mesh.material],nextGeometry:g});
    }

    function roundedBox(w,h,d,r) {
      const shape=new T.Shape(), x=w/2-r, y=h/2-r;
      shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth:Math.max(.001,d-2*r),bevelEnabled:true,
        bevelThickness:r,bevelSize:r,bevelSegments:3,steps:1,curveSegments:1});
      g.translate(0,0,-(d-2*r)/2); return g;
    }

    function merge(parts,id,original) {
      const position=[],normal=[],uv=[];
      for(const part of parts) {
        const source=roundedBox(...part.size,part.radius), g=uvProjected(source,catalog.get(id).tileMeters);
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
      const m=material(original,id);m.vertexColors=false;
      const mesh=new T.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
    }

    function replaceSofa(obj,item) {
      if(!finishes.has('tecido') || !finishes.has('madeira') || sofas.length) return;
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
      const body=merge(parts,'tecido',base.matMovel);
      body.material.color.setHex(item.cor ?? 0x4A5A6B);
      gr.add(body,merge(feet,'madeira',base.matMovel));
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
        if(item.tipo==='sofa' && finishes.has('tecido')&&finishes.has('madeira')&&!sofas.length) {
          replaceSofa(obj,item);continue;
        }
        if(item.tipo==='cama'){obj.traverse(mesh=>finishBed(mesh,item,obj.scale));continue;}
        const id=['armario','guardaroupa','estante','mesa','criado','ripado','rack','aereo'].includes(item.tipo)
          ?'madeira':['sofa','cortina','tapete'].includes(item.tipo)?'tecido':null;
        if(id && finishes.has(id))obj.traverse(mesh=>finishFurniture(mesh,id,item,obj.scale));
      }
      return true;
    }

    function apply() {
      for(const r of records){const use=active&&(r.kind!=='wall'||wallsEnabled);
        r.mesh.material=use?r.nextMaterial:r.originalMaterial;
        r.mesh.geometry=use?r.nextGeometry:r.originalGeometry;}
      for(const sofa of sofas){sofa.gr.visible=active;
        for(const r of sofa.originals)r.child.visible=active?false:r.visible;}
    }
    function snapshot() {
      return {enabled:active,loadedMaterials:Array.from(finishes.keys()),loadedMaps,requestedBytes,
        changedMeshes:records.length,sofas:sofas.length,extraTriangles,failures:failures.map(f=>({...f})),
        installed:installed!==null,wallsEnabled,wallMeshes,proceduralTextures:paint?3:0};
    }
    const api={setEnabled(value){active=Boolean(value);if(active)load();install();apply();return active;},
      setWallsEnabled(value){wallsEnabled=Boolean(value);apply();return wallsEnabled;},
      getWallTextureDownload(){if(!paint)return null;return {url:paint.bump.image.toDataURL('image/png'),filename:'pintura-rolo-relevo.png'};},
      get ready(){return loading || Promise.resolve(snapshot());},snapshot};
    root.__pilotoVisual=api;
    function observe(){if(install())apply();root.requestAnimationFrame(observe);}
    if(active)load(); root.requestAnimationFrame(observe);
    return api;
  }
  root.PilotoVisual={start,paintPixels};
})(window);
