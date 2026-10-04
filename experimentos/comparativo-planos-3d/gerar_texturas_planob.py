"""
Script para geração de texturas PBR fotográficas de alta resolução (1024x1024)
para o PLANO B (ArchViz / Alta Fidelidade).
Gera mapas de Albedo, Normal, Roughness para piso de madeira nobre,
mármore Calacatta, tecido de linho premium, tapete contemporâneo e HDRI de estúdio.
"""

import os
import math
import numpy as np
from PIL import Image, ImageFilter

OUT_DIR = os.path.join("publicacao", "m1-1a", "lote-10-casas", "casa-10", "maquete", "assets_planob")
os.makedirs(OUT_DIR, exist_ok=True)

def normal_from_height(height_map, strength=2.5):
    """Calcula normal map tangent-space a partir de um height map (0 a 1)."""
    h, w = height_map.shape
    # Gradientes
    gx = np.zeros_like(height_map)
    gy = np.zeros_like(height_map)
    gx[:, :-1] = height_map[:, 1:] - height_map[:, :-1]
    gx[:, -1] = height_map[:, 0] - height_map[:, -1]
    gy[:-1, :] = height_map[1:, :] - height_map[:-1, :]
    gy[-1, :] = height_map[0, :] - height_map[-1, :]
    
    nx = -gx * strength
    ny = -gy * strength
    nz = np.ones_like(height_map)
    
    len_n = np.sqrt(nx*nx + ny*ny + nz*nz)
    nx /= len_n
    ny /= len_n
    nz /= len_n
    
    # Mapeia para [0, 255]
    r = ((nx * 0.5 + 0.5) * 255).astype(np.uint8)
    g = ((ny * 0.5 + 0.5) * 255).astype(np.uint8)
    b = ((nz * 0.5 + 0.5) * 255).astype(np.uint8)
    return np.stack([r, g, b], axis=-1)

# ---------------------------------------------------------------------------
# 1. PISO DE MADEIRA NOBRE (Parquet / Réguas Escaneadas) - 1024x1024
# ---------------------------------------------------------------------------
print("Gerando Piso de Madeira PBR...")
N = 1024
num_planks_y = 16
plank_h = N // num_planks_y

albedo_wood = np.zeros((N, N, 3), dtype=np.float32)
height_wood = np.zeros((N, N), dtype=np.float32)
roughness_wood = np.zeros((N, N), dtype=np.uint8)

# Base paleta: Carvalho natural elegante (RGB: 198, 168, 134)
np.random.seed(42)

for p_idx in range(num_planks_y):
    y0 = p_idx * plank_h
    y1 = (p_idx + 1) * plank_h
    
    # Variação por régua (cada régua tem tom ligeiramente diferente)
    plank_tone_shift = np.random.uniform(-0.12, 0.12)
    plank_warmth = np.random.uniform(-0.04, 0.04)
    base_r = 196 * (1.0 + plank_tone_shift + plank_warmth)
    base_g = 164 * (1.0 + plank_tone_shift)
    base_b = 130 * (1.0 + plank_tone_shift - plank_warmth)
    
    # Veios ao longo de X (longitudinais)
    yy = np.linspace(0, 1, plank_h)
    freq1 = np.random.uniform(15, 30)
    freq2 = np.random.uniform(50, 90)
    grain_y = np.sin(yy * freq1) * 0.14 + np.sin(yy * freq2) * 0.06
    
    for y_in in range(plank_h):
        y_curr = y0 + y_in
        # Ruído de fibra de madeira ao longo do comprimento
        noise_fiber = np.random.normal(0, 0.03, N)
        grain_val = grain_y[y_in] + noise_fiber
        
        # Leve curvatura orgânica nos anéis da madeira
        wave_x = np.sin(np.linspace(0, 4 * math.pi, N)) * 0.04
        val = 1.0 + grain_val + wave_x
        
        # Atribui cor
        albedo_wood[y_curr, :, 0] = base_r * val
        albedo_wood[y_curr, :, 1] = base_g * val
        albedo_wood[y_curr, :, 2] = base_b * val
        
        # Height map da fibra
        height_wood[y_curr, :] = 0.5 + grain_val * 0.4
        
        # Roughness: acetinado (0.35) com variação nos veios (0.30 - 0.48)
        r_val = 80 + int(grain_val.mean() * 40) + np.random.randint(-8, 8, N)
        roughness_wood[y_curr, :] = np.clip(r_val, 60, 140).astype(np.uint8)
        
    # Chanfro escuro e profundo nas juntas das réguas (sulco de 3px)
    seam_h = 3
    for s in range(seam_h):
        if y0 + s < N:
            albedo_wood[y0 + s, :, :] *= 0.55
            height_wood[y0 + s, :] = 0.05
            roughness_wood[y0 + s, :] = 210
        if y1 - 1 - s >= 0:
            albedo_wood[y1 - 1 - s, :, :] *= 0.55
            height_wood[y1 - 1 - s, :] = 0.05
            roughness_wood[y1 - 1 - s, :] = 210

