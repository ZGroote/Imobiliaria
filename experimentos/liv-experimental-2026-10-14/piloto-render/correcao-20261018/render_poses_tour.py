"""Renderiza um modelo do nerfstudio nas poses do Tour (as do remontar_vistas.py), para comparar com a verdade.
/root/ns/bin/python render_poses_tour.py <config.yml> <pasta-saida>
Olho a 1,62 m, vertical 48°, 480x270, XY do Blender (o dataset foi treinado sem reescala nem recentragem)."""
import math, sys
from pathlib import Path
import numpy as np, torch
from PIL import Image
from nerfstudio.cameras.cameras import Cameras, CameraType
from nerfstudio.utils.eval_utils import eval_setup

VISTAS = [("sala", -1.475, -0.75, 0), ("suite", 2.425, -0.6, 180), ("corr-0.425", 0.425, -0.9, 270),
          ("corr-1.375", 1.375, -0.6, 90), ("banho-social", 1.075, -1.85, 270), ("varanda", -2.275, 1.95, 270)]
W, H = 480, 270; F = (H / 2) / math.tan(math.radians(24))
_, pipeline, _, step = eval_setup(Path(sys.argv[1]), test_mode="inference")
saida = Path(sys.argv[2]); saida.mkdir(parents=True, exist_ok=True)
for nome, x, y, g in VISTAS:
    t = math.radians(g); f = np.array([math.cos(t), math.sin(t), 0.0])
    r = np.array([math.sin(t), -math.cos(t), 0.0]); u = np.array([0.0, 0.0, 1.0])
    c2w = np.stack([r, u, -f, [x, y, 1.62]], 1)          # OpenGL: x direita, y cima, olha para -z
    cam = Cameras(camera_to_worlds=torch.tensor(c2w[None], dtype=torch.float32), fx=F, fy=F, cx=W / 2, cy=H / 2,
                  width=W, height=H, camera_type=CameraType.PERSPECTIVE).to(pipeline.device)
    with torch.no_grad():
        rgb = pipeline.model.get_outputs_for_camera(cam)["rgb"]
    Image.fromarray((rgb.clamp(0, 1).cpu().numpy() * 255).astype(np.uint8)).save(saida / f"{nome}.png")
    print("POSE", nome, flush=True)
print("etapa", step)
