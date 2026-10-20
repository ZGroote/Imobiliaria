"""Preserva a experiência global antes de encerrar o aluguel autorizado."""
import datetime
import json
from pathlib import Path
import shlex
import subprocess
import tarfile
import time

base=Path(__file__).resolve().parent/'global-contexto'
key=str(Path.home()/'.ssh/id_ed25519_gpu')
ssh=['ssh','-i',key,'-o','BatchMode=yes','-o','ConnectTimeout=12','-p','31828','root@js1.blockelite.cn']
scp=['scp','-i',key,'-o','BatchMode=yes','-P','31828']
query="""
import json,datetime
from pathlib import Path
p=Path('/root/liv-global')
files=[p/n for n in ('resultado.tgz','checkpoint.tgz')]
if not (p/'resultado.tgz').exists(): files.insert(0,p/'exportado.tgz')
files+=list((p/'model-backups').glob('*.tgz'))
print(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
'archives':[str(f) for f in files if f.exists()],
'pipeline':Path('/root/liv-global.log').read_text(errors='replace')[-2200:] if Path('/root/liv-global.log').exists() else '',
'train':(p/'treino.log').read_text(errors='replace')[-1800:] if (p/'treino.log').exists() else '',
'compatibility':json.loads((p/'comparacao-resultado.json').read_text()) if (p/'comparacao-resultado.json').exists() else None}))
"""
while datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,15,22,11,tzinfo=datetime.timezone.utc):
    try:
        state=json.loads(subprocess.run(ssh+['python3.11 -c '+shlex.quote(query)],capture_output=True,check=True,timeout=30).stdout)
        (base/'status-remoto.json').write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
        print(state['utc'],state['archives'],state['compatibility'],flush=True)
        for remote in state['archives']:
            local=base/Path(remote).name
            if local.exists(): continue
            partial=local.with_suffix('.tgz.partial')
            result=subprocess.run(scp+['root@js1.blockelite.cn:'+remote,str(partial)],capture_output=True,timeout=300)
            if result.returncode: raise RuntimeError(result.stderr.decode(errors='replace')[-500:])
            partial.replace(local)
            print('BAIXADO',local.name,local.stat().st_size,flush=True)
            if local.name=='resultado.tgz':
                with tarfile.open(local) as tar: tar.extractall(base,filter='data')
        if (base/'resultado.tgz').exists() and (base/'checkpoint.tgz').exists():
            print('GLOBAL-PRESERVADO',flush=True)
            break
    except Exception as error: print('RETRY',str(error)[-500:],flush=True)
    time.sleep(25)
