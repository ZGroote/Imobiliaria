"""Exporta a cena efetiva da base preservada, incluindo UV do bake, sem serializar o atlas."""
import argparse
import base64
import gzip
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
LIV = ROOT / 'v1.5' / 'miniaturas' / 'liv-ipanema'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
BASELINE_HASH = '31ffb45398aed3ad49b289600823232e37f668086ebfea458b96ecd2e1b9d018'

EXPORT = r"""() => {
  const m=window.__maq, geometries=[], materials=[], textures=[], meshes=[];
  const geometryIds=new Map(), materialIds=new Map(), textureIds=new Map();
  function encoded(array) {
    const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
    let result='';
    for(let i=0;i<bytes.length;i+=32768) result+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return {type:array.constructor.name,base64:btoa(result),length:array.length};
  }
  function attribute(a) {
    if(a.isInterleavedBufferAttribute) {
      const values=new a.data.array.constructor(a.count*a.itemSize);
      for(let i=0;i<a.count;i++) for(let c=0;c<a.itemSize;c++) values[i*a.itemSize+c]=a.data.array[i*a.data.stride+a.offset+c];
      return {...encoded(values),itemSize:a.itemSize,normalized:a.normalized};
    }
    return {...encoded(a.array),itemSize:a.itemSize,normalized:a.normalized};
  }
  function geometry(g) {
    if(geometryIds.has(g)) return geometryIds.get(g);
    const id=geometries.length; geometryIds.set(g,id);
    geometries.push({attributes:Object.fromEntries(Object.entries(g.attributes).map(([n,a])=>[n,attribute(a)])),
      index:g.index?attribute(g.index):null,groups:g.groups,drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:null}});
    return id;
  }
  function texture(t) {
    if(!t) return null;
    if(textureIds.has(t)) return textureIds.get(t);
    if(t===window.__livLightmap.texture) throw Error('Atlas deve ser copiado como gzip separado.');
    const id=textures.length; textureIds.set(t,id);
    const image=t.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');
    if(image.data) ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),0,0);
    else ctx.drawImage(image,0,0);
    textures.push({png:canvas.toDataURL('image/png').split(',')[1],width:image.width,height:image.height,
      colorSpace:t.colorSpace,flipY:t.flipY,premultiplyAlpha:t.premultiplyAlpha,channel:t.channel,
      wrapS:t.wrapS,wrapT:t.wrapT,minFilter:t.minFilter,magFilter:t.magFilter,generateMipmaps:t.generateMipmaps,
      repeat:t.repeat.toArray(),offset:t.offset.toArray(),center:t.center.toArray(),rotation:t.rotation,anisotropy:t.anisotropy});
    return id;
  }
  function material(mat) {
    if(materialIds.has(mat)) return materialIds.get(mat);
    const id=materials.length;materialIds.set(mat,id);
    const item={name:mat.name,type:mat.type,baked:!!mat.userData.livBakedTransport,
      color:mat.color?.toArray(),emissive:mat.emissive?.toArray(),normalScale:mat.normalScale?.toArray()};
    for(const key of ['roughness','metalness','opacity','transparent','side','depthWrite','depthTest','alphaTest','vertexColors','emissiveIntensity','envMapIntensity','bumpScale','flatShading','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','blending','visible','toneMapped']) if(mat[key]!==undefined) item[key]=mat[key];
    for(const key of ['map','bumpMap','normalMap','roughnessMap','metalnessMap','alphaMap','aoMap','emissiveMap']) if(mat[key]) item[key]=texture(mat[key]);
    materials.push(item);return id;
  }
  m.cena.updateMatrixWorld(true);
  const visibleBounds=new THREE.Box3();
  m.predio.children.forEach(o=>{if(o.visible && o.isMesh) visibleBounds.expandByObject(o);});
  m.predio.traverse(o=>{
    if(!o.isMesh) return;
    let visible=true;for(let p=o;p;p=p.parent) if(!p.visible) visible=false;
    if(!visible) return;
    meshes.push({name:o.name,geometry:geometry(o.geometry),material:Array.isArray(o.material)?o.material.map(material):material(o.material),
      matrix:o.matrixWorld.toArray(),castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder,
      userData:o.userData,instances:o.isInstancedMesh?{count:o.count,matrix:attribute(o.instanceMatrix),color:o.instanceColor?attribute(o.instanceColor):null}:null});
  });
  const lights=[];
  m.cena.traverse(o=>{if(o.isLight) lights.push({type:o.type,color:o.color.toArray(),groundColor:o.groundColor?.toArray(),intensity:o.intensity,
    position:o.position.toArray(),target:o.target?.position.toArray(),castShadow:o.castShadow,
    shadow:o.shadow?{bias:o.shadow.bias,normalBias:o.shadow.normalBias,mapSize:o.shadow.mapSize.toArray(),
      camera:{left:o.shadow.camera.left,right:o.shadow.camera.right,top:o.shadow.camera.top,bottom:o.shadow.camera.bottom,near:o.shadow.camera.near,far:o.shadow.camera.far}}:null});});
  return {schema:'liv-exterior-proof-v1',sourceModelSHA256:window.__livLightmap.sourceSHA256,originalRuntime:THREE.REVISION,
    geometries,materials,textures,meshes,lights,visibleBounds:{min:visibleBounds.min.toArray(),max:visibleBounds.max.toArray()},
    camera:{type:m.cam.type,fov:m.cam.fov,near:m.cam.near,far:m.cam.far,zoom:m.cam.zoom,
      left:m.cam.left,right:m.cam.right,top:m.cam.top,bottom:m.cam.bottom,aspect:m.cam.aspect,
      position:m.cam.position.toArray(),target:m.alvo.toArray(),up:m.cam.up.toArray(),quaternion:m.cam.quaternion.toArray()},
    canvasBounds:JSON.parse(JSON.stringify(m.ren.domElement.getBoundingClientRect())),
    renderer:{exposure:m.ren.toneMappingExposure,toneMapping:m.ren.toneMapping,pixelRatio:m.ren.getPixelRatio()},
    bake:{ready:window.__livLightmap.ready,textureHashVerified:window.__livLightmap.textureHashVerified,geometryHashVerified:window.__livLightmap.geometryHashVerified},
    orbit:{...m.orb}};
}"""


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/site-baseline')
    parser.add_argument('--saida', type=Path, default=EXP / 'assets-prova')
    args = parser.parse_args()
    html = EXP / 'site-baseline' / 'maquete-liv-ipanema.html'
    if sha(html.read_bytes()) != BASELINE_HASH:
        raise RuntimeError('A fonte local não corresponde à base fixada.')
    manifest = json.loads((LIV / 'luz' / 'manifest.json').read_text(encoding='utf-8'))
    atlas = (LIV / manifest['textureURL']).read_bytes()
    if sha(gzip.decompress(atlas)) != manifest['textureSHA256']:
        raise RuntimeError('Atlas RGBM corrompido.')
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, headless=True, args=['--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width':1440,'height':900}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        source_url = args.base_url.rstrip('/') + '/maquete-liv-ipanema.html'
        http_identity = {}
        def verified_html(route):
            # Intercept before rendering: Chrome's inspector can evict this 38 MB body.
            # Fulfill with the exact bytes fetched and verified, avoiding a second-fetch race.
            response = route.fetch(timeout=120000)
            body = response.body()
            http_identity.update(status=response.status, sha256=sha(body))
            route.fulfill(response=response, body=body)
        page.route(source_url, verified_html)
        page.goto(source_url, wait_until='load', timeout=120000)
        if http_identity.get('status') != 200 or http_identity.get('sha256') != BASELINE_HASH:
            raise RuntimeError('A página HTTP carregada não corresponde ao HTML da base fixada.')
        page.wait_for_function('window.__maq && window.__livLightmap?.ready', timeout=120000)
        page.locator('#c').scroll_into_view_if_needed()
        page.locator('[data-vista="perspectiva"]').click()
        page.wait_for_timeout(300)
        data = page.evaluate(EXPORT)
        data['views'] = {}
        for view in ['perspectiva','fachada','aerea','portaria','implantacao']:
            page.locator(f'[data-vista="{view}"]').click()
            page.wait_for_timeout(120)
            data['views'][view] = page.evaluate('''() => {
              const c=__maq.cam;
              return {type:c.type,fov:c.fov,near:c.near,far:c.far,zoom:c.zoom,left:c.left,right:c.right,
                top:c.top,bottom:c.bottom,aspect:c.aspect,position:c.position.toArray(),target:__maq.alvo.toArray(),
                up:c.up.toArray(),quaternion:c.quaternion.toArray(),orbit:{...__maq.orb}};
            }''')
        browser.close()
    if errors or not all(data['bake'].values()):
        raise RuntimeError(f'Base inválida durante extração: {errors}; {data["bake"]}')
    if data['sourceModelSHA256'] != manifest['sourceSHA256']:
        raise RuntimeError('Geometria e atlas pertencem a versões diferentes.')
    args.saida.mkdir(parents=True, exist_ok=True)
    for i, texture in enumerate(data['textures']):
        name = f'texture-{i:02d}.png'
        (args.saida / name).write_bytes(base64.b64decode(texture.pop('png')))
        texture['url'] = name
    atlas_name = 'irradiance.rgbm.gz'
    (args.saida / atlas_name).write_bytes(atlas)
    manifest['textureURL'] = atlas_name
    data['rgbm'] = manifest
    encoded = json.dumps(data,ensure_ascii=True,separators=(',',':')).encode()
    scene = gzip.compress(encoded, compresslevel=6, mtime=0)
    (args.saida / 'scene.json.gz').write_bytes(scene)
    records = {p.name:{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
               for p in args.saida.iterdir() if p.is_file() and p.name != 'manifest.json'}
    summary = {'schema':'liv-proof-manifest-v1','exportedAtUtc':datetime.now(timezone.utc).isoformat(),
               'baselineHTMLSHA256':BASELINE_HASH,'httpHTMLSHA256':BASELINE_HASH,'sourceURL':source_url,
               'sourceModelSHA256':data['sourceModelSHA256'],
               'sceneJSONSHA256':sha(encoded),'files':records,'meshCount':len(data['meshes']),
               'bakedMeshes':sum(bool(data['materials'][m['material']]['baked']) for m in data['meshes'] if isinstance(m['material'],int)),
               'exportPurpose':'Transporte exato da geometria da base; não comprova paridade do renderer.'}
    (args.saida / 'manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
