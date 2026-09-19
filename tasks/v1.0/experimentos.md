# Tentativas de melhoria do produto

Estado inicial: nenhum experimento abaixo foi executado. Cada linha é uma hipótese.
Conservar cenário, unidade, tamanho da tela, câmera, hardware e rede na comparação.

| ID | Hipótese | Comparação | Decisão e evidência necessária |
| --- | --- | --- | --- |
| E01 | Aérea ortográfica ajuda a reconhecer localização | Atual versus ortográfica, depois transparência e rotação separadamente | Identificar o imóvel sem ajuda; não esconder ruas/POIs; registrar imagens, FPS e preferência do teste. |
| E02 | Planta 2D facilita entender cômodos | Wireframe versus paredes preenchidas com rótulos/medidas | Encontrar sala, quartos e acesso sem instrução; legibilidade em 390 px; escolha fundamentada. |
| E03 | Abrir só a unidade reduz espera | Recorte atual versus unidade sem entorno inicial | Bytes transferidos, tempo até interação, memória e falhas em cinco cargas frias/quentes. |
| E04 | Duplo toque acelera troca de modo | Botões explícitos versus atalho adicional | Sem seleção ou entrada acidental; não competir com gestos de zoom; botões continuam disponíveis. |
| E05 | Cache offline melhora retorno sem causar versão presa | Cache HTTP versus service worker com atualização | Funciona offline após download concluído; atualização e rollback testados; limite de armazenamento. |
| E06 | Entorno menor ajuda aparelhos fracos | Qualidade adaptativa atual versus raio reduzido | Menor custo de quadro, sem perder a unidade, sem mudança abrupta e sem piorar navegação. |

## Registro de cada execução

- ID e estado: planejado / em teste / adotado / rejeitado / inconclusivo.
- Problema observado e hipótese mensurável.
- Hash do artefato e do cadastro, imóvel, câmera, aparelho, navegador e perfil de rede.
- Controle anterior; mudança isolada; imagens ou vídeo equivalentes.
- Cinco amostras quando medir tempo: mediana, pior amostra e bytes de transferência.
- Resultado qualitativo de quem testou: tarefa concluída, erro, necessidade de ajuda.
- Decisão e justificativa; arquivos alterados; como retornar ao comportamento anterior.

Uma imagem mais bonita não aprova regressão de navegação, dados ou carregamento.
Falha/inconclusivo fica documentado; não substituir por estimativa apresentada como medição.
