# Fontes e geração das maquetes

Existem dois runtimes. A prévia LEVE (`python -m pipeline.gerar_maquete`) passa por
`e2e_leitura.py` e `v1.5/miniaturas/pagina_maquete.py`; o PREMIUM do Cedros usa as
fontes aprovadas em `padrao-atual/`. Esses caminhos não usam o renderer experimental
do LIV nem o cache de iluminação por horário. Não copiar bundles modernos nesses templates.

Os pacotes modernos do LIV e do Parque das Laranjeiras usam as fontes em
`experimentos/liv-experimental-2026-10-14/` e `experimentos/laranjeiras-2026-10-30/site/`.
As correções de navegação, propriedade de recursos, geometrias, texturas, iluminação
e transferências estão nessas fontes, e não apenas em arquivos publicados.

Os dois preparadores chamam `pipeline/empacotar_runtime.mjs` para gerar os três
entrypoints com a mesma versão fixada do Three.js. Depois chamam
`python -m pipeline.transfer_manifest`: o manifesto nasce dos catálogos presentes
no pacote, verifica tamanho/SHA dos recursos e inclui móveis e luz por horário.
Atlas estático substituído pelo horário sai da fila; GLBs, mapas e outros horários
ficam sob demanda. Catálogo pequeno e plantas 2D podem antecipar o download.

Gerar novos pacotes em **pastas novas ou vazias**:

```powershell
node experimentos/liv-experimental-2026-10-14/preparar_pacote.mjs <release-base/liv-classico> <destino/liv-classico>
node experimentos/laranjeiras-2026-10-30/publicar/preparar_pacote.mjs <destino/laranjeiras>
```

O LIV preserva dados, HTML e ajustes da release-base indicada. O Laranjeiras monta
o site, as quatro plantas, iluminação e biblioteca aprovada; mantém `noindex`.
Nenhum preparador publica. Os binários ignorados precisam existir e corresponder
aos catálogos; falha de identidade aborta a geração.

Validação das correções:

```powershell
node --test tests/test_maquetes_desempenho.mjs
python -m unittest tests.test_transfer_manifest
python tests/qa_maquete_cache.py --saida <pasta-evidencias>
```

`tools/publicar_desempenho_maquetes.mjs` faz primeiro a conferência do Hosting,
registra versão anterior/inventário/configuração e só publica com `--publicar`.
Conserva conteúdo fora do pacote e os chunks antigos usados por páginas abertas.
O LIV público tem HTML servido por Cloud Function: atualizar os bundles de nome
estável não exige substituir essa função. A reversão verifica se nenhuma outra
sessão publicou depois. Não usar o `firebase.json` da raiz para essas maquetes.

Em 31/10/2026 foram gerados pacotes novos pelos dois comandos, com QA integrado
registrado em `tasks/desempenho-maquetes/plan.md`. A prévia LEVE também foi gerada
pelo seu comando normal, sem alterar o padrão visual do Cedros. Ensaios desktop
e viewport mobile não substituem homologação em aparelho físico.


A revisão da entrada de 31/10 também vive nessas fontes: `shader-scheduler.js`
completa apenas a API de agendamento ausente; cada interior carrega móveis da sua
tipologia e canais de luz com peso positivo; referências de autoria são liberadas
após a montagem. O viewer conserva até dois interiores, salva snapshots no descarte
e recupera falhas iniciais WebGPU em um iframe WebGL novo, uma única vez. Links de
unidades para 2D validam os vínculos sem abrir primeiro o renderer exterior. Sem
GPU, a seleção de apartamentos com planta validada fica disponível no aviso.

Os testes de entrada e recuperação estão em `test_viewer_flow.mjs`, nos testes do
scheduler/iluminação/biblioteca do LIV e em `tests/test_maquetes_desempenho.mjs`.
O desenho interior só é reenviado à GPU quando há mudança; o acompanhamento de
teclado, toque, portas e rotas continua ativo. Esses mecanismos usam as APIs dos
runtimes modernos; o template LEVE usa outro Three e não constrói grafos TSL.
