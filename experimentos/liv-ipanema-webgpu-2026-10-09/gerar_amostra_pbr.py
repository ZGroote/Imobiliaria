"""Gera uma amostra própria e determinística de GLB/GLTF para validar PBR padrão.

Não representa acabamento, geometria ou medidas do LIV. Sem assets de terceiros.
"""
import hashlib
import io
import json
import math
import struct
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent / 'assets-materiais'


def generate():
    OUT.mkdir(exist_ok=True)
    binary = bytearray()
    views, accessors = [], []

    def attribute(values, components, kind='f', target=34962):
        while len(binary) % 4:
            binary.append(0)
        packed = struct.pack('<' + kind * len(values), *values)
        view = len(views)
        views.append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(packed), 'target': target})
        binary.extend(packed)
        rows = [values[i:i+components] for i in range(0, len(values), components)]
        accessor = {'bufferView': view, 'componentType': 5126 if kind == 'f' else 5123,
                    'count': len(rows), 'type': {1: 'SCALAR', 2: 'VEC2', 3: 'VEC3'}[components]}
        if components == 3 and kind == 'f':
            accessor['min'] = [min(r[i] for r in rows) for i in range(3)]
            accessor['max'] = [max(r[i] for r in rows) for i in range(3)]
        accessors.append(accessor)
        return len(accessors)-1

    positions, normals, uvs, indices = [], [], [], []
    segments, rings = 40, 24
    for row in range(rings+1):
        phi = row/rings*math.pi
        for col in range(segments+1):
            theta = col/segments*math.tau
            point = [math.sin(phi)*math.cos(theta), math.cos(phi), math.sin(phi)*math.sin(theta)]
            positions.extend(point)
            normals.extend(point)
            uvs.extend([col/segments, 1-row/rings])
    for row in range(rings):
        for col in range(segments):
            a = row*(segments+1)+col
            b = a+segments+1
            indices.extend([a, a+1, b, b, a+1, b+1])
    sphere = {'attributes': {'POSITION': attribute(positions, 3), 'NORMAL': attribute(normals, 3),
                             'TEXCOORD_0': attribute(uvs, 2)}, 'indices': attribute(indices, 1, 'H', 34963)}

    # Cube, with independent vertices/UVs per face and outward winding.
    positions, normals, uvs, indices = [], [], [], []
    for normal, u, v in [([1,0,0],[0,0,-1],[0,1,0]), ([-1,0,0],[0,0,1],[0,1,0]),
                          ([0,1,0],[1,0,0],[0,0,-1]), ([0,-1,0],[1,0,0],[0,0,1]),
                          ([0,0,1],[1,0,0],[0,1,0]), ([0,0,-1],[-1,0,0],[0,1,0])]:
        start = len(positions)//3
        for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]:
            positions.extend([.5*(normal[i]+x*u[i]+y*v[i]) for i in range(3)])
            normals.extend(normal)
            uvs.extend([(x+1)/2,(y+1)/2])
        indices.extend([start,start+1,start+2,start,start+2,start+3])
    cube = {'attributes': {'POSITION': attribute(positions,3), 'NORMAL': attribute(normals,3),
                           'TEXCOORD_0': attribute(uvs,2)}, 'indices': attribute(indices,1,'H',34963)}

    def png(data):
        image = Image.new('RGB',(32,32))
        image.putdata(data)
        out = io.BytesIO()
        image.save(out,format='PNG')
        return out.getvalue()

    albedo = png([(174+((x*7+y*11)%19),164+((x*7+y*11)%19),146+((x*7+y*11)%19))
                  for y in range(32) for x in range(32)])
    roughness = png([(0,180+((x*11+y*7)%35),0) for y in range(32) for x in range(32)])
    materials = [
        {'name':'Mineral fosco', 'pbrMetallicRoughness': {'baseColorTexture':{'index':0},
          'metallicRoughnessTexture':{'index':1},'metallicFactor':0,'roughnessFactor':.9}},
        {'name':'Pintura acetinada', 'pbrMetallicRoughness':{'baseColorFactor':[.13,.34,.24,1],
          'metallicFactor':0,'roughnessFactor':.48}},
        {'name':'Metal escovado', 'pbrMetallicRoughness':{'baseColorFactor':[.53,.62,.68,1],
          'metallicFactor':1,'roughnessFactor':.28}},
        {'name':'Superfície com verniz', 'pbrMetallicRoughness':{'baseColorFactor':[.36,.09,.05,1],
          'metallicFactor':0,'roughnessFactor':.36},'extensions':{
          'KHR_materials_clearcoat':{'clearcoatFactor':1,'clearcoatRoughnessFactor':.08}}},
        {'name':'Vidro com volume', 'pbrMetallicRoughness':{'baseColorFactor':[.9,.98,.96,1],
          'metallicFactor':0,'roughnessFactor':.06},'extensions':{
          'KHR_materials_transmission':{'transmissionFactor':.92},
          'KHR_materials_volume':{'thicknessFactor':.7,'attenuationColor':[.5,.9,.72],'attenuationDistance':2},
          'KHR_materials_ior':{'ior':1.45}}},
        {'name':'Base técnica', 'pbrMetallicRoughness':{'baseColorFactor':[.035,.05,.067,1],
          'metallicFactor':.15,'roughnessFactor':.6}},
    ]
    meshes = [{'name':m['name'], 'primitives':[dict(sphere, material=i)]} for i,m in enumerate(materials[:5])]
    meshes.append({'name':'Base técnica', 'primitives':[dict(cube,material=5)]})
    nodes = []
    for i in range(5):
        x=(i-2)*2.55
        nodes.extend([{'name':materials[i]['name'],'mesh':i,'translation':[x,1.55,0]},
                      {'name':f'Pedestal {i+1}','mesh':5,'translation':[x,.25,0],'scale':[2.1,.5,2.1]}])
    doc = {'asset':{'version':'2.0','generator':'LIV PBR fixture — amostra própria, sem referência arquitetônica'},
           'extensionsUsed':['KHR_materials_clearcoat','KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior'],
           'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}], 'nodes':nodes,'meshes':meshes,
           'materials':materials,'buffers':[{'byteLength':len(binary),'uri':'amostra.bin'}],
           'bufferViews':views,'accessors':accessors,'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],
           'textures':[{'sampler':0,'source':0},{'sampler':0,'source':1}],
           'images':[{'uri':'cor.png'},{'uri':'rugosidade.png'}]}
    files = {'amostra.gltf':json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode(),
             'amostra.bin':bytes(binary),'cor.png':albedo,'rugosidade.png':roughness}
    glbdoc = json.loads(json.dumps(doc))
    del glbdoc['buffers'][0]['uri']
    glbbin = bytearray(binary)
    for i,data in enumerate([albedo,roughness]):
        while len(glbbin)%4:glbbin.append(0)
        glbdoc['images'][i]={'bufferView':len(glbdoc['bufferViews']),'mimeType':'image/png'}
        glbdoc['bufferViews'].append({'buffer':0,'byteOffset':len(glbbin),'byteLength':len(data)})
        glbbin.extend(data)
    glbdoc['buffers'][0]['byteLength']=len(glbbin)
    while len(glbbin)%4:glbbin.append(0)
    jsonbytes=json.dumps(glbdoc,ensure_ascii=False,separators=(',',':')).encode()
    jsonbytes+=b' '*((-len(jsonbytes))%4)
    files['amostra.glb']=(struct.pack('<III',0x46546c67,2,28+len(jsonbytes)+len(glbbin))+
                          struct.pack('<II',len(jsonbytes),0x4e4f534a)+jsonbytes+
                          struct.pack('<II',len(glbbin),0x004e4942)+glbbin)
    for name,data in files.items():(OUT/name).write_bytes(data)
    manifest={'schema':'liv-pbr-fixture-v1','source':'geometria/texturas próprias geradas por gerar_amostra_pbr.py',
              'architecturalReference':False,'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
                                                      for name,data in files.items()}}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'files':len(files),'bytes':sum(map(len,files.values())),'output':str(OUT)}))


if __name__=='__main__':generate()
