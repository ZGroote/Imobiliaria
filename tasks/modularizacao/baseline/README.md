# Referência inicial

Checkpoint de fontes: `cbf9722`, branch inicial `main`. Implementação em `refactor/modularizacao`.
Git precisa de `-c safe.directory=C:/Users/respawn/Desktop/imobiliaria` nesta máquina por diferença de proprietário da pasta; nenhuma exceção global foi criada.

252 arquivos de fontes/configuração/plano registrados. Dados geográficos e modelos grandes continuam locais: o commit sozinho não reproduz o acervo completo. `manifest.json` registra caminhos disponíveis e hashes dos quatro HTMLs existentes selecionados; suas cópias estão em `artifacts/`, ignoradas pelo Git. Nada foi enviado a um remoto.

Resultados antes de alterar o renderizador:

- Testes unitários de anúncios: passaram (log local `anuncios.log`).
- Integração de modelos urbanos: passou (`urban.log`).
- São Carlos v16-moveis, duplo clique: passou; entrou em monte-das-colinas-39, 7 cômodos, 32 paredes, 18 móveis.
- Ribeirão Preto v15, duplo clique: passou.
- São Carlos v16-moveis, ficha/perto: uma reprovação anterior à migração, “a busca acende o pino do lugar achado”. Não foi corrigida junto da extração de configuração.
- Araraquara não tinha HTML v15. O script original devolveu sucesso com “0 de 0 páginas”; isso é ausência de teste, não aprovação.

`tests.json` conserva códigos e tempos brutos, inclusive esse falso sucesso de Araraquara. Os tempos incluem navegador/sonda e não são medição de desempenho de quadros.

Na extração de configuração, o montador do checkpoint e o novo montador foram executados sobre os mesmos dados, com carimbo fixo, em São Carlos v16-moveis, Ribeirão Preto v15 e Araraquara v15. Os três HTMLs abertos foram idênticos byte a byte (`config-equivalence.json`). As montagens de referência estão em `../work/<cidade>/before*`; são artefatos de comparação, sem publicação.

QA completo original de São Carlos v16-moveis: 19 portões, duas reprovações preexistentes (UX e ficha/perto), nenhum não medido. Resultado em `qa-before.json`. A matriz comportamental de Ribeirão Preto e Araraquara continua pendente.

Comparação com câmera fixa por Chrome e relógio real: imagens antes/controle/depois idênticas pixel a pixel na extração do decodificador e diagnóstico, 74 grupos, 273 chamadas de desenho e 3.263.632 triângulos. `visual-equivalence.json` registra o resultado. Os tempos variaram entre execuções; não demonstram ganho de desempenho.

Geometria: seis funções comparadas com o checkpoint sobre os 89.895 edifícios, sem diferenças (`geometry-equivalence.json`). Classificação: 1.280 casos de limites idênticos (`classification-equivalence.json`).

QA completo após 04–06 concluído: 19 portões, mesmos resultados, mesmas duas falhas anteriores, zero não medidos (`qa-after.json`, `qa-equivalence.json`).

O artefato isolado em `../work/foundation/` inclui também geometria, armazenamento, terreno e classificação. Imagem fixa idêntica à referência (`foundation-visual-equivalence.json`). Alternância de relevo ligada/desligada/ligada: 11.018 vértices amostrados de 107 geometrias, erro máximo de arredondamento 0,00002984 m (`real-foundation.json`). Sonda no HTML comprimido responde com API v1, cena e elevação válida (`compressed-probe.json`). Duplo clique abre ficha e entra no imóvel monte-das-colinas-39, mantendo 7 cômodos, 32 paredes e 18 móveis (`foundation-interior.json`). O QA completo de 19 portões foi feito no artefato 04–06; estes são testes focados das extrações posteriores, não uma nova execução completa.

O teste de duplo clique agora retorna código 2 se não encontrar a cidade solicitada (`8975867`), eliminando o falso sucesso de 0 páginas.

Lote 10a: `materials/facades.js` recebe Three.js, configuração, texturas, uniforms e acesso tardio ao ruído explicitamente. Quatro combinações de configuração produzem shaders idênticos ao checkpoint `c93bc7b`. Imagem fixa após esta extração idêntica à referência (`materials-visual-equivalence.json`), mantendo as contagens de cena e o teste de relevo (`real-materials.json`). A leitura do ruído continua tardia porque o consumidor inicializa essa constante depois dos materiais.

Verificação rápida final: 12 testes Python e 16 testes Node aprovados. Comandos:

```powershell
python -m unittest discover -s tests -p "test_*.py"
node --test tests/test_city_data.mjs tests/test_diagnostics.mjs tests/test_geometry.mjs tests/test_storage.mjs tests/test_terrain.mjs tests/test_facades.mjs
python pipeline/montar.py sao-carlos --variante v16-moveis --destino tasks/modularizacao/work/materials
node tests/browser_realtime.mjs tasks/modularizacao/work/materials/sao-carlos-v16-moveis.html tasks/modularizacao/baseline/real-materials --diagnostics --terrain
```

Os testes de equivalência de fachada requerem o histórico Git local (checkpoint fixado). Os comandos de navegador usam Chrome instalado e os dados locais. HTMLs de teste continuam isolados, sem deploy.

Os resultados brutos desta rodada também estão reunidos no arquivo versionado `integration-results.json`; `tested-artifacts.json` identifica os HTMLs medidos por SHA-256. As imagens ficam locais.

## Continuação de 15/09

Materiais de pista/calçada extraídos em `8351273`; sete materiais principais do interior e shader do forro em `524756c`. Fontes geradas sem dependências novas. Resultados completos e hashes dos artefatos em `round-20260915.json`.

- 12 testes Python e 21 testes Node aprovados. Os novos testes são `test_road_materials.mjs` (quatro combinações) e `test_interior_materials.mjs` (sete materiais, referências de textura e shader).
- Vias: imagem externa idêntica à referência, mesma geometria de cena e alternância de relevo aprovada no HTML comprimido.
- Interior: HTML comprimido abre ficha e entra em monte-das-colinas-39, com 7 cômodos, 32 paredes e 18 móveis.
- Exposição do interior: ambos os HTMLs abertos passaram nos seis limites existentes; câmera, voo concluído, bake e estado de sombra iguais. Média 129,0414 → 129,0556; faixa 126,0814 em ambos; pixels queimados 0% em ambos. Imagens internas NÃO idênticas: erro médio absoluto de 0,8199 por canal em escala 0–255. As texturas procedurais preservadas no app usam `Math.random`; portanto a captura interna não é determinística e não se exige equivalência pixel a pixel neste registro. A equivalência dos parâmetros, texturas fornecidas e shaders é testada separadamente.
- Não foi repetido o QA completo de 19 portões nesta rodada; as duas falhas históricas continuam registradas como pendências, não como aprovação.

Revisão de complexidade dos arquivos gerados em [../over-engineering.md](../over-engineering.md). Achados: capturador duplicado (99 linhas possíveis de remover) e parâmetro sem uso herdado em `matVia`. Revisão registrada, sem aplicar exclusões. O restante da tarefa 10 e a migração completa continuam em andamento.
