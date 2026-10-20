# Correções da auditoria e simplificação do LIV — 12/10/2026

Atualização posterior: a navegação das plantas e do Tour passou a depender do apartamento selecionado, conforme a nova direção solicitada. O comportamento atual e a validação final de 82 testes estão em [LIV: fluxo por apartamento](liv-fluxo-por-apartamento-2026-10-12.md). O texto abaixo registra a primeira etapa das correções.

Direção confirmada: simplificar o LIV e conservar o tema escuro. A página volta a apresentar uma sequência clara: explorar a maquete, selecionar um apartamento, consultar sua ficha e abrir a planta ou o Tour. As referências gerais continuam acessíveis quando não existe associação com uma unidade.

## Correções dos cinco achados

| Achado da auditoria | Resultado |
|---|---|
| Pacote abortava pelo bake obsoleto de Meio | O gerador respeita `native-factories/dynamic`. Selecionar `approved-rgbm` exige um bake válido; gerar somente Canto conserva Meio quando os recursos compartilhados não mudam. |
| Plantas e Tour ficavam inacessíveis na entrada padrão | Maquete, Planta 2D, Planta 3D e Tour têm uma navegação permanente. O seletor Canto/Meio aparece nos interiores. |
| Dados opcionais inválidos bloqueavam cena e retry | Comercial, vínculos e configuração de estoque são consultados depois da primeira cena utilizável. Falhas preservam a cena e o último payload validado; nova navegação consulta novamente. A descoberta do estoque por `propertyId` configurado funciona sem parâmetro de URL. |
| Mobiliário validava dimensões diferentes das exibidas | Estilo e cor são escolhidos antes do layout. Largura mínima, ocupação, circulação e exportação usam a biblioteca canônica. A poltrona `nuvem` mede 1,18 m e respeita a face da parede no canto. |
| Minificador apagava conteúdo de strings | Removida a limpeza genérica de comentários sobre o JavaScript inteiro. A minificação mantém template literals e `String.raw`. |

## Aparência e organização

- Maquete em destaque, com filtro de disponibilidade fora do modelo.
- Câmera, pavimento e iluminação agrupados e recolhidos por padrão.
- Controles dos interiores mudam conforme Planta 3D ou Tour; navegação por ambientes usa as rotas reais.
- Título identifica o apartamento apenas quando sua associação coincide com a planta exibida. Referências gerais são identificadas como tal.
- Ficha reorganizada, com informações alinhadas e referência do empreendimento em seção expansível.
- Tema escuro, contraste, foco de teclado e controles de pelo menos 44 px. No celular, opções ficam abaixo da cena.

Arquivos de interface: `maquete-liv-ipanema.html`, `viewer-ui.css`, `unit-ui.css` e `interior.html`, em `experimentos/liv-ipanema-webgpu-2026-10-09/`. A nova folha de estilos entra automaticamente no inventário da entrega; o inventário real foi verificado com 238 arquivos.

## Validação

| Verificação | Resultado |
|---|---|
| `npm test` na raiz | 303 testes: 302 passaram, um ignorado, zero falhas. |
| `npm run test:py` na raiz | 337 testes: 335 passaram e duas falhas preexistentes, descritas abaixo. |
| Suíte Node completa do LIV | 70 testes passaram. Após a revisão, as nove regressões finais do viewer e 13 testes de comercial/vínculos/estoque passaram. |
| Pacote, reprodução e entrega LIV | 29 testes passaram. Geração exercitada em diretórios temporários. |
| Mobiliário e minificador | Regressões Python e JavaScript passaram; geometria real de Three.js conferida para todos os estilos e fallback, além de nove sondas do demo. |
| Navegador real, WebGL | Maquete, plantas Canto/Meio, corte de paredes, Tour, navegação para Sala integrada, ficha pela fachada, abertura da planta associada e abertura/retorno do mapa conferidos. |
| Responsividade | 320, 768, 1024 e 1440 px, sem rolagem horizontal; botões de modos com 44 px de altura. |
| Revisão independente | Uma regressão na descoberta do estoque foi encontrada, corrigida e coberta por testes; nenhum outro achado concreto. |
| `git diff --check` | Sem erros de whitespace. |

As duas falhas gerais de Python continuam sendo `test_every_image_is_classified` (142 imagens versionadas sem classificação) e `test_no_unclassified_large_file` (dois `runtime.json` acima de 1 MiB sem exceção). Ambas já existiam em `HEAD`, conforme a auditoria. As pendências anteriores de dependências também permanecem registradas no relatório original.

Prévia local: `http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio&backend=webgl`.

Capturas: `C:/Users/respawn/.codex/visualizations/2026/10/12/01a1311e-28a6-7871-82c2-c70259fc03b9/liv-layout-desktop.jpg` e `liv-layout-mobile.jpg` na mesma pasta.

As alterações estão locais, sem commit ou publicação. Os hashes reais de bake e os artefatos de mobiliário foram preservados.
