# Auditoria das alterações locais — 12/10/2026

Escopo autorizado: todas as alterações locais, incluindo arquivos novos. Comparação com `HEAD` (`6150044`), na branch `codex/liv-ipanema-webgpu`. Havia 60 arquivos versionados modificados e nenhuma alteração staged. A revisão abrangeu o diff, fontes novas pertinentes e suas integrações; dependências vendorizadas, `.next`, credenciais e evidências históricas geradas não foram revisadas linha por linha.

Foram confirmados cinco problemas nas alterações. Todos são P2: regressões funcionais ou de integridade que devem ser corrigidas antes de depender dos fluxos afetados. Esta auditoria não alterou as fontes nem publicou o projeto.

## 1. Geração dos pacotes de interiores aborta por bake de Meio incompatível

**Local:** [unidade.json:1](../experimentos/liv-ipanema-webgpu-2026-10-09/interiores/meio/unidade.json), [recipe.json:1](../experimentos/liv-ipanema-webgpu-2026-10-09/interiores/meio/recipe.json) e [manifest.json:4](../experimentos/liv-ipanema-webgpu-2026-10-09/interiores/meio/bake/manifest.json).

A unidade e a receita de Meio foram atualizadas para o SHA `3d245c…`, enquanto o manifesto do bake conserva `unitSHA256=537851…`. O gerador continua revalidando os bakes existentes, inclusive o de Meio quando se solicita apenas Canto. A reconstrução aborta em `gerar_pacote_interiores.py:190`.

**Evidência:** dois dos 22 testes Python de pacote/entrega/reprodução falharam nesse ponto. A incompatibilidade afeta a geração das duas tipologias. O catálogo atual usa fábricas nativas e iluminação dinâmica; por isso esta falha de reconstrução não significa que o interior já empacotado deixe de abrir.

**Correção:** reexportar e requalificar o bake de Meio, ou tornar explícito o caminho dinâmico para que o bake obsoleto deixe de participar dessa geração. Atualizar hashes deve decorrer da verificação dos artefatos correspondentes.

## 2. Links padrão perderam o acesso às plantas e ao Tour

**Local:** [maquete-liv-ipanema.html:72](../experimentos/liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html).

Os controles gerais de modo e tipologia passaram para `#legacyControls`, que permanece oculto. A URL padrão usa o catálogo `piloto`, sem associações de planta por unidade; nesse fluxo, as ações de plantas da ficha também ficam ocultas. O visitante consegue abrir a maquete e selecionar apartamentos, mas não entrar nas plantas de referência ou no Tour pelos controles disponíveis.

**Evidência:** reprodução local em Chrome/WebGL com `maquete-liv-ipanema.html?backend=webgl`: `ready=true`, dez unidades e zero botões `[data-mode]` visíveis. Após selecionar unidade, `relation=null` e zero ações `[data-unit-open]` visíveis. O link piloto `?geometria=entrada` documentado no README também é afetado.

**Correção:** oferecer acesso visível às referências gerais quando não houver uma associação de planta por unidade, mantendo a navegação nova para o catálogo completo.

## 3. Dados comerciais inválidos bloqueiam a abertura e o retry

**Local:** [viewer.js:277](../experimentos/liv-ipanema-webgpu-2026-10-09/viewer.js), especialmente atribuição antes da validação e aplicação nas linhas 292–294.

A nova consulta síncrona persiste o JSON em `commercialData` antes de validá-lo. A aplicação por `attachCommercial` ocorre fora do `catch` da consulta. Uma resposta HTTP 200 com revisão incompatível interrompe a criação da cena. A tentativa seguinte reutiliza esse JSON inválido, pois o cache já está preenchido.

**Evidência:** interceptando localmente apenas `comercial.json` com `bookSHA256` antigo, a página ficou com `ready=false`, nenhum iframe e erro de origem/revisão. O botão de retry repetiu o erro sem uma nova consulta. A leitura de vínculos introduz o mesmo padrão de persistência antes da validação.

