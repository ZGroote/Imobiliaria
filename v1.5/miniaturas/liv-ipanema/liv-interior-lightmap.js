/* Transport for the actual LIV constructor interior; independent of the exterior atlas. */
(function(global){
'use strict';
async function aplicarLuzInteriorLiv(options){
  const T=options.THREE,root=options.root,proof=options.proof;
  const state={ready:false,invalidated:false,reason:null,objects:0,triangles:0};
  const originals=[],materials=new Map(),textureHashes=new Map();
  let manifest,compact,texture,slots,applied=[],snapshot=[];
  const approvedTextures=new Map();
  function meshes(){const out=[];root.traverse(o=>{if(o.isMesh)out.push(o);});return out;}
  async function sha(data){
    if(!global.crypto || !crypto.subtle)throw Error('SHA-256 unavailable for interior validation');
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),
      b=>b.toString(16).padStart(2,'0')).join('');
  }
  function canonical(value){return JSON.stringify(value).replace(/[\u007f-\uffff]/g,
    c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}
  function decode(encoded){const s=atob(encoded),bytes=new Uint8Array(s.length);
    for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);return bytes;}
  function attr(attribute){
    if(!attribute)return [];
    const out=new Float32Array(attribute.count*attribute.itemSize);
    for(let i=0;i<attribute.count;i++){
      out[i*attribute.itemSize]=attribute.getX(i);
      if(attribute.itemSize>1)out[i*attribute.itemSize+1]=attribute.getY(i);
      if(attribute.itemSize>2)out[i*attribute.itemSize+2]=attribute.getZ(i);
    }return out;
  }
  function color(mesh){return mesh.userData.livAlbedo || attr(mesh.geometry.attributes.color);}
  async function geometryHash(mesh){
    const g=mesh.geometry,a=[attr(g.attributes.position),attr(g.attributes.normal),attr(g.attributes.uv),new Float32Array(color(mesh))];
    const ix=new Uint32Array(g.index ? g.index.array : []),header=new Uint32Array([...a.map(v=>v.length),ix.length]);
    const arrays=[header,...a,ix],out=new Uint8Array(arrays.reduce((n,v)=>n+v.byteLength,0));let offset=0;
    arrays.forEach(v=>{out.set(new Uint8Array(v.buffer,v.byteOffset,v.byteLength),offset);offset+=v.byteLength;});
    return sha(out);
  }
  function same(a,b){if(Array.isArray(b))return a.length===b.length && a.every((v,i)=>Math.abs(v-b[i])<1e-6);
    return typeof b==='number' ? Math.abs(a-b)<1e-6 : a===b;}
  async function textureHash(tex){
    if(textureHashes.has(tex))return textureHashes.get(tex);
    const image=tex.image,c=document.createElement('canvas');c.width=image.width;c.height=image.height;
    const ctx=c.getContext('2d');
    if(image.data){
      const rgba=new Uint8ClampedArray(c.width*c.height*4),n=image.data.length/(c.width*c.height);
      const floating=image.data instanceof Float32Array || image.data instanceof Float64Array;
      for(let i=0;i<c.width*c.height;i++){
        for(let k=0;k<3;k++)rgba[i*4+k]=Math.round(image.data[i*n+(n===1?0:k)]*(floating?255:1));
        rgba[i*4+3]=n===4?Math.round(image.data[i*n+3]*(floating?255:1)):255;
      }ctx.putImageData(new ImageData(rgba,c.width,c.height),0,0);
    }else ctx.drawImage(image,0,0);
    const hash=await sha(decode(c.toDataURL('image/png').split(',')[1]));textureHashes.set(tex,hash);return hash;
  }
  async function approvedTexture(id,original){
    if(approvedTextures.has(id))return approvedTextures.get(id);
    const info=proof.textures[id];
    if(!info.data)throw Error('Approved interior texture bytes missing: '+id);
    const img=new Image();img.src=info.data;await img.decode();
    const tex=new T.Texture(img);
    for(const key of ['mapping','channel','magFilter','minFilter','anisotropy','format','type','generateMipmaps','premultiplyAlpha','unpackAlignment'])
      tex[key]=original[key];
    for(const key of ['wrapS','wrapT','rotation','flipY','colorSpace'])tex[key]=info[key];
    for(const key of ['repeat','offset','center'])tex[key].fromArray(info[key]);
    tex.updateMatrix();tex.needsUpdate=true;approvedTextures.set(id,tex);return tex;
  }
  async function checkMaterial(actual,expected,initializeTextures){
    const values={type:actual.type,color:actual.color?actual.color.toArray():[1,1,1],
      roughness:actual.roughness==null?1:actual.roughness,metalness:actual.metalness||0,
      vertexColors:!!actual.vertexColors,opacity:actual.opacity==null?1:actual.opacity,
      transparent:!!actual.transparent,alphaTest:actual.alphaTest||0,side:actual.side,
      emissive:actual.emissive?actual.emissive.toArray():[0,0,0],emissiveIntensity:actual.emissiveIntensity||0,
      normalScale:actual.normalScale?actual.normalScale.toArray():[1,1],bumpScale:actual.bumpScale||0,
      normalMapType:actual.normalMapType||0};
    for(const key of Object.keys(values))if(!same(values[key],expected[key]))throw Error('Interior material changed: '+key);
    for(const key of ['map','normalMap','roughnessMap','metalnessMap','bumpMap','emissiveMap']){
      const tex=actual[key],id=expected[key];
      if(!id){if(tex)throw Error('Unexpected interior texture: '+key);continue;}
      if(!tex)throw Error('Missing interior texture: '+key);
      const original=proof.textures[id];
      for(const field of ['repeat','offset','center'])if(!same(tex[field].toArray(),original[field]))throw Error('Interior texture transform changed');
      for(const field of ['rotation','wrapS','wrapT','flipY','colorSpace'])if(!same(tex[field],original[field]))throw Error('Interior texture property changed');
      if(await textureHash(tex)!==original.pngSHA256){
        if(!initializeTextures)throw Error('Interior texture PNG changed: '+id+' '+key);
        const frozen=await approvedTexture(id,tex);
        if(await textureHash(frozen)!==original.pngSHA256)throw Error('Approved interior PNG failed round-trip: '+id);
        actual[key]=frozen;actual.needsUpdate=true;state.approvedTexturesFrozen=true;
      }
    }
  }
  async function validateScene(initializeTextures){
    textureHashes.clear();root.updateWorldMatrix(true,true);slots=meshes();
    if(slots.length!==proof.meshSlots)throw Error('Interior mesh identity changed');
    const geometryChecks=new Map(),materialChecks=new Map();
    for(const expected of proof.objects){
      const mesh=slots[expected.slot];
      if(!mesh || expected.instance!==null || mesh.isInstancedMesh)throw Error('Interior mesh/instance changed');
      if(!same(mesh.matrixWorld.toArray(),expected.matrix))throw Error('Interior object transform changed: '+expected.slot);
      if(!geometryChecks.has(mesh))geometryChecks.set(mesh,geometryHash(mesh));
      if(await geometryChecks.get(mesh)!==expected.geometrySHA256)throw Error('Interior geometry/albedo changed: '+expected.slot);
      const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(list.length!==expected.materials.length)throw Error('Interior material count changed');
      for(let i=0;i<list.length;i++){
        const key=expected.materials[i],checkKey=list[i].uuid+'|'+key;
        if(!materialChecks.has(checkKey))materialChecks.set(checkKey,checkMaterial(list[i],proof.materials[key],initializeTextures));
        await materialChecks.get(checkKey);
      }
    }
    state.layoutVerified=true;state.materialsVerified=true;state.sourceGeometryVerified=true;
  }
  function bakedMaterial(original){
    if(materials.has(original))return materials.get(original);
    const m=original.clone(),baseCompile=original.onBeforeCompile;
    m.lightMap=texture;m.lightMapIntensity=manifest.lightMapIntensity;m.userData.livInteriorTransport=true;
    m.onBeforeCompile=function(shader,renderer){
      if(baseCompile)baseCompile.call(this,shader,renderer);
      let maps=T.ShaderChunk.lights_fragment_maps;
      const term='lightMapTexel.rgb * lightMapIntensity';
      if(!maps.includes(term))throw Error('Three lightmap shader changed');
      maps=maps.replace(term,'(lightMapTexel.rgb * lightMapTexel.a * '+Number(manifest.range).toFixed(8)+') * lightMapIntensity')
        .replace('irradiance += lightMapIrradiance;','irradiance = lightMapIrradiance;')
        .replace('iblIrradiance += getIBLIrradiance( geometryNormal );','');
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',maps)
        .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directDiffuse = vec3(0.0);');
    };
    m.customProgramCacheKey=()=> 'liv-interior-rgbm-'+manifest.sourceSHA256;
    m.needsUpdate=true;materials.set(original,m);return m;
  }
  function signature(m){
    const props=[m.uuid,m.type,m.color?m.color.toArray():null,m.emissive?m.emissive.toArray():null,
      m.emissiveIntensity,m.roughness,m.metalness,m.opacity,m.transparent,m.vertexColors,m.side,m.normalScale?m.normalScale.toArray():null,m.bumpScale];
    for(const key of ['map','normalMap','roughnessMap','metalnessMap','bumpMap','emissiveMap','lightMap']){
      const t=m[key];props.push(t?[t.uuid,t.version,t.repeat.toArray(),t.offset.toArray(),t.rotation,t.wrapS,t.wrapT,t.flipY,t.colorSpace]:null);
    }return JSON.stringify(props);
  }
  function remember(){
    snapshot=slots.map(mesh=>({mesh,geometry:mesh.geometry,matrix:mesh.matrixWorld.toArray(),
      attributes:Object.values(mesh.geometry.attributes).map(a=>[a,a.version]),
      materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(signature)}));
  }
  function install(){
    const prepared=[];
    for(const record of compact.objects){
      const mesh=slots[record.slot],source=mesh.geometry;
      const authority=proof.objects.find(o=>o.slot===record.slot && o.instance===record.instance);
      if(!authority || authority.geometrySHA256!==record.sourceGeometrySHA256)
        throw Error('Prepared interior source fingerprint mismatch');
      if(record.instance!==null || record.sourceVertexCount!==source.attributes.position.count)
        throw Error('Interior corner source mismatch');
      const ib=decode(record.indicesU32),ub=decode(record.uv1U16),iv=new DataView(ib.buffer),uvv=new DataView(ub.buffer);
      const count=ib.byteLength/4;
      if(count%3 || ub.byteLength!==count*4)throw Error('Interior UV1 corner count mismatch');
      const g=new T.BufferGeometry(),albedo=color(mesh);
      for(const name of ['position','normal','uv','color']){
        const original=source.attributes[name];if(!original && name!=='color')continue;
        if(name==='color' && !albedo.length)continue;
        const size=name==='uv'?2:3,values=new Float32Array(count*size),input=name==='color'?albedo:attr(original);
        for(let i=0;i<count;i++){
          const index=iv.getUint32(i*4,true);if(index>=record.sourceVertexCount)throw Error('Interior index outside source');
          for(let k=0;k<size;k++)values[i*size+k]=input[index*size+k];
        }g.setAttribute(name,new T.BufferAttribute(values,size));
      }
      const uv1=new Float32Array(count*2);
      for(let i=0;i<count*2;i++)uv1[i]=uvv.getUint16(i*2,true)/compact.uvScale;
      g.setAttribute('uv1',new T.BufferAttribute(uv1,2));
      (record.groups||[]).forEach(group=>g.addGroup(group.start,group.count,group.materialIndex));
      g.computeBoundingBox();g.computeBoundingSphere();
      const mat=Array.isArray(mesh.material)?mesh.material.map(bakedMaterial):bakedMaterial(mesh.material);
      prepared.push({mesh,geometry:g,material:mat,originalGeometry:mesh.geometry,originalMaterial:mesh.material});
    }
    // Validation and allocation finish before any scene mutation.
    originals.length=0;applied=prepared;
    for(const item of prepared){originals.push(item);item.mesh.geometry=item.geometry;item.mesh.material=item.material;}
    root.updateWorldMatrix(true,true);remember();state.objects=prepared.length;
    state.triangles=prepared.reduce((n,v)=>n+v.geometry.attributes.position.count/3,0);
    state.ready=true;state.invalidated=false;state.reason=null;
    if(options.onReady)options.onReady(state,manifest);
  }
  state.invalidate=function(reason){
    if(!state.ready)return;
    for(const item of originals){
      // Preserve an editor's replacement geometry/material while removing atlas bindings.
      if(item.mesh.geometry===item.geometry)item.mesh.geometry=item.originalGeometry;
      if(item.mesh.material===item.material){
        const current=Array.isArray(item.material)?item.material:[item.material];
        const original=Array.isArray(item.originalMaterial)?item.originalMaterial:[item.originalMaterial];
        current.forEach((m,i)=>{
          // A mudança de acabamento feita no material assado pertence ao usuário.
          // Retira apenas o transporte e conserva esses parâmetros no fallback.
          const target=original[i];
          for(const key of ['color','emissive','normalScale'])if(m[key] && target[key])target[key].copy(m[key]);
          for(const key of ['roughness','metalness','opacity','transparent','alphaTest','side','bumpScale','emissiveIntensity',
            'map','normalMap','roughnessMap','metalnessMap','bumpMap','emissiveMap'])target[key]=m[key];
          target.needsUpdate=true;
        });
        item.mesh.material=item.originalMaterial;
      }
      item.geometry.dispose();
    }
    materials.forEach(m=>m.dispose());materials.clear();applied=[];
    state.ready=false;state.invalidated=true;state.layoutVerified=false;state.reason=reason||'Interior changed';
    if(options.onInvalidate)options.onInvalidate(state);
  };
  state.check=function(){
    if(!state.ready)return false;
    root.updateWorldMatrix(true,true);const current=meshes();
    if(current.length!==snapshot.length){state.invalidate('Furniture/mesh identity changed');return false;}
    const materialSignatures=new Map();
    for(let i=0;i<snapshot.length;i++){
      const s=snapshot[i],m=current[i];
      if(m!==s.mesh || m.geometry!==s.geometry || !same(m.matrixWorld.toArray(),s.matrix)){
        state.invalidate('Furniture position, rotation or geometry changed');return false;}
      if(s.attributes.some(v=>v[0].version!==v[1])){state.invalidate('Interior vertex data changed');return false;}
      const list=Array.isArray(m.material)?m.material:[m.material];
      if(list.length!==s.materials.length || list.some((a,j)=>{
        if(!materialSignatures.has(a))materialSignatures.set(a,signature(a));
        return materialSignatures.get(a)!==s.materials[j];})){
        state.invalidate('Interior finish or light state changed');return false;}
    }return true;
  };
  state.restore=async function(){
    if(state.ready)return true;
    await validateScene();install();return true;
  };
  try{
    manifest=await options.loadJSON('interior/luz/manifest.json');
    if(manifest.schema!=='liv-interior-lightmap-v1' || !manifest.ready || !manifest.geometryApproved
      || manifest.colorPass!==false || manifest.textureEncoding!=='linear-rgbm-u8')throw Error('Interior atlas is not approved/ready');
    if(!proof || proof.unitSHA256!==options.unitHash || manifest.unitSHA256!==options.unitHash
      || proof.sourceSHA256!==manifest.sourceSHA256 || proof.approvalSHA256!==manifest.approvalSHA256)
      throw Error('Interior scene/unit/approval SHA256 mismatch');
    const loaded=await Promise.all([options.loadJSON(manifest.geometryURL),options.loadBytes(manifest.textureURL)]);
    compact=loaded[0];const bytes=loaded[1];
    if(compact.schema!=='liv-interior-corners-v1' || compact.unitSHA256!==options.unitHash
      || compact.sourceSHA256!==manifest.sourceSHA256)throw Error('Interior compact scene mismatch');
    if(bytes.byteLength!==manifest.width*manifest.height*4)throw Error('Interior RGBM byte count mismatch');
    const hashes=await Promise.all([sha(new TextEncoder().encode(canonical(compact))),sha(bytes)]);
    if(hashes[0]!==manifest.geometrySHA256 || hashes[1]!==manifest.textureSHA256)throw Error('Interior compact/atlas SHA256 mismatch');
    state.geometryHashVerified=true;state.textureHashVerified=true;
    state.unitSHA256=manifest.unitSHA256;state.sourceSHA256=manifest.sourceSHA256;state.textureSHA256=manifest.textureSHA256;
    await validateScene(true);
    texture=new T.DataTexture(bytes,manifest.width,manifest.height,T.RGBAFormat,T.UnsignedByteType);
    texture.colorSpace=T.NoColorSpace;texture.channel=1;texture.flipY=false;texture.premultiplyAlpha=false;
    texture.generateMipmaps=false;texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
    state.texture=texture;state.manifest=manifest;install();return state;
  }catch(error){state.error=String(error);state.reason=state.error;
    if(options.onError)options.onError(error,state);return state;}
}
global.aplicarLuzInteriorLiv=aplicarLuzInteriorLiv;
})(globalThis);
