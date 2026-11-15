# Gestão, marca e atendimento internacional

Decisões do usuário em 03/11/2026. Esta orientação substitui a permissão anterior de cadastro comercial pelo gerente.

- O painel usa a identidade Conecta do site de apresentação: logo oficial, Satoshi, fundo `#f5f8ff`, tinta `#07184d` e azul `#3345ff`. Os arquivos de marca são locais em `painel/public/brand`.
- Administrador configura informações, plantas, unidades, vagas, numeração e publicação. Operadores continuam com as funções internas já existentes, incluindo as leituras de plantas.
- Gerente da imobiliária altera somente preço individual e disponibilidade disponível/vendida no estoque. Características e dados comuns ficam protegidos nas regras Firestore, mesmo fora da interface. Estados antigos são preservados até uma decisão comercial.
- Corretores mantêm acesso de consulta e criação dos próprios links. O gerente convida corretores da própria imobiliária; cada convidado cria a senha e confirma o e-mail. Recuperação de senha disponível na entrada.
- Idiomas iniciais: português e inglês. O administrador configura país, moeda e fuso por imobiliária. A escolha explícita de idioma do usuário é preservada. Presets BR, US, GB, CA, AU e PT; moedas BRL, USD, GBP, CAD, AUD e EUR. Não há conversão cambial de valores existentes.
- Perfil público permite SMS ou WhatsApp, com código internacional explícito, e e-mail público adicional. O e-mail de autenticação nunca é publicado automaticamente. Os botões públicos preservam o sublink atribuído ao responsável.
- SMS/e-mail abrem os aplicativos do visitante com mensagem e link. Não são disparos automáticos. Convite e confirmação de e-mail têm versão em inglês.
- Início permite selecionar o empreendimento e consultar os links e relatórios reais. Não há total artificial de visitantes ou identificação nominal de visitantes: sessões, navegadores estimados e tempo ativo consentido, janela de 30 dias, com aviso quando os dados forem parciais.
- A alteração não muda a coleta em tempo ativo: pausa com página oculta e após 60 segundos sem atividade. Não identifica a mesma pessoa em dispositivos diferentes.

## Validação local

- `npm.cmd --prefix painel run typecheck`
- `npm.cmd --prefix painel run build -- --webpack`
- Emuladores auth/firestore/storage, projeto `demo-painel`: `node painel/scripts/qa-gestao.mjs --tests`.
- A QA usa exclusivamente contas e imóveis fictícios; screenshots e resultados em `relatorios/painel-gestao-2026-11-03/`.
- O Turbopack desta instalação falhou ao iniciar o processo de CSS, inclusive fora do sandbox. A compilação foi validada com Webpack, opção suportada pelo Next. Não foram alterados os comandos de build do projeto.

Publicação de painel, regras, rastreabilidade e funções de e-mail precisa ser coordenada: a interface e as regras devem usar a mesma política de edição. Nenhum deploy ou alteração em contas reais faz parte da validação local.
