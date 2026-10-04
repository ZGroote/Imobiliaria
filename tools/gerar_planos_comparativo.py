"""
Script para gerar:
1. publicacao/m1-1a/lote-10-casas/casa-10/maquete/plano-a.html
2. publicacao/m1-1a/lote-10-casas/casa-10/maquete/plano-b.html
3. publicacao/m1-1a/lote-10-casas/comparativo.html
"""

import os
import re

BASE_DIR = os.path.join("publicacao", "m1-1a", "lote-10-casas")
CASA10_DIR = os.path.join(BASE_DIR, "casa-10", "maquete")
SRC_HTML = os.path.join(CASA10_DIR, "maquete.html")
PLANO_A_HTML = os.path.join(CASA10_DIR, "plano-a.html")
PLANO_B_HTML = os.path.join(CASA10_DIR, "plano-b.html")
COMP_HTML = os.path.join(BASE_DIR, "comparativo.html")

with open(SRC_HTML, "r", encoding="utf-8") as f:
    source_html = f.read()

# ---------------------------------------------------------------------------
# 1. PLANO A (Mobile-First / 3G Ultra-Leve)
# ---------------------------------------------------------------------------
banner_a = """
<div id="badgePlano" style="position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(12,18,25,0.94);border:1px solid rgba(75,219,124,0.6);border-radius:30px;padding:6px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.65);display:flex;align-items:center;gap:12px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#e7ebf0;backdrop-filter:blur(10px);white-space:nowrap;pointer-events:auto;">
  <span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:#4BDB7C;letter-spacing:0.5px;text-transform:uppercase;">
    <span style="width:8px;height:8px;border-radius:50%;background:#4BDB7C;box-shadow:0 0 8px #4BDB7C;display:inline-block;"></span>
    Plano A · Mobile-First (3G)
  </span>
  <span style="color:#99a5af;font-size:11px;">~415 KB transferidos · 1 único arquivo · Carga &lt; 2s</span>
  <a href="../../comparativo.html" style="background:#2563eb;color:#fff;text-decoration:none;padding:3px 10px;border-radius:12px;font-weight:600;font-size:11px;transition:background 0.2s;">Ver Comparativo ↗</a>
</div>
"""

html_a = source_html.replace("<body>", "<body>\n" + banner_a)
html_a = html_a.replace("<title>", "<title>[Plano A · Mobile-First 3G] ")

with open(PLANO_A_HTML, "w", encoding="utf-8") as f:
    f.write(html_a)
print("Plano A gerado com sucesso:", PLANO_A_HTML, f"({len(html_a)} bytes)")

# ---------------------------------------------------------------------------
# 2. PLANO B (High-End ArchViz / Padrão Desktop com Texturas Fotográficas)
# ---------------------------------------------------------------------------
banner_b = """
<div id="badgePlano" style="position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(12,18,25,0.94);border:1px solid rgba(59,130,246,0.6);border-radius:30px;padding:6px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.65);display:flex;align-items:center;gap:12px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#e7ebf0;backdrop-filter:blur(10px);white-space:nowrap;pointer-events:auto;">
  <span style="display:inline-flex;align-items:center;gap:6px;font-weight:700;color:#60A5FA;letter-spacing:0.5px;text-transform:uppercase;">
    <span style="width:8px;height:8px;border-radius:50%;background:#60A5FA;box-shadow:0 0 8px #60A5FA;display:inline-block;"></span>
    Plano B · High-End ArchViz (Desktop)
  </span>
  <span style="color:#99a5af;font-size:11px;">~7.8 MB · Texturas Fotográficas PBR + Staging Decorativo</span>
  <a href="../../comparativo.html" style="background:#2563eb;color:#fff;text-decoration:none;padding:3px 10px;border-radius:12px;font-weight:600;font-size:11px;transition:background 0.2s;">Ver Comparativo ↗</a>
</div>
"""

