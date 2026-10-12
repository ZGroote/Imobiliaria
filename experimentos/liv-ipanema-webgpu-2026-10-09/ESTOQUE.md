# Cadastro de unidades e consulta pública

O painel usa o imóvel já cadastrado como empreendimento: em **Admin → Imóveis → Detalhes → Unidades e disponibilidade**, iniciar o cadastro cria 170 posições técnicas (térreo + 16 pavimentos, dez finais) e dois perfis comuns, **Canto** e **Meio**. Todos começam com disponibilidade **não informada**, número comercial desconhecido e sem associação presumida de planta. O cadastro é privado até o responsável ativar a consulta pública.

Preencher os perfis comuns com preço, área, quartos, banheiros, vaga, descrição e condições. Uma unidade pode herdar esses campos ou ter exceções; zero é um valor válido e campo vazio herda o perfil. Disponibilidade pertence sempre à unidade. Associar uma planta exige confirmação explícita da orientação original; espelhamentos e gardens permanecem em conferência. A numeração comercial é cadastrada pelo responsável, sem cálculo a partir dos IDs técnicos.

Na página pública, clicar no apartamento da fachada, nos botões do pavimento ou no espelho abre uma ficha. Ela mostra os dados recebidos e permite acessar a planta 2D, 3D e Tour correspondentes quando a associação existe. Fechar pelo botão, pela área externa ou por Escape restaura o foco. Informação ausente aparece como desconhecida. Texto de descrição e condições é exibido como texto, sem executar HTML.

## Vincular o site ao cadastro

`node configurar_estoque.mjs --imovel ID_DO_IMOVEL` configura o empreendimento deste experimento. Sem `--imovel`, o site aceita `maquete-liv-ipanema.html?geometria=entrada&estoque=ID_DO_IMOVEL`; o ID é o documento do imóvel no painel. O parâmetro ativa automaticamente o edifício completo e acompanha o retorno pelo mapa. A configuração atual não fixa um imóvel: a página sem parâmetro continua usando os arquivos locais de referência e não baixa o SDK Firebase.

As opções copiadas são somente as opções públicas do SDK web já usado pelo painel. O script não copia credenciais administrativas. `node compilar_estoque.mjs` recompila o cliente de leitura com as dependências já instaladas e registra os inputs e a identidade do bundle em `estoque-build.json`.

A consulta usa três assinaturas: configuração pública do empreendimento, unidades e perfis. Alterações atualizam ficha, filtros e disponibilidade sem recriar a cena. Desativar a consulta retira os dados e vínculos públicos da sessão aberta. Falha de conexão/validação produz um aviso também dentro da ficha aberta; disponibilidade desconhecida nunca vira disponível por falta de resposta. Sem conexão, dados anteriores não devem ser usados como confirmação de oferta.

## Persistência e permissões

Documentos em `salesInventory/{propertyId}`: `units`, `profiles`, índice privado `numbers` e histórico privado `history`. As regras consultam a propriedade privada existente para autorização. Administrador/operador ou gestor da agência vinculada podem editar; corretor não escreve. Público lê somente o empreendimento habilitado e vinculado a um imóvel ativo, suas unidades e seus perfis. Histórico, atores e índice de numeração não são públicos.

Cada gravação valida campos permitidos, identidade técnica, revisão e timestamp do servidor e exige histórico imutável na mesma transação. Revisões concorrentes são rejeitadas sem sobrescrever alterações de outra pessoa. O índice de números impede duas unidades de reservar o mesmo número comercial, inclusive em gravações simultâneas.

## Verificação e situação da entrega

- 48 testes de regras no emulador: 41 existentes e sete do estoque, incluindo concorrência, isolamento, auditoria, revogação pública e unicidade de número.
- Testes Node do cliente/adapter/implantação; build de produção Next passou com a rota estática `/admin/properties/units?id=...`.
- `evidencias/estoque-admin/runtime.json`: cadastro e edição pelo painel real, leitura pública no emulador, preço herdado e exceção, atualização ao vivo, duas plantas/Tours, revogação e viewport de toque. Capturas usam somente **DEMONSTRAÇÃO SEM OFERTA REAL**. A configuração do site não foi substituída pelo emulador.

Nenhuma unidade real foi cadastrada ou vendida por estes testes. Para ativação real, publicar as regras `firebase/firestore.rules`, o build do painel e uma versão compatível do site, escolher o ID do imóvel e preencher/conferir o cadastro antes de habilitar o público. Esta entrega prepara esses componentes; não publica nem altera o estoque de produção. Qualificação física no Poco X6/iPhone permanece pendente.
