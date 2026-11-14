"""Ganchos locais e verificáveis para o snapshot regional do LIV.

O helper limite-circular.js deve executar antes do app. Não altera o renderer
compartilhado: cada trecho exige exatamente uma correspondência no snapshot.
"""
import json
import math


def aplicar(app, centro, raio=5000):
    if len(centro) != 2 or not all(math.isfinite(v) for v in centro) or not math.isfinite(raio) or raio <= .01:
        raise ValueError('Centro/raio inválido')
    if '__livStrictMap' in app:
        raise ValueError('Os ganchos regionais já foram aplicados')
    app = app.replace('\r\n', '\n')
    hooks = {}

    def troca(nome, antes, depois):
        nonlocal app
        count = app.count(antes)
        if count != 1:
            raise ValueError(f'Gancho regional {nome}: esperado 1, encontrado {count}')
        app = app.replace(antes, depois, 1)
        hooks[nome] = count

    troca('relevo_inicial', 'let elevGrid = null, reliefAmount = 0, reliefTarget = 0;',
          'let elevGrid = null, reliefAmount = 1, reliefTarget = 1;')
    troca('uniform_relevo', 'const uRelief = { value: 0 }, uHeight = { value: 1 };',
          'const uRelief = { value: 1 }, uHeight = { value: 1 };')
    troca('relevo_fixo', 'const toggle = (id, fn) => { const b = $(id);',
          'const toggle = (id, fn) => { const b = $(id);\n'
          '  if(id==="tRelief"){b.setAttribute("aria-pressed","true");return;}')
    troca('sem_inspecao', 'function cliqueNaCidade(e) {',
          'function cliqueNaCidade(e) {\n  return; // Este mapa apresenta somente o entorno.')
    troca('sem_interior', 'function enterInterior(rec, unidade) {',
          'function enterInterior(rec, unidade) {\n  return; // A maquete fica integrada ao mapa.')
    troca('chao_circular', '(function buildTerrenoBase(){',
          '(function buildTerrenoBase(){\n'
          '  LivCircularGround.build({THREE,scene,center:'+json.dumps(centro)+',radius:'+str(raio)+','
          'sampleHeight:terrainY,sampleNDVI:ndviBruto,elevation:elevGrid,n:ELEV_N,half:ELEV_HALF,'
          'subdivisions:TERRENO_SUB,exaggeration:TERRAIN_EXAG,registry:terrainRegistry,'
          'registerTerrain,noiseGLSL:()=>GLSL_RUIDO});return; // Só o círculo regional é construído.')
    troca('ignorar_city_query', 'if (embutida && !new URLSearchParams(location.search).get("city")) {',
          'if (embutida) {')
    troca('bloquear_city_fallback', 'async function fetchCity(url) {',
          'async function fetchCity(url) {\n  throw new Error("Pacote regional: base municipal indisponível");')
    troca('bloquear_elevacao_fallback', 'async function fetchElevation(onProgress) {',
          'async function fetchElevation(onProgress) {\n  throw new Error("Pacote regional: relevo embutido indisponível");')
    troca('triangulos_mundo', 'function registerTerrain(geo) {',
          'function registerTerrain(geo) {\n  LivCircle.clipGeometry(THREE,geo);')
    troca('marcar_verde', 'const meshOf = P => {\n  const g = new THREE.BufferGeometry();',
          'const meshOf = P => {\n  const g = new THREE.BufferGeometry();\n  g.userData.regionalTriangles=true;')
    troca('linhas_ruas', 'function buildStreetContext(R) {',
          'function buildStreetContext(R) {\n  // Segmentos recebem corte próprio; não são triângulos.')
    # Somente esta sequência corresponde ao contexto global das vias.
    troca('cortar_linhas_ruas',
          'g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));\n  registerTerrain(g);',
          'g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));\n'
          '  LivCircle.clipLines(THREE,g);\n  registerTerrain(g);')
    troca('quintais', 'TerrainFit.refine(THREE,g,terrain);',
          'LivCircle.clipGeometry(THREE,g,true);\n      TerrainFit.refine(THREE,g,terrain);')
    troca('tiles_enfileirados',
          "const k=tx+'_'+tz;if(!tileKeys.has(k)||Math.hypot((tx+.5)*size-x,(tz+.5)*size-z)>range+size*.71)continue;needed.add(k);",
          "const k=tx+'_'+tz;if(!tileKeys.has(k)||!LivCircle.tileIntersects(k,size)||Math.hypot((tx+.5)*size-x,(tz+.5)*size-z)>range+size*.71)continue;needed.add(k);")
    troca('tiles_fetch',
          'const {k,item}=fetchQueue.shift();if(tiles.get(k)!==item)continue;activeRequests++;',
          'const {k,item}=fetchQueue.shift();if(tiles.get(k)!==item||!LivCircle.tileIntersects(k,tileInfo.size))continue;activeRequests++;')
    troca('instancias_exteriores',
          'function add(i,x,z,theta,sx,base,relief,slopeX=0,slopeZ=0,sz=1){\n      i=assets[i].shared??i;',
          'function add(i,x,z,theta,sx,base,relief,slopeX=0,slopeZ=0,sz=1){\n'
          '      i=assets[i].shared??i;\n'
          '      if(!LivCircle.containsBounds(LivCircle.assetBounds(assets[i],pack.quantization),x,z,theta,sx,sz))return false;')
    troca('retorno_instancia', 'counts.triangles+=assets[i].triangles;\n    }',
          'counts.triangles+=assets[i].triangles;return true;\n    }')
    troca('muro_espessura', 'if(roadHit(corners))continue;',
          'if(!LivCircle.containsRing(corners)||roadHit(corners))continue;')
    troca('muro_substituicao_completa',
          'const ai=((Math.imul(w.seed+1,2654435761)>>>0)%25),a=pack.assets[ai],theta=Math.atan2(-dz,dx),sx=len/n/a.size[0];',
          'const ai=((Math.imul(w.seed+1,2654435761)>>>0)%25),a=pack.assets[ai],theta=Math.atan2(-dz,dx),sx=len/n/a.size[0];\n'
          '          let fits=true;for(let j=0;j<n;j++){const t=(j+.5)/n;\n'
          '            if(!LivCircle.containsBounds(LivCircle.assetBounds(a,pack.quantization),w.ax+dx*t,w.az+dz*t,theta,sx,1)){fits=false;break;}}\n'
          '          if(!fits)continue;')
    troca('sprite_quintal',
          'scratch.position.set(px,terrain(px,pz)*relief+.055,pz);scratch.rotation.set(0,theta,0);scratch.scale.set(span*pp[j+4]/1e6,1,span*pp[j+5]/1e6);scratch.updateMatrix();',
          'if(!LivCircle.containsBounds([-.5,-.5,.5,.5],px,pz,theta,span*pp[j+4]/1e6,span*pp[j+5]/1e6))continue;\n'
          '              scratch.position.set(px,terrain(px,pz)*relief+.055,pz);scratch.rotation.set(0,theta,0);scratch.scale.set(span*pp[j+4]/1e6,1,span*pp[j+5]/1e6);scratch.updateMatrix();')
    troca('modelos_urbanos',
          'if (chosen && roadSafety?.hit(chosen.corners)) { rest.push(b); continue; }',
          'if(chosen&&(!LivCircle.containsRing(chosen.corners)||!LivCircle.containsBounds(LivCircle.assetBounds(chosen.asset,100),chosen.x,chosen.z,chosen.theta,chosen.scale,chosen.scale))){rest.push(b);continue;}\n'
          '    if (chosen && roadSafety?.hit(chosen.corners)) { rest.push(b); continue; }')
    troca('beiral',
          'if (pitched && roadSafety && !explicitBuilding(b) && roadSafety.hit(roofFootprint(ob,ov))) {',
          'if (pitched && ((!LivCircle.containsRing(roofFootprint(ob,ov))) || (roadSafety && !explicitBuilding(b) && roadSafety.hit(roofFootprint(ob,ov))))) {')
    troca('telhado_retangular', 'if (roadSafety.hit(roofFootprint(ob,0))) {',
          'if (!LivCircle.containsRing(roofFootprint(ob,0)) || (roadSafety && roadSafety.hit(roofFootprint(ob,0)))) {')
    troca('limites_especies', 'cat.push({ nome, pos, nrm, col, verts: n, alt: e.alt_m });',
          'cat.push({ nome, pos, nrm, col, verts: n, alt: e.alt_m, circleBounds:LivCircle.boundsFromPositions(pos) });')
    troca('plantio',
          'plant.push({ x, z, rua, sp, rot: j*6.283,\n                 s: esc * (1 - varia + sorte()*varia*2), tint: 0.90 + sorte()*0.22 });',
          'const p={ x, z, rua, sp, rot: j*6.283,\n                  s: esc * (1 - varia + sorte()*varia*2), tint: 0.90 + sorte()*0.22 };\n'
          '    if(LivCircle.containsBounds(ARV.cat[sp].circleBounds,x,z,p.rot,p.s,p.s))plant.push(p);')
    troca('portoes', 'if (dx*dx + dz*dz > R2) continue;\n    lista[PORT.tipo[i]].push(i);',
          'if (dx*dx + dz*dz > R2 || !LivCircle.containsBounds([-.5,-.05,.5,.895],PORT.x[i],PORT.z[i],-PORT.ang[i],PORT.larg[i],1)) continue;\n'
          '    lista[PORT.tipo[i]].push(i);')
    troca('contador_sombras', 'for (let i = 0; i < n; i++) {\n    const S = buf[i], k = pos[i];',
          'let circleShadowCount=0;\n  for (let i = 0; i < n; i++) {\n    const S = buf[i], k = pos[i];')
    troca('limite_sombras', 'somMesh.setMatrixAt(i, m);',
          'if(LivCircle.containsBounds([-.5,-.5,.5,.5],v.x,v.z,e.y,sc.x,sc.z))somMesh.setMatrixAt(circleShadowCount++,m);')
    troca('quantidade_sombras', 'somMesh.count = n;', 'somMesh.count = circleShadowCount;')
    troca('setas', 'function buildFacingArrows(B) {',
          'function buildFacingArrows(B) {\n  B=B.filter(b=>LivCircle.containsRing(b.r,4));')
    troca('poi_envelopes', 'for (const p of POIS) {\n    if (!byCat.has(p.c))',
          'for (const p of POIS) {\n    if(!LivCircle.containsPoint(p.x,p.z,Math.SQRT2*POI_HALO))continue;\n    if (!byCat.has(p.c))')
    troca('sem_cursor_quadrante', 'mark.position.x = t.x; mark.position.z = t.z; mark.visible = true;',
          'mark.position.x = t.x; mark.position.z = t.z; mark.visible = false;')
    troca('retirar_quadrante_da_cena', 'mark.position.y = 0.45; mark.visible = false; scene.add(mark);',
          'mark.position.y = 0.45; mark.visible = false; // Cursor de quadrante removido da cena regional.')
    header = ('LivCircle.init(' + json.dumps(list(centro)) + ',' + json.dumps(raio) + ');\n'
              'window.__livStrictMap=' + json.dumps({'center':list(centro),'radius':raio,'hooks':hooks},separators=(',',':')) + ';\n')
    return header + app