# Juntas verticais alternadas
for p_idx in range(num_planks_y):
    y0 = p_idx * plank_h
    y1 = (p_idx + 1) * plank_h
    seam_x = (p_idx * 380 + 170) % N
    albedo_wood[y0:y1, max(0, seam_x-2):min(N, seam_x+2), :] *= 0.55
    height_wood[y0:y1, max(0, seam_x-2):min(N, seam_x+2)] = 0.05
    roughness_wood[y0:y1, max(0, seam_x-2):min(N, seam_x+2)] = 210

albedo_wood = np.clip(albedo_wood, 0, 255).astype(np.uint8)
img_albedo_wood = Image.fromarray(albedo_wood).filter(ImageFilter.SMOOTH)
img_albedo_wood.save(os.path.join(OUT_DIR, "piso_madeira_albedo.jpg"), quality=92)

nrm_wood = normal_from_height(height_wood, strength=3.0)
Image.fromarray(nrm_wood).save(os.path.join(OUT_DIR, "piso_madeira_normal.jpg"), quality=90)
Image.fromarray(roughness_wood).save(os.path.join(OUT_DIR, "piso_madeira_roughness.jpg"), quality=88)

# ---------------------------------------------------------------------------
# 2. MÁRMORE NOBRE CALACATTA (Bancadas & Cozinha) - 1024x1024
# ---------------------------------------------------------------------------
print("Gerando Mármore Calacatta PBR...")
albedo_marble = np.ones((N, N, 3), dtype=np.float32) * 248.0 # base branca perolada
# Leve gradiente de fundo suave
xx, yy = np.meshgrid(np.linspace(0, 1, N), np.linspace(0, 1, N))
bg_cloud = np.sin(xx * 3.0 + yy * 2.0) * 4.0 + np.cos(xx * 5.0 - yy * 4.0) * 3.0
albedo_marble[:, :, 0] += bg_cloud
albedo_marble[:, :, 1] += bg_cloud * 0.98
albedo_marble[:, :, 2] += bg_cloud * 0.95

