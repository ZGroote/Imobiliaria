import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\respawn\Desktop\imobiliaria\experimentos\cama-box-referencia\cena.blend")
o = bpy.data.objects["tufos"]; me = o.data
print("DBG attrs", [(a.name, a.domain, a.data_type) for a in me.attributes], flush=True)
a = me.attributes["tufo"]; v = np.empty(len(a.data), np.float32); a.data.foreach_get("value", v)
print("DBG tufo min %.3f max %.3f mean %.3f" % (v.min(), v.max(), v.mean()), flush=True)
z = np.empty(len(me.vertices)*3, np.float32); me.vertices.foreach_get("co", z); z = z.reshape(-1,3)[:,2]
print("DBG z min %.4f max %.4f" % (z.min(), z.max()), flush=True)
m = o.material_slots[0].material
print("DBG mat", m.name, [n.type for n in m.node_tree.nodes], flush=True)
print("DBG links to base:", [(l.from_node.type, l.from_socket.name) for l in m.node_tree.links if l.to_socket.name == "Base Color"], flush=True)
pt = bpy.data.objects["pillowtop"]; zz=[ (pt.matrix_world @ v.co).z for v in pt.data.vertices]; print("DBG pillowtop zmax %.4f" % max(zz), flush=True)
