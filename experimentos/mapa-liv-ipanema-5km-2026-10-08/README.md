# Liv Ipanema: mapa regional de São Carlos

Experimento iniciado em 08/10/2026, revisado em 09/10/2026. A versão
`strict-circle-v3` prepara os dados antes do download e inclui a maquete completa.

- [Mapa de teste](https://imobilaria-deccb-miniaturas--liv-mapa-5km-20261008-onn3ia42.web.app/mapa-liv-ipanema-5km.html)
- [Maquete completa](https://imobilaria-deccb-miniaturas--liv-mapa-5km-20261008-onn3ia42.web.app/maquete-liv-ipanema.html)

O canal temporário Firebase é `liv-mapa-5km-20261008`. A expiração exata consta
em `deploy.json`. Somente esse canal recebe a publicação experimental.

## Comportamento

O navegador recebe um pacote com **raio de 5 km** centrado no empreendimento:
aproximadamente 78,54 km². A origem municipal é preservada para manter todos
os dados no mesmo sistema de coordenadas.

Polígonos, linhas e superfícies que atravessam a borda são cortados antes da
publicação. Modelos são mantidos quando seu envelope transformado cabe no
círculo. O renderizador também verifica as geometrias geradas, inclusive
telhados, árvores, portões e sprites. A borda usa um polígono inscrito de
720 lados, com desvio máximo de 4,8 cm para dentro do círculo.

O chão é contínuo em todo o círculo de 5 km, incluindo campos e áreas vazias.
A malha nasce de células regionais recortadas antes de criar os buffers: o
fundo de toda a cidade não é construído. Mantém relevo, cor NDVI e folga sob
as ruas e os quarteirões. Os tiles de quintais também são reescritos e contêm
apenas parcelas e superfícies internas. O catálogo original não é publicado.

NDVI e elevação transmitem somente amostras internas, em formato
`regional-raster-sparse-v2`, sem margem externa. Para compatibilidade com o
renderizador, as grades municipais ainda são reconstruídas em memória;
amostras ausentes de elevação usam o valor da amostra interna mais próxima.

O relevo começa ligado e permanece ligado. A interface remove a inspeção de
imóveis, o menu de ruas/relevo/gráficos e a comparação com o mapa completo.
O cabeçalho mantém Centralizar e Abrir maquete. A busca “O que tem por perto?”
filtra o catálogo local por categoria e nome, ordena por distância em linha
reta do LIV e destaca o lugar selecionado no mapa. Não faz consultas externas.
A miniatura oferece Maquete completa, Planta 2D, Planta 3D e Tour 3D, mantendo
sempre a implantação completa ao retornar à vista externa. O link de entrada
passou a se chamar “O que tem por perto?”.

A seção “Fotos comparativas e referências” foi removida da página pública,
incluindo suas imagens embutidas e os links de produção dessa seção. A
miniatura passou de 53.580.517 para 38.378.801 bytes. Maquete, plantas, tour,
câmeras e captura continuam disponíveis.

## Medições do pacote

| Dados | Fonte completa | Pacote estrito |
| --- | ---: | ---: |
| Prédios | 89.895 | 40.340 |
| Quadras | 3.876 | 1.862 |
| Pontos de interesse | 931 | 614 |
| Arquivos de quintais | 239 | 120 |
| Triângulos de quintais | 848.591 | 383.779 |
| Amostras NDVI transmitidas | 262.144 | 56.828 |
| Amostras de elevação transmitidas | 6.400 | 1.352 |

O HTML passou de 13.957.621 para **8.046.477 bytes: redução de 42,35%**.
Os arquivos de quintais passaram de 16.668.620 para **7.539.060 bytes**.
O GLB completo tem 2.989.904 bytes e é carregado separadamente.
Os números exatos ficam em `medicoes.json`. O envelope conservador desse
relatório inclui margens de diagnóstico e não representa vértices exportados.

Estas são medições de transferência e contagens de geometria. Não foi feito
benchmark comparável de FPS ou memória total. A consulta espacial ao banco
municipal continua como etapa posterior; o piloto usa o snapshot disponível.

## Maquete e implantação

O GLB canônico contém torre, piscina, vegetação, portaria e demais áreas do
condomínio. SHA-256:
`f3bef61c2a844aae0062b1c15df7ebb942ed188c572ba455b8cddd86d57fadf1`.
As 1.825 malhas são agrupadas em 87 lotes de instâncias, preservando geometria,
materiais e transformações. A miniatura independente mantém suas 56 malhas,
incluindo as 43 malhas da implantação.

O terreno é nivelado sob a implantação, com transição externa de 12 m.
Alturas a 250 m permanecem iguais à fonte. O piso fica 0,40 m acima do
terreno nivelado para superar offsets das superfícies, mantendo a base embutida.

Centro: `-21.988640293284593, -47.921966616665976`, referência do mapa divulgado
pela Livon. É uma posição aproximada para o piloto; o centro de visualização
não comprova a posição cadastral. A maquete usa escala 1 m por unidade,
giro de −60° e deslocamento local `[8, -6]` m. Implantação cadastral exige
conferência com a planta georreferenciada.

## Reprodução

Na raiz do repositório, com Python, Shapely, Node.js e Chrome disponíveis:

```powershell
python experimentos/mapa-liv-ipanema-5km-2026-10-08/gerar_mapa.py
python experimentos/mapa-liv-ipanema-5km-2026-10-08/preparar_site.py --mapa experimentos/mapa-liv-ipanema-5km-2026-10-08/mapas-v3/mapa-liv-ipanema-5km.html --destino experimentos/mapa-liv-ipanema-5km-2026-10-08/site-v3 --recursos experimentos/mapa-liv-ipanema-5km-2026-10-08/mapas-v3/quintais
python -m unittest discover -s experimentos/mapa-liv-ipanema-5km-2026-10-08 -p test_recorte_regional.py
python -m unittest discover -s experimentos/mapa-liv-ipanema-5km-2026-10-08 -p test_tiles_circulares.py
node experimentos/mapa-liv-ipanema-5km-2026-10-08/test_raster_esparso.mjs
node experimentos/mapa-liv-ipanema-5km-2026-10-08/test_liv_terreno.mjs
node experimentos/mapa-liv-ipanema-5km-2026-10-08/test_chao_circular.mjs
node experimentos/mapa-liv-ipanema-5km-2026-10-08/test_busca_proximos.mjs
python -m http.server 8788 --bind 127.0.0.1 --directory experimentos/mapa-liv-ipanema-5km-2026-10-08/site-v3
```

Em outro terminal:

```powershell
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_mapa.py --saida experimentos/mapa-liv-ipanema-5km-2026-10-08/qa-local-v3
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_miniatura.py --saida experimentos/mapa-liv-ipanema-5km-2026-10-08/qa-miniatura-local-v3
python experimentos/mapa-liv-ipanema-5km-2026-10-08/auditar_dados.py
```

Após a validação local, atualizar exclusivamente o canal de teste:

```powershell
.\node_modules\.bin\firebase.cmd hosting:channel:deploy liv-mapa-5km-20261008 --expires 7d --no-authorized-domains --config experimentos/mapa-liv-ipanema-5km-2026-10-08/firebase.experimento.json --project imobilaria-deccb --non-interactive --json
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_mapa.py --base-url https://imobilaria-deccb-miniaturas--liv-mapa-5km-20261008-onn3ia42.web.app --saida experimentos/mapa-liv-ipanema-5km-2026-10-08/qa-publica-v3
python experimentos/mapa-liv-ipanema-5km-2026-10-08/qa_miniatura.py --base-url https://imobilaria-deccb-miniaturas--liv-mapa-5km-20261008-onn3ia42.web.app --saida experimentos/mapa-liv-ipanema-5km-2026-10-08/qa-miniatura-publica-v3
python experimentos/mapa-liv-ipanema-5km-2026-10-08/verificar_http.py --base-url https://imobilaria-deccb-miniaturas--liv-mapa-5km-20261008-onn3ia42.web.app
```

## Fontes e validação

- Snapshot: `v16-moveis/publicado/mapa/sao-carlos-exteriores-f16b0250b705.html`.
- Maquete: `v1.5/miniaturas/liv-ipanema/`.
- Dados e tiles: `recorte_regional.py`, `tiles_circulares.py`, `raster-regional.js`.
- Geometria no navegador: `app_estrito.py`, `limite-circular.js`, `liv-terreno.js`.
- Interface e busca: `mapa-interface.js`, `busca-proximos.js`, `preparar_site.py`.
- Chão contínuo: `chao-circular.js`.
- Integração GLB: `maquete-no-mapa.js`, `inserir-maquete.js`.
- [GLTFLoader oficial r128](https://github.com/mrdoob/three.js/blob/r128/examples/js/loaders/GLTFLoader.js), licença MIT em `vendor/THREE-LICENSE.txt`, validado com o Three.js r168 do snapshot.

A QA verifica computador e celular, miniatura → mapa, implantação completa,
planta e tour navegáveis, busca por categorias, ausência de sobreposição,
relevo permanente, chão contínuo, vértices na borda e downloads
limitados ao catálogo estrito. A verificação HTTP compara hashes dos arquivos
e exige 404 para o mapa completo e o catálogo municipal anterior.
Os relatórios `qa-*-v3/runtime.json`, `http-verificado.json` e
`validacao-publica.json` devem ser conferidos junto à data e versão da execução.

Publicação de 09/10/2026: **PASS em computador e celular emulado**, tanto no mapa
quanto nos modos da miniatura. Planta 2D, Planta 3D, Tour 3D e retorno ao conjunto
completo testados com cliques e gestos reais. Busca testada por categoria, nome,
resultado destacado, ausência de resultados e teclado. Também verificada a
lista em larguras de 320 e 768 px.

O chão circular cobre mais de 99,995% da área matemática do disco (a pequena
margem restante é a borda inscrita). A geometria de base tem 23.575 vértices e
45.292 triângulos antes do refinamento local do assentamento. Todos os vértices
ativos e arquivos geográficos permaneceram no limite de 5 km; nenhum download
externo ao catálogo regional foi observado. Zero erros de página ou falhas HTTP.
Os hashes do HTML, da miniatura, do GLB e de um tile foram conferidos online.
O mapa completo e os prefixos anteriores retornam HTTP404. Evidências em
`qa-publica-v3/`, `qa-miniatura-publica-v3/` e `qa-dados-v3/`.

O canal temporário expira em 16/10/2026.
