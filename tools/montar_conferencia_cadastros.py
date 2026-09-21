from pathlib import Path
import json
r=Path('v1.5/renderizador-v16-moveis');p=Path('relatorios/modelos-cadastrados/conferencia.html')
a=json.loads(Path('modelos_cadastrados/estudos.json').read_text(encoding='utf-8'))
s='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conferência dos exteriores</title><style>'+ (r/'estilo.css').read_text(encoding='utf-8')+'</style><body style="background:#263625;padding:32px"><h1>Exteriores dos cadastros</h1>'
s+=''.join('<button style="margin:12px;padding:18px" onclick="ListingModels.open(\''+x['id']+'\')">'+x['title']+'</button>' for x in a['assets'])
s+='<script type="application/json" id="__listingModels">'+json.dumps(a)+'</script><script>'+ (r/'lib/three.min.js').read_text(encoding='utf-8')+'</script><script>'+ (r/'listing-models.js').read_text(encoding='utf-8')+'</script></body></html>'
p.write_text(s,encoding='utf-8')
