"""So as bordas de perfil.py (degraus > limiar): python bordas.py peca eixo f1 f2 a b [limiar]"""
import subprocess, sys, re
lim = float(sys.argv[7]) if len(sys.argv) > 7 else 25
out = subprocess.run([sys.executable, "perfil.py", *sys.argv[1:7], "0.25"], capture_output=True, text=True).stdout.splitlines()
pts = [(float(m.group(1)), float(m.group(2)), m.group(3)) for m in (re.match(r"\s*(-?[\d.]+) cm\s+lum\s+([\d.]+).*(px\(.*\))", l) for l in out) if m]
res = []
for (t0, l0, p0), (t1, l1, p1) in zip(pts, pts[1:]):
    if abs(l1 - l0) > lim:
        res.append("%6.2f %s%3.0f->%3.0f %s" % ((t0 + t1) / 2, "+" if l1 > l0 else "-", l0, l1, p1))
print("\n".join(res))
