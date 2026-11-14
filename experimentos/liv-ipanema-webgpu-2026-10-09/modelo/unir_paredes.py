"""Une volumes de parede antes da exportação, conservando os materiais das faces.

Faces coplanares de caixas justapostas não podem participar duas vezes do bake.
Opera somente nos buckets recebidos; não altera o gerador canônico.
"""
import math

import bmesh
import bpy


def unite(buckets, materials, label):
    if not buckets:
        raise ValueError('Nenhum volume para unir')
    vertices, faces, assignments, names = [], [], [], list(buckets)
    for slot, name in enumerate(names):
        source_vertices, source_faces = buckets[name]
        offset = len(vertices)
        vertices.extend(source_vertices)
        faces.extend(tuple(offset+i for i in face) for face in source_faces)
        assignments.extend([slot]*len(source_faces))
    mesh = bpy.data.meshes.new('TMP-union-'+label)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for name in names:
        mesh.materials.append(materials[name])
    for face, slot in zip(mesh.polygons, assignments):
        face.material_index = slot
    obj = bpy.data.objects.new('TMP-union-'+label, mesh)
    bpy.context.scene.collection.objects.link(obj)
    try:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        result = bpy.ops.mesh.intersect_boolean(operation='UNION', use_self=True, solver='EXACT')
        if result != {'FINISHED'}:
            raise RuntimeError('A união exata das paredes falhou')
        bpy.ops.mesh.remove_doubles(threshold=1e-6)
        bpy.ops.mesh.dissolve_limited(angle_limit=1e-6, delimit={'MATERIAL', 'NORMAL'})
        bpy.ops.mesh.delete_loose(use_verts=True, use_edges=True, use_faces=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        mesh.update()
        bm = bmesh.new()
        try:
            bm.from_mesh(mesh)
            # A tesselação automática de n-gons com pontos colineares pode
            # produzir tampas de área zero. Triangula explicitamente antes de
            # separar as cores, conservando os vértices das junções.
            bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method='BEAUTY', ngon_method='EAR_CLIP')
            bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=list(bm.edges))
            bm.normal_update()
            non_manifold = sum(not edge.is_manifold for edge in bm.edges)
            volume = bm.calc_volume(signed=True)
            if non_manifold or not math.isfinite(volume) or volume <= 0:
                print('UNION_NON_MANIFOLD', [(tuple(e.verts[0].co), tuple(e.verts[1].co), len(e.link_faces))
                                             for e in bm.edges if not e.is_manifold], flush=True)
                raise RuntimeError(f'União inválida: {non_manifold} arestas não manifold, volume {volume}')
            if any(face.calc_area()<1e-10 for face in bm.faces):
                raise RuntimeError('A união contém faces de área zero')
            bm.to_mesh(mesh)
            mesh.update()
        finally:
            bm.free()
        # A separação por material acontece somente depois de eliminar as faces
        # internas. O contorno de todas as cores em conjunto permanece fechado.
        output = {name: ([], []) for name in names}
        lookups = {name: {} for name in names}
        for face in mesh.polygons:
            name = names[face.material_index]
            target_vertices, target_faces = output[name]
            lookup = lookups[name]
            mapped = []
            for index in face.vertices:
                if index not in lookup:
                    lookup[index] = len(target_vertices)
                    target_vertices.append(tuple(mesh.vertices[index].co))
                mapped.append(lookup[index])
            target_faces.append(tuple(mapped))
        if any(not group[1] for group in output.values()):
            raise RuntimeError('A união apagou um material esperado')
        report = {'solver': 'Blender EXACT self UNION', 'inputVertices': len(vertices),
                  'inputFaces': len(faces), 'outputVertices': len(mesh.vertices),
                  'outputFaces': len(mesh.polygons), 'nonManifoldEdges': non_manifold,
                  'volume': volume, 'materials': names, 'flatFacadeWithoutSubpixelBevel': True}
        buckets.clear()
        buckets.update(output)
        return report
    finally:
        if obj.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.meshes.remove(mesh)
