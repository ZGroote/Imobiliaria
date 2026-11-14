"""Analyse held-out views on the server; no visual approval is inferred from metrics."""
import argparse, collections, json, math, unicodedata, re
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import laplace
from skimage.metrics import structural_similarity

parser=argparse.ArgumentParser()
parser.add_argument('--dataset',type=Path,default=Path('dataset'))
parser.add_argument('--eval',type=Path,default=Path('resultado/eval'))
parser.add_argument('--out',type=Path,default=Path('resultado/analise-ambientes'))
args=parser.parse_args()
meta=json.loads((args.dataset/'transforms.json').read_text())
selected=set(meta['test_filenames'])
frames=sorted((f for f in meta['frames'] if f['file_path'] in selected),key=lambda f:f['file_path'])
files=sorted(args.eval.glob('eval_img_*.png'))
assert len(files)==len(frames), (len(files),len(frames))
args.out.mkdir(parents=True,exist_ok=True)
records=[]
for i,(frame,path) in enumerate(zip(frames,files)):
    image=np.asarray(Image.open(path).convert('RGB'))
    height,width=image.shape[:2]
    assert width%2==0
    gt,pred=image[:,:width//2],image[:,width//2:]
    source=np.asarray(Image.open(args.dataset/frame['file_path']).convert('RGB'))
    assert source.shape==gt.shape
    error=int(np.abs(source.astype(np.int16)-gt.astype(np.int16)).max())
    assert error<=1, (i,frame['file_path'],error)
    mse=float(np.mean((gt.astype(np.float64)-pred.astype(np.float64))**2))
    psnr=10*math.log10(255**2/max(mse,1e-12))
    ssim=float(structural_similarity(gt,pred,channel_axis=2,data_range=255))
    sharp_gt=float(laplace(gt.astype(np.float64).mean(axis=2)).var())
    sharp_pred=float(laplace(pred.astype(np.float64).mean(axis=2)).var())
    records.append({'file':frame['file_path'],'eval_file':str(path),'comodo':frame['comodo'],'pitch':frame['pitch'],'position_id':frame['position_id'],'psnr':psnr,'ssim':ssim,'laplacian_variance_gt':sharp_gt,'laplacian_variance_pred':sharp_pred,'sharpness_ratio':sharp_pred/sharp_gt if sharp_gt>1 else None})

def summary(items):
    return {'views':len(items),'psnr_mean':float(np.mean([i['psnr'] for i in items])),'psnr_min':min(i['psnr'] for i in items),'ssim_mean':float(np.mean([i['ssim'] for i in items])),'ssim_min':min(i['ssim'] for i in items)}
(args.out/'metricas-por-vista.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
rooms=sorted({i['comodo'] for i in records})
report={'note':'Metrics use quantized held-out PNG comparisons. They are diagnostic evidence; visual review and browser validation are still pending. Sharpness is affected by artifacts as well as detail.','overall':summary(records),'rooms':{},'room_pitch':{},'views':records}
for room in rooms:
    subset=[i for i in records if i['comodo']==room]
    report['rooms'][room]=summary(subset)
    pitches=sorted({i['pitch'] for i in subset})
    choices=[]
    for pitch in pitches:
        group=sorted([i for i in subset if i['pitch']==pitch],key=lambda i:i['psnr'])
        report['room_pitch'][room+' / '+str(pitch)]=summary(group)
        choices.append(group[len(group)//2])
    canvas=Image.new('RGB',(1280,len(choices)*390),(235,235,235)); draw=ImageDraw.Draw(canvas)
    for row,record in enumerate(choices):
        thumb=Image.open(record['eval_file']).convert('RGB').resize((1280,360))
        y=row*390
        draw.text((10,y+6),f"{room} | pitch {record['pitch']} | {record['file']} | PSNR {record['psnr']:.2f} | reference left, prediction right",fill=(10,10,10))
        canvas.paste(thumb,(0,y+30))
    slug=re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',room).encode('ascii','ignore').decode().lower()).strip('-')
    assert slug and '/' not in slug and '\\' not in slug
    canvas.save(args.out/(slug+'.jpg'),quality=92)
(args.out/'metricas-por-ambiente.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'overall':report['overall'],'rooms':report['rooms'],'room_pitch':report['room_pitch']},ensure_ascii=False,indent=2))

