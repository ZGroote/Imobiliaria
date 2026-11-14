"""Promove a saída validada após comprovar que só os giros da mobília mudaram."""
from pathlib import Path
import hashlib
import json
import shutil
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[4]))
from pipeline.editor_state import validar_editor_state
from pipeline.validar_leitura import validar

ROOT=Path(__file__).resolve().parent
old_dir=ROOT/'previa'
new_dir=ROOT/'previa-rotacoes'
old=json.loads((old_dir/'unidade.json').read_text(encoding='utf-8'))
new=json.loads((new_dir/'unidade.json').read_text(encoding='utf-8'))
before=hashlib.sha256((old_dir/'unidade.json').read_bytes()).hexdigest()
after=hashlib.sha256((new_dir/'unidade.json').read_bytes()).hexdigest()
old_geometry=json.loads((old_dir/'relatorio.json').read_text())['geometria']['sha256']
new_report=json.loads((new_dir/'relatorio.json').read_text())
assert old_geometry==new_report['geometria']['sha256']
old_f=old['planta']['moveis']
new_f=new['planta']['moveis']
assert len(old_f)==len(new_f)==29
changes=[]
for i,(a,b) in enumerate(zip(old_f,new_f)):
    assert {k:v for k,v in a.items() if k!='rot'}=={k:v for k,v in b.items() if k!='rot'}
    footprint=lambda m:(m['w'],m['d']) if m['rot']%2==0 else (m['d'],m['w'])
    assert footprint(a)==footprint(b),(i,a,b)
    if a['rot']!=b['rot']:
        changes.append({'index':i,'name':b.get('nome'),'oldRot':a['rot'],'newRot':b['rot']})
old['planta']['moveis']=new_f
assert old==new
leitura=json.loads((ROOT/'leitura.json').read_text(encoding='utf-8'))
editor=json.loads((ROOT/'projeto-planta.json').read_text(encoding='utf-8'))
errors=validar(leitura)+validar_editor_state(leitura,editor)
assert not errors,errors
for name in ('unidade.json','relatorio.json','maquete.html'):
    shutil.copy2(new_dir/name,old_dir/name)
proof={'valid':True,'unitSHA256Before':before,'unitSHA256':after,
       'architectureGeometrySHA256':old_geometry,'footprintsPreserved':True,
       'changes':changes,'editorStateValid':True,'E2EGeometryVerified':new_report['geometria']['conferida']}
(ROOT/'rotacoes-validadas.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(proof,ensure_ascii=False))
