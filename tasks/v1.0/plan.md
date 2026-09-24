# Mapa 3D Imobiliário — versão 1.0

Estado: desenvolvimento. A aprovação deste plano não significa que a versão estável
foi concluída ou publicada. A primeira montagem local será `1.0.0-dev.1`.

## Decisões aprovadas

- Plano próprio em `tasks/v1.0/`; o trabalho de geometria em `tasks/plan.md` continua separado.
- Escopo: São Carlos. Piloto: Wish Passeio das Castanheiras (`wish-castanheiras-58`),
  Monte das Colinas (`monte-das-colinas-39`) e Monte dos Cedros (`monte-dos-cedros-37`).
- Preço dos três: **Sob consulta**. Manter `preco: null` nos cadastros, sem inventar valor.
- Aviso: **Localização aproximada, ainda não confirmada**. Manter `confirmado: false`.
  A seleção do piloto não confirma endereço, posição da torre, pavimento ou implantação.
- Reutilizar as plantas existentes; indicar que a apresentação é uma visualização 3D.
- Objetivo comercial: três tours utilizáveis e compartilháveis pelo corretor no celular.
  Preparar links e mensagem; envio a terceiros depende de destinatário e pedido de envio.

## O que existe de fato

O renderizador atual possui 71 módulos e nove folhas CSS. `interior/entry.js` já
implementa entrada, saída e vista de planta em perspectiva; `first-person.js` e
`navigation.js` cuidam de caminhada e colisão. Touch, níveis gráficos e redução
adaptativa de resolução existem. A fase 2 não começa do zero.

`pipeline/imovel.py` e `recorte.py` já montam páginas individuais e metadados OG.
O deep link ainda é um script injetado que consulta `window.__int`, tenta por cerca
de 40 segundos e pode desistir sem mensagem. Seus modos são `aerea`, `ficha`,
`planta` e `visita`, não o contrato final de quatro modos.

Baseline desta revisão: 111 testes Node e 36 Python passaram; montagem isolada de
São Carlos passou. HTML comprimido gerado: aproximadamente 13,98 MB. QA completo,
telefone físico e preview real no WhatsApp não foram executados nesta revisão.

Medição local do HTML aberto: unidades 49.119 bytes, móveis 859.896, lightmaps
487.409, modelos urbanos 5.290.163 e exteriores 5.958.639. Os três recortes do piloto
pesavam 14,37–15,20 MB em arquivo e 4,46–4,78 MB em gzip local. Gzip local não é
medição da transferência HTTP. Tirar unidades do HTML não economiza os 2 MB sugeridos
no roteiro original; as bibliotecas e a inicialização do entorno são os alvos maiores.

## Organização da base

| Caminho | Responsabilidade e regra |
| --- | --- |
| `renderizador-v16-moveis/` | Fonte única do produto; não copiar para outro renderizador a cada release. |
| `pipeline/` | Montagem, recortes, metadados e preparação dos artefatos. |
| `padrao/` | Dados de configuração e QA; variante sempre explícita. |
| `plantas_fornecidas/` | Cadastro canônico dos imóveis e origem das plantas. |
| `modelos_urbanos/`, `exteriores/`, `moveis/`, `arvores/`, `unreal/` | Acervos e geradores consumidos pelo build. |
| `tests/` | Regressão de comportamento, contrato dos links e publicação. |
| `tasks/v1.0/` | Plano, checklist, configuração do piloto e registro de experimentos. |
| `releases/<versao>/` | Saída gerada, manifesto e instrução para abrir localmente. |
| Pastas `v*`, `_arquivo/`, backups | Inventariar antes de mover. `v7/` contém fontes ativas! |

Organizar primeiro por documentação e comandos. Movimentação física vem depois de
mapear referências e provar montagem equivalente. Não apagar nem ignorar dados
necessários apenas por parecerem históricos. Não incluir credenciais em artefatos.

## Capacidades e ordem de implementação

| ID | Entrega | Depende de |
| --- | --- | --- |
| base-release | Piloto, textos, saída isolada, manifesto e inventário | — |
| publicacao | Dados escapados, caminhos completos, cache e isolamento Firebase | base-release |
| compartilhamento | Link por unidade, ficha estática, OG e imagem existente | publicacao |
| modos | Aérea, planta 3D, planta 2D, walkthrough e transições | compartilhamento |
| carregamento | Unidade independente do entorno e falhas recuperáveis | modos |
| mobile-offline | Gestos, fallback, atualização e cache medidos | carregamento |
| piloto-validado | Três tours, evidências e candidato estável | mobile-offline |

Os testes específicos acompanham cada entrega; o telefone não fica para o final.
Detalhamento executável em [todo.md](todo.md).

