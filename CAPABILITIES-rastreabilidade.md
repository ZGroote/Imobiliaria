# Rastreabilidade dos links de imóveis

Status: aprovado pelo usuário em 04/10/2026; implementação e testes locais
autorizados sem novas pausas de revisão do desenho.

Prioridade: entregar antes de uma nova publicação pública. Os sites e previews
desativados continuam offline durante o desenvolvimento e os testes locais.

## Divisão e ordem

| Módulo | Entrega | Depende de |
|---|---|---|
| `links-corretor` | Um imóvel pode ter vários links, cada um vinculado a um corretor da imobiliária; criar, listar, copiar e desativar esses links no painel | — |
| `cadeia-encaminhamentos` | Abrir um link, conservar o corretor de origem e gerar o sublink daquela abertura para encaminhamentos, incluindo cópia da barra de endereço | `links-corretor` |
| `navegacao-metricas` | Registrar sessões, visualizações, visitantes estimados e tempo ativo por página/seção, associados ao link de entrada | `cadeia-encaminhamentos` |
| `relatorios-acesso` | Consultar por imóvel, corretor e período; distinguir entrada pelo link do corretor, encaminhamento rastreado e origem não identificável | `links-corretor`, `navegacao-metricas` |

Ordem: links por corretor → cadeia de encaminhamentos → métricas de navegação →
relatórios. Cada módulo terá seu contrato e testes próprios. Não depende da
homologação física M1.1-A; o pacote e seus fingerprints serão preservados.

## Comportamento esperado

1. Um imóvel anunciado por três corretores terá três links de origem distintos.
   O responsável operacional do imóvel continua sendo um campo separado.
2. O visitante abre o link de origem e a página substitui seu endereço por um
   sublink daquela abertura, sem recarregar. Ao copiar a barra ou usar
   Compartilhar/Copiar link, esse visitante envia o sublink.
3. Quem recebe o sublink mantém o corretor original e ganha seu próprio sublink
   para o próximo repasse. A criação do sublink não conta como novo acesso.
4. Recarregar, voltar, trocar páginas ou reabrir o próprio endereço com a mesma
   sessão não inventa um encaminhamento. O recibo privado da sessão não vai na
   URL compartilhável. Sem evidência suficiente, a origem fica incerta.
5. Medir páginas e seções: ficha, informações do imóvel, mapa e modos de
   visualização existentes. Não medir posição nem tempo por cômodo 3D.
6. Pausar o tempo quando a aba estiver oculta ou sem atividade; registrar
   intervalos efetivamente observados, sem presumir permanência após fechar.
7. O corretor vê seus links e resultados; o gerente vê a imobiliária; a equipe
   interna mantém os papéis existentes. Acesso entre imobiliárias é negado.
8. Desativar um link de origem interrompe a cadeia derivada, sem atribuir os
   acessos a outro corretor nem apagar o histórico já registrado.

## Limites que o relatório deve mostrar

- Copiar a mensagem original no WhatsApp, ou outro texto externo que contenha a
  URL original, não revela que houve um repasse. Esse acesso segue ligado ao
  link recebido; não será apresentado como entrega pessoal comprovada pelo
  corretor. O mesmo vale para URLs copiadas antes da atualização do endereço.
- A atualização automática da barra é suportada por `history.replaceState`,
  dentro da mesma origem. Preservar os parâmetros de modo e navegação faz parte
  dos testes. [Referência](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState).
- Visitantes únicos são estimativas por navegador com identificador aleatório,
  conforme a opção de coleta. Não representam pessoas identificadas: outro
  aparelho, navegação privada ou limpeza de dados alteram essa estimativa.
- Separar visualizações, sessões, visitantes estimados e encaminhamentos.
  Prévias de mensagens e requisições de robôs não comprovam visitas humanas.
- A coleta será mínima e explicada ao visitante: sem IP armazenado, nome,
  e-mail, conteúdo de formulários, gravação de tela ou fingerprint do aparelho.
  A recusa de métricas de navegação não impede visualizar ou compartilhar.
- Não há recuperação retroativa desses registros para as publicações antigas.

## Encaixe no projeto atual

Hoje `properties.assignedAgentId` representa um responsável operacional único,
e os links públicos são iguais para todos os corretores. Isso não atende ao
vínculo de vários corretores com o mesmo imóvel. Referências:
[imoveis.ts](painel/src/lib/imoveis.ts),
[publicacao.ts](painel/src/lib/publicacao.ts) e
[imovel.tsx](painel/src/components/imovel.tsx).

O painel é exportado como site estático. A gravação confiável de links,
encaminhamentos e eventos precisa de um serviço separado, seguindo a fronteira
Node/Firebase Admin já usada em [leitura-api.mjs](tools/leitura-api.mjs).
O visitante não poderá gravar livremente no Firestore nem escolher corretor ou
imóvel enviando parâmetros adulterados.

Os artefatos de imóveis são versionados pelo conteúdo e aprovados por hash.
A entrada rastreável será uma página própria na mesma origem do conteúdo,
cobrindo tour, maquete LEVE e maquete PREMIUM. Os builds existentes e os
diretórios congelados da rodada M1.1 não serão modificados. O teste inicial
será local, com dados do emulador.

## Contato com o corretor

O usuário pediu abertura para um futuro botão de WhatsApp na página pública.
O resolver conserva o corretor da raiz, inclusive após encaminhamentos, e
reserva um contato público opcional consultado no servidor. O telefone não
vem da URL nem de parâmetros enviados pelo visitante. Esta entrega prepara
esse contrato; cadastro de telefones e o botão de WhatsApp ficam para a
etapa futura solicitada, sem inventar números ou enviar mensagens.

## Aprovação

A divisão, a ordem, os limites das cópias manuais e a continuidade até os
testes locais foram aprovados pelo usuário. O vínculo para o futuro contato
WhatsApp integra o contrato. Nenhum site será republicado nesta entrega.
