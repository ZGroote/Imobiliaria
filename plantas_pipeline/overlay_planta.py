import json,sys,numpy as np
from PIL import Image,ImageDraw
Image.MAX_IMAGE_PIXELS=None
d=json.load(open(sys.argv[2])); K=int(sys.argv[3]) if len(sys.argv)>3 else 6
im=Image.open(sys.argv[1]).convert('L').convert('RGB')
W,H=im.size; im=im.resize((W//K,H//K),Image.LANCZOS)
dr=ImageDraw.Draw(im,'RGBA')
A=np.array([l['area'] for l in d['lotes']])
for l in d['lotes']:
    p=[(x/K,y/K) for x,y in l['poly']]
    a=l['area']
    c=(255,60,60,110) if a<80 else ((60,180,60,110) if a<200 else (60,90,255,110))
    if len(p)>2: dr.polygon(p,fill=c)
im.save(sys.argv[4] if len(sys.argv)>4 else 'ovl.png')
print('ovl salvo',im.size,'| <80m2 %d  80-200 %d  >200 %d'%((A<80).sum(),((A>=80)&(A<200)).sum(),(A>=200).sum()))