## Contrato do produto

Uma URL estável identifica o imóvel; arquivos pesados usam hash de conteúdo.
O contrato final aceita `?imovel=<id>&modo=aerea|planta3d|planta2d|walkthrough`.
`planta` e `visita` continuam como aliases; `ficha` mantém o acesso existente.
Uma unidade desconhecida, modo inválido ou falha de carregamento mostra uma ficha ou
mensagem útil. Esperar prontidão por estado explícito e cancelar ações obsoletas;
não usar a API de diagnóstico como interface de produção.

O link compartilhado entrega HTML leve com nome, área, Sob consulta e aviso de
localização antes do 3D. Sua imagem deve existir e ser acessível na URL absoluta.
Não fazer redirecionamento que elimine a ficha de fallback. A imagem do modelo é
identificada como visualização 3D. Campo de anúncio entra como texto, nunca HTML cru.

Modos: aérea enquadra o imóvel e entorno; planta 3D isola a unidade; planta 2D é
ortográfica com distribuição legível; walkthrough reaproveita entrada, colisões e luz.
Botões explícitos funcionam com toque e teclado. Rotação automática é cancelável e
respeita redução de movimento. Wireframe, transparência do entorno e duplo toque são
experimentos, não condições arbitrárias para uma interface utilizável.

A saída hospedada usa HTTP/HTTPS. O pacote atual de quintais depende de `fetch` de
tiles e não é integralmente funcional por duplo clique em `file://`. Cache offline
precisa de política de atualização, limite de armazenamento e teste de versão velha;
a segunda visita não será chamada de instantânea sem medição.

## Publicação e segurança

- Reconciliar `pipeline/publicar.py` e `exteriores/v1/preparar.py`: o primeiro reutiliza
  nome fixo, o segundo já usa hash. Um único comando deve preparar o pacote validado.
- Resolver todos os assets antes de atualizar o índice. Preservar prefixos de tiles
  relativos à página e testar ausência de 404. Não executar limpeza recursiva de `mapa/`.
- Rotas estáveis revalidam; somente arquivos cujo nome muda com o conteúdo são imutáveis.
- Corrigir regras locais de usuários: leitura e edição limitadas ao tenant existente,
  identidade validada na criação e transferência de tenant proibida por edição comum.
  Conferir também atualização de imóveis e eventos. Testar no emulador antes de implantar.
- Cada artefato registra fontes, hashes, versão e verificações. A versão `dev` é local;
  `rc` exige funcionalidade completa; `1.0.0` exige todos os critérios abaixo.

## Aceite da versão estável

1. Cada um dos três links abre o imóvel certo, sem escolher prédio manualmente.
2. Sob consulta e localização aproximada aparecem na ficha, na entrada do tour e no
   texto de compartilhamento; não há preço zero apresentado como oferta.
3. Quatro modos funcionam via URL e controles; câmera, seleção e saída são consistentes.
4. Preview com imagem, título e área conferido no HTML bruto e em compartilhamento real.
5. Ficha estática utilizável sem WebGL; falha do 3D oferece recuperação e contato/anúncio.
6. Evidências em Android/Chrome e iPhone/Safari, incluindo navegador aberto pelo WhatsApp.
7. Sem falhas nos testes relevantes, sem 404 de assets e sem exceções de inicialização.
8. QA registra o hash da página realmente medida: sondas antigas podem abrir a pasta
   canônica mesmo quando o build está isolado. Não aceitar aprovação do arquivo anterior.
9. Atualização preserva links e permite rollback; nenhuma etapa não medida conta como aprovada.

Metas iniciais de experimento, ainda não resultados: ficha utilizável em até 2,5 s,
tour interativo em até 8 s e mediana de pelo menos 30 FPS após estabilizar, em aparelho
e perfil de rede identificados. Registrar cinco aberturas frias e quentes; reportar
mediana e pior resultado. Medir bytes transferidos, tempo de parse, memória e custo de
quadro separadamente. Ajustar o escopo com evidência se essas metas não forem atingidas.

## Fontes e continuidade

Roteiro fornecido pelo usuário nesta conversa e inspeção do repositório. O arquivo
exato `memory/2026-09-18.md` não foi localizado; foram consultadas as memórias locais
`recorte-por-imovel`, `mapa-3d-v7-e-dado-nao-build`, `escopo-so-sao-carlos` e
`qa-comportamento-le-pasta-da-versao`. Não atribuir a esse arquivo ausente uma leitura.

Referências de implementação: [Open Graph](https://ogp.me/) para metadados e
[Service Workers — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
para ciclo de vida e contexto seguro do cache offline.
