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

Ainda pendentes para completar a caracterização da tarefa 01: desempenho com câmera fixa, imagem de referência e QA completo por variante. O plano não considera a baseline comportamental completa enquanto esses resultados não forem registrados.
