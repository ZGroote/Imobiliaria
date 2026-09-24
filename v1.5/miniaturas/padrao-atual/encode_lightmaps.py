"""Após bake e OIDN: codifica mapas HDR em RGBM WebP sem perdas."""
from pathlib import Path
import json,gzip,struct,sys
import numpy as np
from PIL import Image
H=Path(__file__).resolve().parent
for folder in (sys.argv[1:] or ['piloto-v3','exterior-v3']):
 assert folder in ['piloto-v3','exterior-v3']
 p=H/folder;meta=json.loads((p/'bake.json').read_text());n=meta['size'];rgb=np.maximum(np.fromfile(p/'irradiance-denoised.f32',dtype=np.float32).reshape(n,n,3),0)
 assert np.isfinite(rgb).all()
 multiplier=np.clip(np.ceil(rgb.max(axis=2)/16*255)/255,1/255,1)
 rgba=np.dstack([np.clip(rgb/(multiplier[:,:,None]*16),0,1),multiplier]);Image.fromarray(np.uint8(rgba[::-1]*255+.5),'RGBA').save(p/'lightmap.webp',lossless=True,method=6)
 (p/'encoding.json').write_text(json.dumps({'size':n,'range':16,'encoding':'RGBM WebP lossless, no mipmaps','bytes':(p/'lightmap.webp').stat().st_size,'clippedPixels':int((rgb.max(axis=2)>16).sum())},indent=2))
 binary=struct.pack('<II',n,n)+np.uint8(rgba*255+.5).tobytes()
 (p/'lightmap.rgbm.gz').write_bytes(gzip.compress(binary,compresslevel=9,mtime=0))
 print(folder,(p/'lightmap.rgbm.gz').stat().st_size,'bytes RGBM gzip')
