# Ponte Claude <-> Blender.
# Abra no Text Editor do Blender (aba Scripting) e aperte Run Script (Alt+P).
# Sobe um servidor TCP em 127.0.0.1:9876 que executa codigo Python na thread principal.
# Rodar de novo derruba o servidor anterior e sobe um novo.

import bpy, socket, threading, queue, json, io, traceback, contextlib

HOST, PORT = "127.0.0.1", 9876
NS = bpy.app.driver_namespace
JOBS = queue.Queue()


def _stop_previous():
    old = NS.get("_claude_bridge")
    if not old:
        return
    old["running"] = False
    try:
        old["sock"].close()
    except Exception:
        pass
    try:
        if bpy.app.timers.is_registered(old["timer"]):
            bpy.app.timers.unregister(old["timer"])
    except Exception:
        pass
    print("[bridge] servidor anterior derrubado")


def _pump():
    # roda na thread principal: unico lugar seguro pra tocar em bpy
    while True:
        try:
            job = JOBS.get_nowait()
        except queue.Empty:
            break
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                env = {"bpy": bpy, "__name__": "__claude__"}
                exec(job["code"], env)
                res = env.get("result", None)
            job["out"] = {"ok": True, "stdout": buf.getvalue(), "result": repr(res) if res is not None else None}
        except Exception:
            job["out"] = {"ok": False, "stdout": buf.getvalue(), "error": traceback.format_exc()}
        job["done"].set()
    return 0.05


def _serve(sock, state):
    while state["running"]:
        try:
            conn, _ = sock.accept()
        except OSError:
            break
        try:
            conn.settimeout(300)
            data = b""
            while not data.endswith(b"\n"):
                chunk = conn.recv(65536)
                if not chunk:
                    break
                data += chunk
            req = json.loads(data.decode("utf-8"))
            job = {"code": req["code"], "done": threading.Event(), "out": None}
            JOBS.put(job)
            if job["done"].wait(timeout=290):
                out = job["out"]
            else:
                out = {"ok": False, "error": "timeout esperando a thread principal do Blender"}
            conn.sendall((json.dumps(out) + "\n").encode("utf-8"))
        except Exception:
            try:
                conn.sendall((json.dumps({"ok": False, "error": traceback.format_exc()}) + "\n").encode("utf-8"))
            except Exception:
                pass
        finally:
            try:
                conn.close()
            except Exception:
                pass
    print("[bridge] servidor encerrado")


def start():
    _stop_previous()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((HOST, PORT))
    sock.listen(4)
    state = {"running": True, "sock": sock, "timer": _pump}
    NS["_claude_bridge"] = state
    threading.Thread(target=_serve, args=(sock, state), daemon=True).start()
    bpy.app.timers.register(_pump, persistent=True)
    print("[bridge] ouvindo em %s:%d - blend: %s" % (HOST, PORT, bpy.data.filepath or "(nao salvo)"))


start()
