"""Acompanha esta execução e preserva resultados fora da máquina alugada."""
import datetime
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import time

ROOT = Path(__file__).resolve().parent
BASE = ROOT/'execucao-servidor'
BASE.mkdir(exist_ok=True)
KEY = Path.home()/'.ssh/id_ed25519_gpu'
SSH = ['ssh','-i',str(KEY),'-o','BatchMode=yes','-o','ConnectTimeout=15','-p','24112','root@js2.blockelite.cn']
SCP = ['scp','-i',str(KEY),'-o','BatchMode=yes','-o','ConnectTimeout=15','-P','24112']
REMOTE = '/root/liv-corrigido-20261016'
DEADLINE = datetime.datetime(2026,10,17,7,41,tzinfo=datetime.timezone.utc)
SOURCE_SHA = 'fb1cdfb78b9d0635c78113a1899e9497558a46b739c9291b7b01756fa2db6b82'
STATUS = r'''
import datetime,json
from pathlib import Path
p=Path('/root/liv-corrigido-20261016')
files=[f for f in (p/'dataset/images').glob('f*.png') if '.partial.' not in f.name]
data=json.loads((p/'dataset/plano-captura.json').read_text())
def tail(name):
    f=p/name
    return f.read_text(errors='replace')[-1600:] if f.exists() else ''
print(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
'source_sha256':data['source_sha256'],'renders':len(files),'total':len(data['dataset']['frames']),
'recent_render_times':sorted(f.stat().st_mtime for f in files)[-100:],
'archives':[str(f) for f in (p/'backups').glob('*.tgz')],
'models':[str(f) for f in (p/'model-backups').glob('*.tgz')],
'render_done':(p/'render-completo').exists(),'train_done':(p/'treino-completo').exists(),
'eval_done':(p/'avaliacao-completa').exists(),'done':(p/'pipeline-concluido').exists(),
'failed':(p/'falha-pipeline.txt').exists(),
'checkpoints':[str(f) for f in (p/'treino').glob('**/step-*.ckpt')],
'render_tails':[tail('render-0.log'),tail('render-1.log')],
'train_tail':tail('treino.log'),'pipeline_tail':Path('/root/liv-corrigido-pipeline.log').read_text(errors='replace')[-1600:]}))
'''

images = BASE/'dataset/images'
images.mkdir(parents=True,exist_ok=True)
for image in (ROOT/'dataset/images').glob('f*.png'):
    if not (images/image.name).exists(): shutil.copy2(image,images/image.name)

def download(remote, target):
    if target.exists(): return
    assert remote.startswith(REMOTE+'/')
    partial = target.with_suffix(target.suffix+'.partial')
    result = subprocess.run(SCP+['root@js2.blockelite.cn:'+remote,str(partial)],capture_output=True,timeout=900)
    if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace')[-500:])
    partial.replace(target)
    print('BAIXADO',target.name,target.stat().st_size,flush=True)

def extract(archive):
    marker = archive.with_suffix('.extraido')
    if marker.exists(): return
    allowed = {'dataset','treino','resultado','treino.log','export.log','avaliacao.log','render-0.log','render-1.log'}
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            parts = PurePosixPath(member.name).parts
            if not parts or parts[0] not in allowed or '..' in parts or member.issym() or member.islnk():
                raise ValueError('Caminho inesperado no backup')
        tar.extractall(BASE,filter='data')
    marker.touch()

while datetime.datetime.now(datetime.timezone.utc) < DEADLINE:
    try:
        result = subprocess.run(SSH+['python3.11 -'],input=STATUS,text=True,capture_output=True,timeout=40,check=True)
        state = json.loads(result.stdout)
        assert state['source_sha256'] == SOURCE_SHA, 'Fonte remota diferente'
        for remote in sorted(state['archives']+state['models']):
            target = BASE/PurePosixPath(remote).name
            download(remote,target)
            extract(target)
        state['local_images'] = len(list(images.glob('f*.png')))
        state['rental_deadline_brasilia'] = '2026-10-17T04:46:54-03:00'
        (BASE/'status-remoto.partial.json').write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
        (BASE/'status-remoto.partial.json').replace(BASE/'status-remoto.json')
        print(json.dumps({k:state[k] for k in ('utc','renders','local_images','render_done','train_done','eval_done','failed')},ensure_ascii=False),flush=True)
        if state['done']:
            target = BASE/'resultado-final.tgz'
            download(REMOTE+'/resultado-final.tgz',target)
            extract(target)
            print('RESULTADO-FINAL-PRESERVADO',flush=True)
            break
    except Exception as error:
        detail = getattr(error,'stderr',None)
        print('RETRY',str(detail or error)[-500:],flush=True)
    time.sleep(40)
