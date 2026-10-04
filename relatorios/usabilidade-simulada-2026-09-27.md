# Usabilidade simulada — 27/09/2026

## Escopo e método

Inspeção interativa no navegador integrado do Codex, no site público, sem alterar código ou publicar dados. Unidade: Monte dos Cedros, build `34331f1ceb9d`. Entrada: https://imobilaria-deccb-imoveis.web.app/maquete/monte-dos-cedros-37 . Testados desktop e viewport de 390 × 844. Perfis são lentes de avaliação, não participantes reais nem agentes independentes.

Foram acionados Prédio, Planta 2D, Planta 3D, Visita 3D, recolher ficha, abrir/concluir editor de móveis, Ver mapa e Voltar ao imóvel. Também foi testada seleção de Planta 2D usando Tab e Espaço. Inspeção por capturas, árvore de acessibilidade e leitura do DOM. Nenhum contato foi enviado. Não foram feitas alterações no mobiliário.

## Resultado por jornada

| Perfil simulado | Objetivo | Resultado observado |
|---|---|---|
| Pessoa com pouca familiaridade com interfaces 3D | Entender área/quartos e abrir planta/visita | Ficha mostra 37,3 m², 1 dormitório e 1 banheiro. Modos abrem. Instruções usam termos técnicos e dependem de gestos. |
| Interessado em tela de celular | Explorar e voltar sem perder orientação | Layout principal cabe em 390 px, modos têm 44 px de altura. Painel de luzes sobrepõe conteúdo inferior. Mapa abre e volta ao mesmo imóvel, reiniciando no modo Prédio. |
| Comprador comparando disposição e mobiliário | Ler cômodos e descobrir possibilidades de mobília | Planta 2D e 3D renderizam. Editor abre e fecha. No celular a linha de seleção/ações do editor tem rolagem horizontal e comandos ficam parcialmente fora da área visível. Não foi validado encaixe dimensional de móveis. |
| Corretor apresentando um imóvel | Abrir link e encaminhar próximo passo | Link direto funciona, endereço e identificação estão visíveis. Na maquete não há ação de contato/agendamento nem botão de compartilhamento; a única âncora do DOM é Ver mapa. Copiar URL pelo navegador continua possível. |

## Achados priorizados

### Alta — Falta de próximo passo comercial

A ficha diz “Sob consulta”, mas a maquete não apresenta contato, agendamento ou link do anúncio. Confirmação por interface e DOM: somente Ver mapa é link. Hipótese de impacto: o interessado precisa voltar ao canal de origem para perguntar o preço. Sugestão: ação de contato contextualizada ao imóvel, quando houver contato autorizado configurado.

### Alta — Sobreposição do painel de luzes no celular

Em 390 × 844 o botão flutuante “Luzes do apartamento” cobre trechos de instruções/aviso e parte da região inferior de navegação, conforme o modo. Ocorre em Visita 3D e Planta 3D, com ficha recolhida, e no editor. Sugestão: reservar espaço ou integrar o controle à barra em telas estreitas.

### Média — Orientação da visita não adaptada à tela estreita

Texto permanece “Duplo clique no chão para caminhar · W A S D para andar · arraste para olhar”. Observação de viewport, não prova de falha em hardware touch: esta sessão não emulou toque real. Sugestão: instrução contextual para mouse/teclado e para toque, com ajuda visual curta.

### Média — Editor exige deslocamento horizontal

No celular, a linha Selecionar/Mover/Girar/Excluir apresenta barra horizontal; ações ficam cortadas. Abrir/concluir funciona. Sugestão: distribuir ações em linhas ou usar painel próprio, preservando a área da planta.

### Média — Planta 2D pouco legível em tela estreita

Nomes de cômodos menores e suas áreas ficam muito pequenos; há amplo espaço vertical vazio, mas a largura limita a planta horizontal. A árvore de acessibilidade expõe a planta apenas como “Planta baixa”, sem cômodos/áreas. Sugestão: ampliar planta, oferecer lista textual de cômodos e medidas e controles explícitos de zoom. Gestos de pinça não foram testados.

### Baixa — Linguagem e descoberta

“Corte na altura do peitoril”, “esquadria” e “sem laje por cima” pedem conhecimento técnico. “Móveis” abre um editor, embora possa ser entendido como mostrar/ocultar mobília. O recolhimento da ficha usa só uma seta visual (tem nome acessível). Hipóteses de dificuldade, a confirmar com pessoas reais. Sugestão: linguagem cotidiana e rótulo “Editar móveis”.

## Pontos positivos verificados

- Quatro modos renderizam conteúdo; planta 2D identifica cômodos visualmente.
- Ficha organiza área, quartos, banheiro, vaga e pavimento.
- Aviso explícito de representação ilustrativa e dimensões aproximadas.
- Largura do documento = 390 px no viewport de 390 px: sem transbordamento global na ficha observada.
- Botões dos quatro modos medidos com 44 px de altura no celular.
- Recolher informações aumenta espaço da cena e mantém modos acessíveis.
- Ver mapa abre o entorno, com instrução para dois dedos e retorno explícito ao imóvel.
- Tab chega a Prédio e Planta 2D; Espaço seleciona Planta 2D.
- Nenhum erro/aviso retornado pelo coletor de console no momento da consulta (não equivale a auditoria completa de rede).

## Limites

Sem participantes humanos, métricas de conclusão/abandono ou cronometragem de aprendizagem. Viewport estreito não equivale a celular físico, rede móvel ou teste de toque. Não testados: painel autenticado, múltiplos imóveis, envio de contato, compartilhamento por WhatsApp, persistência/edição de móveis, caminhada completa, leitor de tela real e desempenho. Não atribuir taxas de conversão, aprovação ou satisfação a esta inspeção.

## Parecer

O conteúdo visual funciona como demonstração e os modos básicos são navegáveis. A prioridade de produto observada é concluir a jornada de contato e eliminar obstáculos na tela estreita. As hipóteses sobre compreensão devem orientar um teste posterior com usuários, sem serem apresentadas como comportamento humano medido.
