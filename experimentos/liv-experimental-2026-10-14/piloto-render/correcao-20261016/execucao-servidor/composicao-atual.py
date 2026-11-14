from pathlib import Path
import os,json,time,datetime,traceback,subprocess,hashlib,tarfile,zipfile,sys,signal
import numpy as np
import torch
from PIL import Image,ImageDraw
import re,unicodedata
root=Path('/root/liv-corrigido-20261016')
out=root/'resultado-composicao'
keys=['means','features_dc','features_rest','opacities','scales','quats']
items=json.loads((root/'ensaios-comodos/manifesto.json').read_text())
polygons=json.loads((root/'poligonos-comodos.json').read_text())
def signed_distance(xy,polygon):
 p=np.asarray(polygon,dtype=np.float64)
 inside=np.zeros(len(xy),dtype=bool); distance=np.full(len(xy),np.inf)
 x,y=xy[:,0],xy[:,1]
 for a,b in zip(p,np.roll(p,-1,axis=0)):
  v=b-a; delta=xy-a
  t=np.clip((delta@v)/(v@v),0,1)
  distance=np.minimum(distance,np.linalg.norm(delta-t[:,None]*v,axis=1))
  if a[1]!=b[1]:
   inside^=((a[1]>y)!=(b[1]>y)) & (x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])
 return np.where(inside,distance,-distance)
def owners(means,selected,margin=.025):
 xyz=means.detach().cpu().numpy()
 scores=np.stack([signed_distance(xyz[:,:2],polygons[a['room']]) for a in selected],axis=1)
 owner=np.argmax(scores,axis=1)
 owner[(np.max(scores,axis=1)<-margin)|(xyz[:,2]<-.3)|(xyz[:,2]>3.2)]=-1
 return owner
def load_params(cp):
 state=torch.load(cp,map_location='cpu',weights_only=False)
 params={k:state['pipeline']['_model.gauss_params.'+k] for k in keys}
 assert all(torch.isfinite(v).all() for v in params.values())
 n=len(params['means']); assert n>1000
 assert all(len(v)==n for v in params.values())
 return params
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(8*1024*1024),b''): h.update(block)
 return h.hexdigest()
def package(name,paths):
 target=root/(name+'.tgz'); temp=root/(name+'.partial.tgz')
 with tarfile.open(temp,'w:gz',compresslevel=1) as tar:
  for p in paths: tar.add(p,arcname=p.relative_to(root))
 temp.replace(target)
 manifest_temp=root/(name+'.partial.json')
 manifest_temp.write_text(json.dumps({'bytes':target.stat().st_size,'sha256':digest(target),'visual_review':'pending','download_authorized':True},indent=2))
 manifest_temp.replace(root/(name+'.json'))
 print('PACKAGE_READY',name,target.stat().st_size,flush=True)
def self_test():
 points=torch.tensor([[1.,-2.,1.],[1.5,1.,1.],[-3.,2.,1.],[-3.,-1.,1.],[1.,-2.,5.]])
 assert owners(points,items).tolist()==[0,1,2,-1,-1]
 cp=next((root/'treino-refino60k').glob('**/step-000059999.ckpt'))
 params=load_params(cp); own=owners(params['means'],items); idx=np.arange(len(own))
 rebuilt=np.concatenate([idx[own==-1]]+[idx[own==i] for i in range(len(items))])
 assert np.array_equal(np.sort(rebuilt),idx)
 for k in keys:
  reconstructed=torch.empty_like(params[k])
  for label in [-1,0,1,2]:
   mask=torch.from_numpy(own==label); reconstructed[mask]=params[k][mask]
  assert torch.equal(reconstructed,params[k])
 print('SELF_TEST_PASSED',len(own),np.bincount(own+1).tolist(),flush=True)
