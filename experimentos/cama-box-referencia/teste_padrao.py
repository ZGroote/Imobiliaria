# teste minimo: o mapa de altura chega na imagem e o Mix pega o soquete certo?
import bpy, sys, numpy as np
sys.argv = [sys.argv[0]]
src = open(r"C:\Users\respawn\Desktop\imobiliaria\experimentos\cama-box-referencia\cena.py", encoding="utf-8").read()
src = src.split("# ---------------------------------------------------------------- a cama")[0]
exec(compile(src, "cena_parte", "exec"))
for im in bpy.data.images:
    a = np.empty(len(im.pixels), np.float32); im.pixels.foreach_get(a)
    print("IMG", im.name, tuple(im.size), "mean %.3f std %.3f" % (a.mean(), a.std()), flush=True)
m = bpy.data.materials["base"]
mix = next(n for n in m.node_tree.nodes if n.type == "MIX")
print("MIX links:", [(l.from_socket.name, l.from_socket.type, "->", l.to_socket.name, l.to_socket.type, l.to_socket.identifier) for l in m.node_tree.links if l.to_node == mix or l.from_node == mix], flush=True)