# Veios ramificados orgânicos
num_veins = 12
for v in range(num_veins):
    p0 = np.random.uniform(0, N, 2)
    angle = np.random.uniform(0.6, 1.2)
    length = np.random.uniform(400, 1100)
    width = np.random.uniform(2.5, 9.0)
    vein_color = np.array([85, 90, 96], dtype=np.float32) * np.random.uniform(0.8, 1.3)
    if np.random.rand() > 0.6: # veio dourado sutil
        vein_color = np.array([170, 142, 105], dtype=np.float32)
        
    steps = int(length // 4)
    cur_p = p0.copy()
    for s in range(steps):
        angle += np.random.normal(0, 0.15)
        cur_p[0] += math.cos(angle) * 4.0
        cur_p[1] += math.sin(angle) * 4.0
        xi, yi = int(cur_p[0]) % N, int(cur_p[1]) % N
        w_rad = max(1, int(width + math.sin(s * 0.1) * 2))
        for dy in range(-w_rad, w_rad + 1):
            for dx in range(-w_rad, w_rad + 1):
                dist = math.hypot(dx, dy)
                if dist <= w_rad:
                    px = (xi + dx) % N
                    py = (yi + dy) % N
                    factor = 1.0 - (dist / w_rad)
                    albedo_marble[py, px, :] = albedo_marble[py, px, :] * (1.0 - factor * 0.65) + vein_color * (factor * 0.65)

albedo_marble = np.clip(albedo_marble, 0, 255).astype(np.uint8)
img_marble = Image.fromarray(albedo_marble).filter(ImageFilter.GaussianBlur(radius=1.2))
img_marble.save(os.path.join(OUT_DIR, "marmore_albedo.jpg"), quality=92)

# Mármore polido: roughness baixa (40-60)
roughness_marble = np.full((N, N), 45, dtype=np.uint8)
Image.fromarray(roughness_marble).save(os.path.join(OUT_DIR, "marmore_roughness.jpg"), quality=88)

# ---------------------------------------------------------------------------
# 3. TECIDO LINHO NÓRDICO (Sofá & Estofados) - 1024x1024
# ---------------------------------------------------------------------------
print("Gerando Tecido Linho Escaneado PBR...")
# Base bege linho elegante (225, 218, 208)
albedo_fabric = np.zeros((N, N, 3), dtype=np.float32)
height_fabric = np.zeros((N, N), dtype=np.float32)

trama_freq = 0.45
x_coord, y_coord = np.meshgrid(np.arange(N), np.arange(N))
warp = np.sin(x_coord * trama_freq) * 0.5 + 0.5
weft = np.cos(y_coord * trama_freq) * 0.5 + 0.5
pattern = (warp * 0.6 + weft * 0.4)

noise_tex = np.random.normal(0, 0.04, (N, N))
tex_val = np.clip(pattern + noise_tex, 0, 1.2)

albedo_fabric[:, :, 0] = 224 * (0.88 + 0.24 * tex_val)
albedo_fabric[:, :, 1] = 217 * (0.88 + 0.24 * tex_val)
albedo_fabric[:, :, 2] = 205 * (0.88 + 0.24 * tex_val)

height_fabric = tex_val.astype(np.float32)

albedo_fabric = np.clip(albedo_fabric, 0, 255).astype(np.uint8)
Image.fromarray(albedo_fabric).save(os.path.join(OUT_DIR, "tecido_linho_albedo.jpg"), quality=92)

nrm_fabric = normal_from_height(height_fabric, strength=2.2)
Image.fromarray(nrm_fabric).save(os.path.join(OUT_DIR, "tecido_linho_normal.jpg"), quality=90)

# Roughness linho: 0.65 a 0.75 (165 a 190)
roughness_fabric = (175 + noise_tex * 150).clip(150, 200).astype(np.uint8)
Image.fromarray(roughness_fabric).save(os.path.join(OUT_DIR, "tecido_linho_roughness.jpg"), quality=88)

# ---------------------------------------------------------------------------
# 4. TAPETE CONTEMPORÂNEO BERBER (Sala de Estar) - 1024x1024
# ---------------------------------------------------------------------------
print("Gerando Tapete Geométrico Escandinavo...")
albedo_rug = np.full((N, N, 3), 232.0, dtype=np.float32) # base off-white
# Padrão geométrico suave estilo losango berber em cinza grafite
line_mask = np.zeros((N, N), dtype=np.float32)
scale = 128
for y in range(N):
    for x in range(N):
        d1 = abs((x + y) % scale - scale // 2)
        d2 = abs((x - y) % scale - scale // 2)
        if d1 < 4 or d2 < 4:
            line_mask[y, x] = 1.0

# Textura felpuda
fuzz = np.random.normal(0, 0.08, (N, N))
albedo_rug[:, :, 0] += fuzz * 20
albedo_rug[:, :, 1] += fuzz * 20
albedo_rug[:, :, 2] += fuzz * 18

dark_charcoal = np.array([48, 52, 56], dtype=np.float32)
for c in range(3):
    albedo_rug[:, :, c] = albedo_rug[:, :, c] * (1.0 - line_mask * 0.75) + dark_charcoal[c] * (line_mask * 0.75)

albedo_rug = np.clip(albedo_rug, 0, 255).astype(np.uint8)
img_rug = Image.fromarray(albedo_rug).filter(ImageFilter.GaussianBlur(radius=0.8))
img_rug.save(os.path.join(OUT_DIR, "tapete_sala_albedo.jpg"), quality=92)

nrm_rug = normal_from_height(line_mask * 0.6 + fuzz * 0.4, strength=2.8)
Image.fromarray(nrm_rug).save(os.path.join(OUT_DIR, "tapete_sala_normal.jpg"), quality=90)

# ---------------------------------------------------------------------------
# 5. MAPA DE AMBIENTE HDRI EQUIRRETANGULAR (1024x512)
# ---------------------------------------------------------------------------
print("Gerando Mapa de Ambiente Fotográfico HDRI...")
W_ENV, H_ENV = 1024, 512
env_img = np.zeros((H_ENV, W_ENV, 3), dtype=np.float32)

# Gradiente de luz natural de teto / céu suave
for y in range(H_ENV):
    t = y / H_ENV
    if t < 0.48: # teto / luz superior
        env_img[y, :, 0] = 230 + (1.0 - t/0.48) * 25
        env_img[y, :, 1] = 238 + (1.0 - t/0.48) * 17
        env_img[y, :, 2] = 248 + (1.0 - t/0.48) * 7
    elif t < 0.52: # linha de horizonte
        env_img[y, :, 0] = 255
        env_img[y, :, 1] = 250
        env_img[y, :, 2] = 240
    else: # piso e reflexos quentes de madeira
        factor = (t - 0.52) / 0.48
        env_img[y, :, 0] = 195 - factor * 80
        env_img[y, :, 1] = 170 - factor * 80
        env_img[y, :, 2] = 145 - factor * 75

# Janelas amplas com luz solar difusa
# Janela 1 (sala)
env_img[120:300, 180:420, :] = [255, 255, 255]
# Janela 2 (suíte)
env_img[140:280, 720:900, :] = [255, 250, 240]

env_img = np.clip(env_img, 0, 255).astype(np.uint8)
img_env = Image.fromarray(env_img).filter(ImageFilter.GaussianBlur(radius=8.0))
img_env.save(os.path.join(OUT_DIR, "ambiente_hdri.jpg"), quality=94)

print("Todas as texturas PBR do PLANO B foram geradas com sucesso em:", OUT_DIR)