def main():
 os.chdir(root); out.mkdir(exist_ok=True)
 limit=datetime.datetime(2026,10,17,7,10,tzinfo=datetime.timezone.utc).timestamp()
 while not ((root/'denso16-corrigido-concluido').exists() and (root/'ensaios-comodos/concluido').exists()):
  if (root/'falha-denso16-corrigido.txt').exists(): raise RuntimeError('Main dense pipeline failed')
  if time.time()>limit: raise TimeoutError('Preserve download reserve')
  time.sleep(20)
 def composition_timeout(signum,frame): raise TimeoutError('Composition time reserve reached; preserve global and room checkpoints')
 signal.signal(signal.SIGALRM,composition_timeout)
 hard_end=datetime.datetime(2026,10,17,7,20,tzinfo=datetime.timezone.utc).timestamp()
 remaining=int(hard_end-time.time())
 if remaining<120: raise TimeoutError('No composition window left')
 signal.alarm(min(900,remaining))
 global_report=json.loads((root/'resultado-denso16-corrigido/analise-ambientes/metricas-por-ambiente.json').read_text())
 selected=[]; decision=[]
 for item in items:
  report=Path(item['directory'])/'resultado/analise-ambientes/metricas-por-ambiente.json'
  if not report.exists(): continue
  trial=json.loads(report.read_text()); room=item['room']
  base=global_report['rooms'][room]; local=trial['rooms'][room]
  surface_gains={str(p):{'psnr_gain':trial['room_pitch'][f'{room} / {p}']['psnr_mean']-global_report['room_pitch'][f'{room} / {p}']['psnr_mean'],'ssim_gain':trial['room_pitch'][f'{room} / {p}']['ssim_mean']-global_report['room_pitch'][f'{room} / {p}']['ssim_mean']} for p in (-60,60)}
  surface_ok=all(v['psnr_gain']>=0 and v['ssim_gain']>=-.002 for v in surface_gains.values())
  floor_gain=surface_gains['-60']['psnr_gain']
  gain=local['psnr_mean']-base['psnr_mean']
  test=gain>=.5 and local['ssim_mean']>=base['ssim_mean']-.002 and surface_ok
  decision.append({'room':room,'gain_psnr':gain,'gain_floor_psnr':floor_gain,'floor_ceiling':surface_gains,'selected_for_experiment':test})
  if test: selected.append(item)
 status={'experiment':'spatial composition, same source and world coordinates','decision':decision,'visual_review':'pending','publication':'none'}
 (out/'decisao.json').write_text(json.dumps(status,ensure_ascii=False,indent=2))
 if not selected:
  status['result']='No room met numerical threshold; retain dense model for visual review'
  (out/'decisao.json').write_text(json.dumps(status,ensure_ascii=False,indent=2))
  package('composicao-preview',[out/'decisao.json'])
  return
 from nerfstudio.utils.eval_utils import eval_setup
 from nerfstudio.scripts import exporter
 cfg=next((root/'treino-denso16-corrigido').glob('**/config.yml'))
 config,pipeline,cp,step=eval_setup(cfg,test_mode='test')
 base={k:pipeline.model.gauss_params[k].detach().cpu() for k in keys}
 own=owners(base['means'],selected); keep=torch.from_numpy(own==-1)
 fragments={k:[base[k][keep]] for k in keys}
 provenance=[{'source':str(cp),'kept':int(keep.sum()),'region':'outside selected rooms'}]
 for i,item in enumerate(selected):
  room_cp=sorted((Path(item['directory'])/'treino').glob('**/step-*.ckpt'))[-1]
  local=load_params(room_cp); room_own=owners(local['means'],selected)
  mask=torch.from_numpy(room_own==i)
  assert int(mask.sum())>500
  for k in keys:
   assert local[k].shape[1:]==base[k].shape[1:]
   fragments[k].append(local[k][mask])
  provenance.append({'source':str(room_cp),'kept':int(mask.sum()),'region':item['room']})
 composed={k:torch.cat(v,dim=0) for k,v in fragments.items()}
 assert all(torch.isfinite(v).all() for v in composed.values())
 free_vram,total_vram=torch.cuda.mem_get_info(pipeline.device)
 status.update(sources=provenance,count=len(composed['means']),free_vram_bytes=free_vram,point_limit=6000000)
 if len(composed['means'])>=6000000 or free_vram<8*1024**3:
  status['result']='Composition skipped by capacity reserve; global and room checkpoints preserved'
  (out/'decisao.json').write_text(json.dumps(status,ensure_ascii=False,indent=2))
  package('composicao-preview',[out/'decisao.json'])
  return
 torch.save({'gauss_params':composed,'sources':provenance,'optimizer_state':None,'resume_training_supported':False},out/'gaussians.pt')
 for k,v in composed.items():
  pipeline.model.gauss_params[k]=torch.nn.Parameter(v.to(pipeline.device))
 pipeline.eval()
 with torch.no_grad():
  metrics=pipeline.get_average_eval_image_metrics(output_path=out/'eval',get_std=True)
 (out/'eval.json').write_text(json.dumps({'results':metrics,'source_config':str(cfg),'sources':provenance},indent=2))
 exporter.eval_setup=lambda *args,**kwargs:(config,pipeline,cp,step)
 with torch.no_grad(): exporter.ExportGaussianSplat(load_config=cfg,output_dir=out).main()
 subprocess.run(['/root/liv-ns/bin/python',str(root/'avaliar-por-ambiente.py'),'--dataset',str(root/'dataset-denso'),'--eval',str(out/'eval'),'--out',str(out/'analise-ambientes')],cwd=root,check=True,timeout=240)
 report=json.loads((out/'analise-ambientes/metricas-por-ambiente.json').read_text())
 comparisons={room:{'psnr_gain':m['psnr_mean']-global_report['rooms'][room]['psnr_mean'],'ssim_gain':m['ssim_mean']-global_report['rooms'][room]['ssim_mean']} for room,m in report['rooms'].items()}
 status.update(sources=provenance,count=len(composed['means']),rooms=comparisons)
 status['numerically_acceptable']=all(m['psnr_gain']>=(-.15 if room not in [i['room'] for i in selected] else 0) and m['ssim_gain']>=-.003 for room,m in comparisons.items())
 surfaces={f'{room} / {pitch}':{'psnr_gain':report['room_pitch'][f'{room} / {pitch}']['psnr_mean']-global_report['room_pitch'][f'{room} / {pitch}']['psnr_mean'],'ssim_gain':report['room_pitch'][f'{room} / {pitch}']['ssim_mean']-global_report['room_pitch'][f'{room} / {pitch}']['ssim_mean'],'views':report['room_pitch'][f'{room} / {pitch}']['views']} for room in report['rooms'] for pitch in (-60,60)}
 previous_views={v['file']:v for v in global_report['views']}
 assert set(previous_views)=={v['file'] for v in report['views']}
 paired=[]
 for view in report['views']:
  if view['pitch'] not in (-60,60): continue
  old=previous_views[view['file']]
  assert (view['comodo'],view['pitch'])==(old['comodo'],old['pitch'])
  paired.append({'file':view['file'],'room':view['comodo'],'pitch':view['pitch'],'psnr_gain':view['psnr']-old['psnr'],'ssim_gain':view['ssim']-old['ssim']})
 regressions=[v for v in paired if v['psnr_gain']<-.15 or v['ssim_gain']<-.003]
 for key,value in surfaces.items():
  views=[v for v in paired if f"{v['room']} / {v['pitch']}"==key]
  assert len(views)==value['views']
  value['worst_psnr_pair']=min(views,key=lambda v:v['psnr_gain'])
  value['worst_ssim_pair']=min(views,key=lambda v:v['ssim_gain'])
 status['floor_ceiling']=surfaces
 status['floor_ceiling_paired_regressions']=regressions
 status['numerically_acceptable']=status['numerically_acceptable'] and all(v['psnr_gain']>=0 and v['ssim_gain']>=-.003 for v in surfaces.values()) and not regressions
 status['quality_gate_note']='Floor and ceiling screened separately in all six rooms; numerical screening never establishes visual approval.'
 status['result']='experimental alternative; inspect images before any selection'
 (out/'decisao.json').write_text(json.dumps(status,ensure_ascii=False,indent=2))
 runtime=json.loads(Path('/root/liv-tools/converter-runtime.json').read_text())
 subprocess.run([str(Path(runtime['node_root'])/'bin/node'),runtime['cli'],'--gpu','0','--sh-iterations','30','--max-workers','4',str(out/'splat.ply'),str(out/'apartamento-composicao.sog')],cwd=root,check=True,timeout=180)
 with zipfile.ZipFile(out/'apartamento-composicao.sog') as z: assert z.testzip() is None
 prior={v['file']:v for v in global_report['views']}; new={v['file']:v for v in report['views']}
 sheets=root/'comparacao-visual-composicao'; sheets.mkdir(exist_ok=True)
 for room in report['rooms']:
  canvas=Image.new('RGB',(1920,1170),(240,240,240)); draw=ImageDraw.Draw(canvas)
  for row,pitch in enumerate([-60,0,60]):
   group=sorted([v for v in global_report['views'] if v['comodo']==room and v['pitch']==pitch],key=lambda v:v['psnr'])
   v=group[0]
   a=Image.open(root/prior[v['file']]['eval_file']).convert('RGB'); b=Image.open(root/new[v['file']]['eval_file']).convert('RGB')
   assert a.size==b.size
   w,h=a.size; half=w//2
   parts=[a.crop((0,0,half,h)),a.crop((half,0,w,h)),b.crop((half,0,w,h))]
   for col,(part,label) in enumerate(zip(parts,['Referencia','Denso completo','Composicao experimental'])):
    draw.text((col*640+8,row*390+7),f"{room} | {pitch} | {v['file']} | {label}",fill=(0,0,0))
    canvas.paste(part.resize((640,360)),(col*640,row*390+30))
  slug=re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',room).encode('ascii','ignore').decode().lower()).strip('-')
  canvas.save(sheets/(slug+'.jpg'),quality=94)
 package('composicao-preview',[out/'decisao.json',out/'eval.json',out/'analise-ambientes/metricas-por-ambiente.json',out/'apartamento-composicao.sog']+list(sheets.glob('*.jpg')))
 package('composicao-modelo',[out/'gaussians.pt',out/'decisao.json',cfg,root/'poligonos-comodos.json',root/'avaliar-composicao.py'])
if __name__=='__main__':
 try:
  if '--self-test' in sys.argv: self_test()
  else: main(); (root/'composicao-concluida').touch()
 except Exception:
  text=traceback.format_exc(); (root/'falha-composicao.txt').write_text(text); print(text,flush=True); raise
