"""Congela a cena do interior (os 5 dormitórios) para gravar a luz por hora no Cycles.

Mesmo caminho do LIV (exportar_bake_meio.py + os arquivos de fontes/luz-horario/): o navegador monta a planta
pelas fábricas nativas e o exporter-native.js grava a cena. Saem, por planta, em interiores/luz/<planta>/:
  source.json      cena com os móveis do CADASTRO (catálogo de melhorias vazio na rota): é a fonte congelada
                   do site; o site troca esses móveis pelos aprovados ao abrir, como no LIV;
  moveis-site.glb  os móveis aprovados na posição final, só para fazer sombra no bake (cor média do map);
  moveis-site.json quais móveis do cadastro o site troca (o bake esconde esses);
  portas-web.json  dobradiça e giro da porta de entrada (o bake grava fechada, como o site mostra);
  plafons-web.json os plafons de cada cômodo (a chave da noite).
Precisa do servidor na raiz do repositório (python -m http.server 8765).
python experimentos/containers-mooca-2026-11-05/interiores/luz/exportar_fonte.py [individual individual-pne casal quadruplo casal-bebe refeitorio convivencia]
"""
import base64
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
URL = 'http://localhost:8765/experimentos/containers-mooca-2026-11-05/site/'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PRONTO = '()=>{if(__livInterior?.error)throw Error(__livInterior.error);return __livInterior?.ready;}'

# Fonte congelada: a cena de autoria (antes do corte de apresentação), com os móveis do cadastro.
FONTE = '''async tip=>{
  const api=__livInterior, THREE=await import('three/webgpu');
  const {createLayout}=await import('./interior-navigation.js');
  const unitText=await (await fetch('./interiores/'+tip+'/unidade.json')).text(), unit=JSON.parse(unitText), layout=createLayout(unit);
  const catalog=await (await fetch('./interiores/catalogo.json')).json();
  await api.renderer.setAnimationLoop(null);
  await import('./exporter-native.js');
  const root=api.authoringScene;
  if(!root)throw Error('Cena de autoria ausente.');
  root.traverse(mesh=>{if(mesh.name==='forro-original')mesh.visible=false;});
  guardarAlbedoInteriorLiv(root);
  const slots=[];root.traverse(mesh=>{if(mesh.isMesh)slots.push(mesh.userData.furnitureId||null);});
  const data=await exportarCenaInteriorLiv({THREE,root,unitId:unit.id,unitHash:catalog.tipologias[tip].unitSHA256,
    height:layout.pd,mode:'planta3d',rooms:layout.rooms.map(r=>({name:r.name,x:r.cx,z:r.cz}))});
  // Móvel não entra no atlas: lê as sondas, como no site (o atlas fica só para a casca).
  for(const object of data.objects){object.furnitureId=slots[object.slot];if(object.furnitureId){object.kind='furniture';object.bake=false;}}
  // Alumínio (maçanetas, puxadores) também fica fora, como no LIV: a maçaneta de fora da entrada via o vazio da cena (17x).
  for(const object of data.objects)if(object.materials.every(id=>id==='m4'))object.bake=false;
  const furnitureSlots=api.getState().furniture.map((item,index)=>({id:item.id,index,
    slots:data.objects.filter(o=>o.furnitureId===item.id).map(o=>o.slot)}));
  if(furnitureSlots.some(m=>!m.slots.length))throw Error('Móvel do cadastro sem geometria exportada.');
  data.metadata.furnitureSlots=furnitureSlots;data.metadata.bakeObjects=data.objects.filter(o=>o.bake).length;
  data.metadata.cornice=api.getState().cornice;
  // Porta de entrada: a folha e a maçaneta saem da malha da esquadria; o grupo fica na dobradiça.
  const entrance=api.getState().doors.doors.find(d=>d.entrance);
  let door=null;api.scene.traverse(o=>{if(o.userData.livDoor===entrance?.id)door=o;});
  if(!door)throw Error('Porta de entrada não separada.');
  const hinge=door.getWorldPosition(new THREE.Vector3()),q=door.getWorldQuaternion(new THREE.Quaternion());
  const portas=[{id:entrance.id,entrance:true,hinge:[hinge.x,hinge.z],closedRotation:new THREE.Euler().setFromQuaternion(q,'YXZ').y}];
  const plafons=[];api.scene.traverse(o=>{if(o.isSpotLight&&o.name.startsWith('Luz do plafon')){
    const p=o.getWorldPosition(new THREE.Vector3()),t=o.target.getWorldPosition(new THREE.Vector3());
    plafons.push({name:o.name,position:p.toArray(),target:t.toArray(),angle:o.angle,penumbra:o.penumbra,distance:o.distance,decay:o.decay,
      dayIntensity:o.userData.livDayIntensity,color:o.color.toArray()});}});
  if(!plafons.length)throw Error('Sem plafons na cena.');
  return {data,portas,plafons};
}'''

