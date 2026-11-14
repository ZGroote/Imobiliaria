from pathlib import Path
import sys,time,json,datetime
root=Path('/root/liv-corrigido-20261016')
name=sys.argv[1]
assert name in ['denso16-preview','denso16-modelo','denso16-capturas','ensaios-comodos-modelos','composicao-preview','composicao-modelo']
limit=datetime.datetime(2026,10,17,7,35,tzinfo=datetime.timezone.utc).timestamp()
while not (root/(name+'.json')).exists():
 if (root/'falha-denso16.txt').exists() or (root/'falha-download-denso16.txt').exists(): sys.exit(42)
 if name.startswith('composicao') and (root/'falha-composicao.txt').exists(): sys.exit(45)
 if name=='composicao-modelo' and (root/'composicao-concluida').exists(): sys.exit(44)
 if name in ['denso16-capturas','ensaios-comodos-modelos'] and (root/'falha-backups-extras.txt').exists(): sys.exit(46)
 if time.time()>limit: sys.exit(43)
 time.sleep(20)
print((root/(name+'.json')).read_text(),flush=True)

