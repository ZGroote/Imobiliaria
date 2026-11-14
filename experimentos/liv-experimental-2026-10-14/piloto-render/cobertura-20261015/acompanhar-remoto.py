"""Acompanha esta execução autorizada e baixa os lotes concluídos durante o aluguel."""
import datetime
import json
from pathlib import Path
import shlex
import subprocess
import tarfile
import time

BASE = Path(__file__).resolve().parent / 'piloto-2h'
BASE.mkdir(exist_ok=True)
KEY = Path.home()/'.ssh/id_ed25519_gpu'
SSH = ['ssh','-i',str(KEY),'-o','BatchMode=yes','-o','ConnectTimeout=15','-p','31828','root@js1.blockelite.cn']
SCP = ['scp','-i',str(KEY),'-o','BatchMode=yes','-P','31828']
STATUS = '''
import datetime,json
from pathlib import Path
p=Path('/root/liv-2h')
log=p/'treino.log'
text=log.read_text(errors='replace')[-1800:] if log.exists() else ''
print(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
'renders':len([f for f in (p/'dataset/images').glob('f*.png') if '.partial.' not in f.name]),
'archives':[str(f) for f in (p/'backups').glob('*.tgz')],
'models':[str(f) for f in (p/'model-backups').glob('*.tgz')],
'render_done':(p/'render-completo').exists(),'train_done':(p/'treino-completo').exists(),
'checkpoints':[str(f) for f in (p/'treino').glob('**/*.ckpt')],
'final_archive':Path('/root/liv-2h-resultado.tgz').exists() and 'PIPELINE-CONCLUIDO' in Path('/root/liv-2h-pipeline.log').read_text(errors='replace'), 'train_tail':text}))
'''

def baixar(remote, destino):
    if destino.exists(): return
    parcial = destino.with_suffix(destino.suffix+'.partial')
    result = subprocess.run(SCP+['root@js1.blockelite.cn:'+remote,str(parcial)],capture_output=True,timeout=240)
    if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace')[-500:])
    parcial.replace(destino)
    print('BAIXADO',destino.name,destino.stat().st_size,flush=True)

deadline = datetime.datetime(2026,10,15,22,10,tzinfo=datetime.timezone.utc)
while datetime.datetime.now(datetime.timezone.utc) < deadline:
    try:
        result = subprocess.run(SSH+['python3.11 -c '+shlex.quote(STATUS)],capture_output=True,timeout=35,check=True)
        state = json.loads(result.stdout)
        (BASE/'status-remoto.json').write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({k:state[k] for k in ('utc','renders','render_done','train_done','checkpoints')},ensure_ascii=False),flush=True)
        for remote in sorted(state['archives']):
            local = BASE/Path(remote).name
            baixar(remote,local)
            marker = local.with_suffix('.extraido')
            if not marker.exists():
                with tarfile.open(local) as tar:
                    if not all(m.name.startswith('dataset/') for m in tar.getmembers()): raise ValueError('Arquivo de backup inesperado')
                    tar.extractall(BASE,filter='data')
                marker.touch()
        for remote in sorted(state['models']):
            baixar(remote,BASE/Path(remote).name)
        if state['final_archive']:
            baixar('/root/liv-2h-resultado.tgz',BASE/'resultado-remoto.tgz')
            print('RESULTADO-LOCAL-SALVO',flush=True)
            break
    except Exception as error:
        detail = getattr(error,'stderr',None)
        print('RETRY',detail.decode(errors='replace')[-500:] if detail else str(error)[-160:],flush=True)
    time.sleep(35)