# Móveis aprovados como sombra: GLB com a cor média de cada map (8x8), sem texturas.
MOVEIS = '''async tip=>{
  const api=__livInterior, THREE=await import('three/webgpu');
  const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  await api.renderer.setAnimationLoop(null);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=8;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const mean=texture=>{
    const image=texture?.image;if(!image)return null;
    try{ctx.clearRect(0,0,8,8);ctx.drawImage(image,0,0,8,8);}catch{return null;}
    const px=ctx.getImageData(0,0,8,8).data;let r=0,g=0,b=0;for(let i=0;i<px.length;i+=4){r+=px[i];g+=px[i+1];b+=px[i+2];}
    return new THREE.Color().setRGB(r/64/255,g/64/255,b/64/255,THREE.SRGBColorSpace);
  };
  const cache=new Map(),flat=material=>{
    if(!cache.has(material)){
      const color=(material.color?.clone()||new THREE.Color(1,1,1)),m=mean(material.map);if(m)color.multiply(m);
      cache.set(material,new THREE.MeshStandardMaterial({name:material.name,color,roughness:material.roughness??.8,metalness:material.metalness??0,
        transparent:!!material.transparent,opacity:material.opacity??1}));
    }
    return cache.get(material);
  };
  const out=new THREE.Scene(),replaced=[];api.scene.updateMatrixWorld(true);
  for(const item of api.getState().furniture){
    if(!item.improvementAsset)continue;replaced.push(item.id);
    let group=null;api.scene.traverse(o=>{if(!group&&o.userData.livImprovementAsset&&o.userData.furnitureId===item.id)group=o;});
    if(!group)throw Error('Móvel aprovado fora da cena: '+item.id);
    group.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.visible)return;
      const list=[mesh.material].flat().map(flat),copy=new THREE.Mesh(mesh.geometry,list.length===1?list[0]:list);
      copy.name=item.id+' · '+(mesh.name||'malha');mesh.matrixWorld.decompose(copy.position,copy.quaternion,copy.scale);out.add(copy);
    });
  }
  const glb=await new GLTFExporter().parseAsync(out,{binary:true});
  let text='';const bytes=new Uint8Array(glb);for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return {glb:btoa(text),replaced,meshes:out.children.length};
}'''


def abrir(browser, tip, sem_melhorias):
    context = browser.new_context(viewport={'width': 1200, 'height': 900})

    def nativo(route):
        # Depois de congelada a planta abre pela fonte; a exportação sempre remonta pelas fábricas (a receita fica no catálogo).
        catalog = json.loads(route.fetch().text())
        record = catalog['tipologias'][tip]
        record.update(geometryKind='native-factories', lighting='dynamic', sourceSHA256=record['files']['recipe']['sha256'])
        route.fulfill(json=catalog)
    context.route('**/interiores/catalogo.json', nativo)
    if sem_melhorias:
        def vazio(route):
            catalog = json.loads(route.fetch().text())
            catalog['assets'] = []
            route.fulfill(json=catalog)
        context.route('**/melhorias/catalogo.json', vazio)
    page = context.new_page()
    erros = []
    page.on('pageerror', lambda e: erros.append(str(e)))
    page.goto(URL + f'interior.html?tipologia={tip}&modo=planta3d&backend=webgl', timeout=120000)
    page.wait_for_function(PRONTO, timeout=180000)
    return context, page, erros


def main():
    tips = sys.argv[1:] or ['individual', 'individual-pne', 'casal', 'quadruplo', 'casal-bebe', 'refeitorio', 'convivencia']
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, headless=True)
        for tip in tips:
            pasta = AQUI / tip
            pasta.mkdir(parents=True, exist_ok=True)
            context, page, erros = abrir(browser, tip, True)
            fonte = page.evaluate(FONTE, tip)
            if erros:
                raise SystemExit(f'{tip}: {erros}')
            context.close()
            raw = (json.dumps(fonte['data'], ensure_ascii=False, separators=(',', ':')) + '\n').encode()
            (pasta / 'source.json').write_bytes(raw)
            (pasta / 'portas-web.json').write_text(json.dumps(fonte['portas']), encoding='utf8')
            (pasta / 'plafons-web.json').write_text(json.dumps(fonte['plafons'], indent=1), encoding='utf8')
            context, page, erros = abrir(browser, tip, False)
            moveis = page.evaluate(MOVEIS, tip)
            if erros:
                raise SystemExit(f'{tip}: {erros}')
            context.close()
            (pasta / 'moveis-site.glb').write_bytes(base64.b64decode(moveis['glb']))
            (pasta / 'moveis-site.json').write_text(json.dumps({'typology': tip, 'replaced': moveis['replaced']}), encoding='utf8')
            objs = fonte['data']['objects']
            print(tip, 'objetos', len(objs), 'alvos', sum(o['bake'] for o in objs), 'instanciados', sum(o['instance'] is not None for o in objs),
                  'MB', round(len(raw) / 2**20, 1), 'trocados', len(moveis['replaced']), 'malhas aprovadas', moveis['meshes'],
                  'plafons', len(fonte['plafons']), 'porta', fonte['portas'][0], flush=True)
        browser.close()


if __name__ == '__main__':
    main()