O contrato em [COMERCIAL.md:19](../experimentos/liv-ipanema-webgpu-2026-10-09/COMERCIAL.md) exige consultar depois da primeira cena utilizável e preservar a última tabela validada, exibindo aviso em falha. O fluxo em `HEAD` atendia esse contrato por meio de `refreshCommercial` e `refreshRelations`.

**Correção:** reutilizar os fluxos de atualização existentes ou validar antes de persistir. Falha do dado opcional deve preservar a cena e produzir o aviso correspondente; retry deve conseguir consultar novamente.

## 4. Estilo de sofá é escolhido depois da verificação de ocupação

**Local:** [mobiliar.py:883](../pipeline/mobiliar.py) e [furniture-param.js:453](../v1.5/renderizador-v16-moveis/interior/furniture-param.js).

O pipeline posiciona e confere os móveis antes de escolher o estilo. Uma poltrona é registrada com `w=1.00`, mas o estilo `nuvem` possui braços de 0,28 m e o renderizador impõe largura mínima de 1,18 m. A ocupação validada é menor que a geometria exibida.

**Reprodução:** chamar `mobilia()` com unidade de ID `"2"` e uma sala retangular de 4,5 × 3,6 m, área 16,2 m². A saída contém poltrona `estilo="nuvem"`, `p=[3.96, 0.5]`, `rot=3`, `w=1.0`. A geometria real medida com a biblioteca vai de −0,59 a +0,59 no eixo da largura; após rotação, alcança −0,09 na planta e entra 9 cm na parede.

**Correção:** escolher o estilo antes do posicionamento e usar suas dimensões mínimas nas verificações de ocupação e folga, preservando essas mesmas dimensões na saída. Os testes atuais de estilo não verificam a ocupação da geometria final.

## 5. Minificador pode apagar conteúdo de strings JavaScript

**Local:** [minificar_html.mjs:16](../tools/minificar_html.mjs).

As expressões de remoção de comentários de shader são aplicadas sobre todo JavaScript minificado. Uma quebra de linha dentro de template literal não garante que a string contenha GLSL. Assim, texto de interface ou dados que comecem uma linha com `//` ou `/* … */` podem ser removidos silenciosamente.

**Evidência:** execução do próprio script em VM com leitura/escrita simuladas: a string `first\n// visible data\nlast` perde `// visible data`. Um template `String.raw` contendo `/* content */` também perde esse conteúdo. A verificação da quantidade de `</script>` continua passando.

**Correção:** retirar essa limpeza genérica ou limitá-la a strings de GLSL identificadas explicitamente. Não foi comprovada corrupção funcional na página LIV atual; o erro foi reproduzido com uma entrada HTML válida aceita pelo novo utilitário.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| `npm test` na raiz | 301 testes: 300 passaram, um ignorado, zero falhas |
| `npm run test:py` na raiz | 334 testes: 332 passaram, duas falhas preexistentes |
| Testes Node do experimento LIV | 63 passaram |
| Testes Python de pacote/entrega/reprodução LIV | 22 testes: 20 passaram, dois erros pelo achado 1 |
| Testes Node do mapa regional | 13 passaram |
| Testes Python do mapa regional | 20 passaram |
| Testes adicionais pertinentes de móveis/pipeline | 14 JS e 16 Python passaram; nove sondas do demo passaram |
| Navegação da Casa VistaLar | Entradas, subida/descida da escada e conectividade passaram usando `browser-geometry.json`; gravação da evidência foi desativada |
| Integridade de interiores/transferências | Dez registros de interiores e 137 registros de transferência conferidos por tamanho/SHA, incluindo descompressão declarada |

As falhas gerais de Python são anteriores ao diff: há 142 imagens versionadas sem classificação, além de dois `runtime.json` de aproximadamente 2,54 MB sem exceção no limite de 1 MiB. Conferi a árvore de `HEAD`; as violações de tamanho são idênticas às do índice atual. Esses gates não avaliam os arquivos ainda não versionados.

