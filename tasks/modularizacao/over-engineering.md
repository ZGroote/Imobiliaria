# Revisão de complexidade — 15/09/2026

Escopo: módulos criados em `pipeline/build`, `core`, `world`, `scene`, `materials`, seus consumidores e testes desta modularização. Revisão com a skill ponytail-review. Os dois achados abaixo foram corrigidos após autorização do usuário, no commit `35fcefb`.

- Corrigido — `tests/browser_snapshot.py` (antigo L1): delete: segundo capturador de câmera fixa, 99 linhas, sem consumidor ativo encontrado. Usar `tests/browser_realtime.mjs`, que já captura a mesma cena, registra métricas e verifica a API; seus tempos usam relógio real.
- Corrigido — `renderizador-v16-moveis/materials/roads.js:L92`: delete: parâmetro `mul` herdado do monólito, sem leitura na função. Trocar `matVia(cor, mul, calcada)` por `matVia(cor, calcada)` e remover o argumento nas duas chamadas e no teste. Economia de argumentos, não de linhas.

net: -99 lines applied.

## Estrutura mantida

Não encontrei necessidade de um framework de módulos, contêiner de injeção, barramento de eventos ou classes base. Nenhum deles foi introduzido. As fábricas existentes recebem dados já usados: configuração/quantização, uniformes de cena, acesso a storage e texturas. O terreno possui estado mutável próprio; geometria e classificação são funções compartilhadas pelas auditorias. O manifesto atende ao HTML offline já distribuído e preserva a ordem de inicialização.

`getNoise` em fachadas preserva uma dependência inicializada mais tarde pelo consumidor. Retirá-lo isoladamente causaria acesso antes da inicialização; pode desaparecer quando o GLSL compartilhado mudar de dono, sem criar um novo sistema de resolução de dependências.

Os testes de shader usam o código de um commit fixo como oráculo da migração. Essa comparação tem propósito durante a extração e exige histórico Git local. Não substitui os testes funcionais nem demonstra, sozinha, que todo o monólito está correto.

Esta revisão cobre os arquivos gerados nesta migração; não é uma auditoria de complexidade dos 10 mil arquivos de dados, históricos e demais fontes do acervo. O capturador duplicado foi excluído, e a API de `matVia` e seus consumidores foram ajustados. Os quatro testes de shader de via passaram após a simplificação.
