import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

archive = Path('/root/liv-corrigido-20261016.zip')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == 'b87a49bf1ec2a96898417088f788333040d1749117dcd725cee90d50b1d8bb49'
root = Path('/root/liv-corrigido-20261016')
root.mkdir(exist_ok=False)
with zipfile.ZipFile(archive) as z:
    manifest = json.loads(z.read('manifesto.json'))
    assert all(hashlib.sha256(z.read(name)).hexdigest() == sha for name, sha in manifest.items())
    z.extractall(root)

for name, command in (
    ('blender-install', ['bash','/root/instalar-servidor.sh']),
    ('treino-install', ['bash','-c','while [ ! -f /root/liv-base-pronta ]; do sleep 5; done; bash /root/instalar-treino-remoto.sh']),
):
    with open('/root/liv-'+name+'.log','wb') as log:
        process = subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT,stdin=subprocess.DEVNULL,start_new_session=True)
    print(name, process.pid, flush=True)
print('PACOTE-VERIFICADO-EXTRAIDO', len(manifest), flush=True)
