# Revisão da base 1.5 — 21/09/2026

## Parecer

A direção melhorou: módulos com responsabilidades identificáveis, pipeline separado
da renderização, dados de imóveis compartilhados e navegação progressiva entre ficha,
maquete, planta e visita. A maquete demonstrativa foi renderizada em Chrome headless
e inspecionada visualmente em 1280 × 800. A ficha organiza as informações com clareza
e o destaque do pavimento conecta anúncio e volume do prédio.

O próximo ganho deve ser consolidar a jornada e a confiabilidade antes de acrescentar
mais detalhe gráfico. Não houve teste com usuários nem validação em celular físico.

## Código — prioridades

1. **Alta: fechar o contrato dos módulos e os testes de integração.** A execução
   atual tem 103 testes Node aprovados e 10 reprovados, incluindo câmera, editor,
   ficha, entrada no interior, luzes, links e loop de renderização. Várias fixtures
   ainda não injetam dependências novas (`paraTour`, `getPlanta`, `getEtapa`,
   `paraVoo`, `getLinkImovel`). Isso explica falhas de teste, mas não prova que a
   jornada real está correta. Atualizar as fixtures conforme o comportamento novo
   e cobrir ficha → planta → visita → volta, inclusive pelo link direto.
2. **Alta, antes de habilitar operação multiempresa: revisar as regras existentes
   do Firestore.** `firebase/firestore.rules` permite criação em `/usuarios/{uid}`
   por qualquer autenticado, sem exigir que `uid` seja o próprio; a leitura por
   admin não restringe a imobiliária; e a atualização de imóvel só verifica o
   proprietário anterior, permitindo mudar `imobiliaria_id`. Restringir identidade,
   escopo e campos mutáveis, com testes no emulador. É uma constatação do código
   local, não uma verificação das regras implantadas nem de exploração em produção.
3. **Média: consolidar a fonte de verdade.** `v16-moveis`, `v17`, `v18`, `1.5` e o
   plano `1.0.0-dev.1` coexistem. `BuildConfig` só aceita `v15` e `v16-moveis`, embora
   o README das miniaturas sugira `MAPA_V=v18`. Documentar demos versus build oficial
   e definir uma versão do produto inequívoca. Não apagar o legado enquanto os
   testes de equivalência dependem dele.
4. **Média: reduzir acoplamento onde voltou a se concentrar.**
   `listings/stage.js` reúne transições, câmera, maquete e cena da planta, com muitas
   dependências injetadas. Separar geometria da maquete da coordenação de etapas;
   manter as transições sob um único dono. Evitar uma nova reescrita geral.
5. **Média: medir a chegada por imóvel em rede e aparelho modestos.** O build atual
   gera aproximadamente 32,9 MB aberto e 14,0 MB no formato comprimido do projeto.
   Isso não é uma medição de tráfego HTTP. Preferir a entrada por imóvel/maquete,
   deixar a cidade completa como exploração e medir tempo até interação e memória.

## Produto — prioridades

- **Dar um próximo passo comercial.** Na maquete examinada existem os modos de
  visualização, mas não um caminho visível para falar com o corretor ou agendar.
  Colocar uma ação principal junto à ficha e preservar o imóvel ao iniciar contato.
- **Distinguir o que é confirmado do que é representação.** O gerador centraliza a
  planta na laje porque o cadastro não informa sua posição real. A maquete deve
  comunicar essa aproximação; o grau de confiança não pode ficar só em comentários
  do código. Separar dados demonstrativos, dados cadastrados e geometria estimada.
- **Corrigir a semântica das áreas na maquete.** Em `pagina_maquete.py`,
  `area_util or area_total` é exibida como “Área útil”. Quando só existe área total,
  o rótulo promete uma medida diferente. A ficha do mapa já distingue essas áreas;
  reutilizar a mesma regra na maquete.
- **Validar primeiro os três imóveis do piloto.** Observar se uma pessoa consegue
  entender área, andar e disposição, entrar/sair da visita, voltar à ficha e pedir
  contato. Depois investir em expansão de cidades e sofisticação visual.
- **Medir resultado da jornada.** Acompanhar abertura da ficha, planta, visita e
  contato, além do tempo de carregamento. A utilidade do 3D deve aparecer na decisão
  do visitante, não apenas no tempo que ele fica girando a cena.

## Verificação e escopo da atualização Git

- `npm run test:py`: 43/43 aprovados.
- `npm test`: 103/113 aprovados; 10 falhas, nenhuma cancelada ou ignorada.
- Build modular de São Carlos: concluído, versão aberta e comprimida geradas.
- Inspeção visual: maquete demonstrativa desktop; não equivale ao QA integral.
- Fontes e dados de build/runtime foram selecionados pelo manifesto do pipeline e
  pelo manifesto de tiles. Credenciais locais e arquivos de backup não foram incluídos.
- Revisão de padrões de segredo nos arquivos adicionados/alterados: nenhum achado
  nos padrões examinados; isso não é uma auditoria exaustiva de segurança.

Esta atualização registra o trabalho existente e sua organização na 1.5. As
melhorias propostas acima não foram implementadas como parte da revisão.