# No Plano B, garantimos que cena e materiais sejam acessíveis globalmente via window.__
html_b = source_html.replace("var cena = new THREE.Scene();", "var cena = window.__cena3D = new THREE.Scene();")
html_b = html_b.replace("var MAT = InteriorMaterials.create({", "var MAT = window.__MAT = InteriorMaterials.create({")
html_b = html_b.replace("var matSofaTecido = new THREE.MeshStandardMaterial({", "var matSofaTecido = window.__matSofaTecido = new THREE.MeshStandardMaterial({")
html_b = html_b.replace("var matCamaTecido = new THREE.MeshStandardMaterial({", "var matCamaTecido = window.__matCamaTecido = new THREE.MeshStandardMaterial({")

js_planob_override = """
/* ==========================================================================
   PLANO B: ATIVAÇÃO DE TEXTURAS FOTOGRÁFICAS PBR & STAGING DE ALTO PADRÃO
   ========================================================================== */
(function() {
  if (typeof THREE === 'undefined') return;
  var loader = new THREE.TextureLoader();
  var assetPath = 'assets_planob/';

  // 1. Texturas Fotográficas de Piso de Madeira Nobre
  loader.load(assetPath + 'piso_madeira_albedo.jpg', function(texAlbedo) {
    texAlbedo.wrapS = texAlbedo.wrapT = THREE.RepeatWrapping;
    texAlbedo.repeat.set(4, 4);
    if (THREE.SRGBColorSpace) texAlbedo.colorSpace = THREE.SRGBColorSpace;
    
    loader.load(assetPath + 'piso_madeira_normal.jpg', function(texNormal) {
      texNormal.wrapS = texNormal.wrapT = THREE.RepeatWrapping;
      texNormal.repeat.set(4, 4);
      
      loader.load(assetPath + 'piso_madeira_roughness.jpg', function(texRough) {
        texRough.wrapS = texRough.wrapT = THREE.RepeatWrapping;
        texRough.repeat.set(4, 4);
        
        var mat = window.__MAT || (typeof MAT !== 'undefined' ? MAT : null);
        if (mat && mat.matMadeira) {
          mat.matMadeira.map = texAlbedo;
          mat.matMadeira.normalMap = texNormal;
          mat.matMadeira.normalScale.set(0.65, 0.65);
          mat.matMadeira.roughnessMap = texRough;
          mat.matMadeira.roughness = 0.85;
          mat.matMadeira.envMapIntensity = 0.65;
          mat.matMadeira.needsUpdate = true;
        }
      });
    });
  });

  // 2. Texturas Fotográficas de Linho Escaneado para Sofá e Cama
  loader.load(assetPath + 'tecido_linho_albedo.jpg', function(texAlbedo) {
    texAlbedo.wrapS = texAlbedo.wrapT = THREE.RepeatWrapping;
    texAlbedo.repeat.set(5, 5);
    if (THREE.SRGBColorSpace) texAlbedo.colorSpace = THREE.SRGBColorSpace;
    
    loader.load(assetPath + 'tecido_linho_normal.jpg', function(texNormal) {
      texNormal.wrapS = texNormal.wrapT = THREE.RepeatWrapping;
      texNormal.repeat.set(5, 5);
      
      loader.load(assetPath + 'tecido_linho_roughness.jpg', function(texRough) {
        texRough.wrapS = texRough.wrapT = THREE.RepeatWrapping;
        texRough.repeat.set(5, 5);
        
        var sTecido = window.__matSofaTecido || (typeof matSofaTecido !== 'undefined' ? matSofaTecido : null);
        if (sTecido) {
          sTecido.map = texAlbedo;
          sTecido.normalMap = texNormal;
          sTecido.normalScale.set(0.5, 0.5);
          sTecido.roughnessMap = texRough;
          sTecido.roughness = 0.75;
          sTecido.needsUpdate = true;
        }
        var cTecido = window.__matCamaTecido || (typeof matCamaTecido !== 'undefined' ? matCamaTecido : null);
        if (cTecido) {
          cTecido.map = texAlbedo;
          cTecido.normalMap = texNormal;
          cTecido.normalScale.set(0.45, 0.45);
          cTecido.roughnessMap = texRough;
          cTecido.needsUpdate = true;
        }
      });
    });
  });

  // 3. Mármore Fotográfico Calacatta para Bancadas
  loader.load(assetPath + 'marmore_albedo.jpg', function(texMarmore) {
    texMarmore.wrapS = texMarmore.wrapT = THREE.RepeatWrapping;
    texMarmore.repeat.set(2, 2);
    if (THREE.SRGBColorSpace) texMarmore.colorSpace = THREE.SRGBColorSpace;
    
    loader.load(assetPath + 'marmore_roughness.jpg', function(texRough) {
      texRough.wrapS = texRough.wrapT = THREE.RepeatWrapping;
      texRough.repeat.set(2, 2);
      
      var mat = window.__MAT || (typeof MAT !== 'undefined' ? MAT : null);
      if (mat && mat.matFrio) {
        mat.matFrio.map = texMarmore;
        mat.matFrio.roughnessMap = texRough;
        mat.matFrio.roughness = 0.28;
        mat.matFrio.metalness = 0.08;
        mat.matFrio.envMapIntensity = 0.95;
        mat.matFrio.needsUpdate = true;
      }
    });
  });

  // 4. Staging Decorativo Adicional: Tapete Nórdico & Livros de Design
  window.addEventListener('load', function() {
    setTimeout(function() {
      var cenaAlvo = window.__cena3D;
      if (!cenaAlvo || typeof cenaAlvo.add !== 'function') return;
      
      loader.load(assetPath + 'tapete_sala_albedo.jpg', function(texTapete) {
        if (THREE.SRGBColorSpace) texTapete.colorSpace = THREE.SRGBColorSpace;
        var matTapete = new THREE.MeshStandardMaterial({
          map: texTapete,
          roughness: 0.85,
          metalness: 0.0,
          envMap: (typeof ambientePBR !== 'undefined' ? ambientePBR : null),
          envMapIntensity: 0.25
        });
        
        // Tapete elegante na sala
        var tapeteGeo = new THREE.PlaneGeometry(2.2, 1.6);
        var tapeteMesh = new THREE.Mesh(tapeteGeo, matTapete);
        tapeteMesh.rotation.x = -Math.PI / 2;
        tapeteMesh.position.set(0.2, 0.015, -0.4);
        tapeteMesh.receiveShadow = true;
        cenaAlvo.add(tapeteMesh);
      });
      
      // Arranjo de livros de arte e vaso de cerâmica na mesa de centro
      var decorGroup = new THREE.Group();
      var matLivro1 = new THREE.MeshStandardMaterial({ color: 0x2A2E35, roughness: 0.5 });
      var matLivro2 = new THREE.MeshStandardMaterial({ color: 0xDCD5CB, roughness: 0.6 });
      var livro1 = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.035, 0.22), matLivro1);
      var livro2 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.030, 0.20), matLivro2);
      livro2.position.set(0.02, 0.035, 0.01);
      livro2.rotation.y = 0.12;
      
      // Vaso cerâmico nórdico
      var matVaso = new THREE.MeshStandardMaterial({ color: 0x9B8E80, roughness: 0.45, metalness: 0.05 });
      var vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.16, 16), matVaso);
      vaso.position.set(-0.25, 0.08, 0.0);
      
      decorGroup.add(livro1);
      decorGroup.add(livro2);
      decorGroup.add(vaso);
      decorGroup.position.set(0.2, 0.46, -0.4);
      cenaAlvo.add(decorGroup);
      
    }, 600);
  });
})();
"""

html_b = html_b.replace("<body>", "<body>\n" + banner_b)
html_b = html_b.replace("<title>", "<title>[Plano B · High-End ArchViz] ")
html_b = html_b.replace("</body>", f"<script>\n{js_planob_override}\n</script>\n</body>")

with open(PLANO_B_HTML, "w", encoding="utf-8") as f:
    f.write(html_b)
print("Plano B gerado com sucesso:", PLANO_B_HTML, f"({len(html_b)} bytes)")