Também é anterior ao diff a perda de categorias de comércio e saúde ao regenerar a etapa OSM de POIs: com o snapshot local, a saída contém 730 registros, nenhum nas oito categorias afetadas, enquanto o arquivo curado contém 82. O novo fallback sem Overture conserva essa limitação. Não foi contado como regressão nova.

## Dependências: pendências anteriores às mudanças

Foram executadas consultas `npm audit --package-lock-only --ignore-scripts --json` na raiz e no painel. Ambas retornaram advisories, sem falha de rede, e não modificaram dependências. O envio de metadados ao registry foi informado previamente.

| Árvore | Pacotes sinalizados |
|---|---|
| Raiz | 34: 17 moderados, 16 altos e um crítico |
| `painel/` | Sete altos |

Os números incluem pacotes sinalizados por dependências transitivas; não representam 41 falhas independentes. A comparação dos lockfiles com `HEAD` mostrou que todas essas versões já estavam presentes. O diff acrescenta `esbuild` 0.25.10 como dependência de desenvolvimento e 26 binários opcionais da mesma versão, com origem npm oficial e integridade SHA-512; esse pacote não foi sinalizado.

Prioridades de manutenção, com condições e correções conferidas em fontes primárias:

- `proxy-addr` 2.0.7, transitivo de Express na árvore de ferramentas Firebase/MCP: corrigido em 2.0.8. O advisory crítico exige uma configuração específica de sub-rede IPv6 como proxy confiável; essa configuração não foi encontrada nas fontes do projeto. [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
- `next` 16.3.6 no painel: corrigido em 16.3.8. O painel usa exportação estática, sem uso encontrado de `next/image` ou `remotePatterns`, portanto a exploração por otimizador de imagens não foi demonstrada. Há caminho de desenvolvimento com `next dev`; o advisory do MCP de desenvolvimento exige visitar um site malicioso enquanto esse servidor está ativo. [Otimizador de imagens](https://github.com/advisories/GHSA-cjq9-62q9-8jv4), [MCP de desenvolvimento](https://github.com/advisories/GHSA-39w2-rjm5-chcv).
- `sharp` 0.35.4, opcional de Next no painel: corrigido em 0.35.5. O advisory de librsvg exige SVG e condições específicas em Linux/glibc; não foi demonstrado processamento de SVG não confiável no escopo revisado. [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).

O manifesto e o lockfile pnpm da Casa VistaLar foram revisados estaticamente, com versões diretas fixadas e integridades presentes; não foi executado scanner pnpm. Os requirements Python estão inalterados, e não foi auditado um inventário das versões Python instaladas. As atualizações devem ser feitas nos pacotes apropriados, com validação de compatibilidade; não foi aplicado `audit fix`.

## Cobertura e limites

Foram revisados maquete/interiores/estoque e empacotamento LIV; pipeline, POIs, móveis, dimensões e renderizador; fontes de mapa regional e Casa VistaLar; piloto visual/Cedros e scripts auxiliares; novos scripts Blender e manifests de dependências. `firebase/`, `painel/src/` e `rastreabilidade/` não apresentam alterações locais de fonte. A revisão não substitui uma auditoria completa dessas fronteiras de autorização.

Não confirmei uma nova vulnerabilidade de segurança nas fontes revisadas. Não executei deploy, pentest, Blender vivo, render nativo completo ou teste em aparelho físico. A correção factual de preço, disponibilidade e vínculos comerciais em relação a uma tabela oficial não foi certificada nesta auditoria.

Usei as skills locais `reverse-code-audit` e `reverse-supply-chain`. A busca entre as ferramentas disponíveis não encontrou ToolSearch nem Ruflo MCP; a divisão da revisão foi feita com os agentes de colaboração disponíveis.
