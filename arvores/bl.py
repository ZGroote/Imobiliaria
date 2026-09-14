# Cliente da ponte. Uso:
#   python bl.py "print(len(bpy.data.objects))"
#   python bl.py -f script.py
#   echo "codigo" | python bl.py
import json, socket, sys

if len(sys.argv) > 2 and sys.argv[1] == "-f":
    code = open(sys.argv[2], encoding="utf-8").read()
elif len(sys.argv) > 1:
    code = sys.argv[1]
else:
    code = sys.stdin.read()

s = socket.create_connection(("127.0.0.1", 9876), timeout=300)
s.sendall((json.dumps({"code": code}) + "\n").encode("utf-8"))
buf = b""
while not buf.endswith(b"\n"):
    ch = s.recv(65536)
    if not ch:
        break
    buf += ch
s.close()
r = json.loads(buf.decode("utf-8"))
if r.get("stdout"):
    sys.stdout.write(r["stdout"])
if r.get("result") is not None:
    print("=>", r["result"])
if not r.get("ok"):
    sys.stderr.write(r.get("error", "erro desconhecido"))
    sys.exit(1)
