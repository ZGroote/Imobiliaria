# Propostas e indicadores

Abra uma oportunidade e escolha **Propostas comerciais → Nova proposta**. Selecione explicitamente Brasil ou EUA e preencha projeto, destinatário, responsável, escopo, entregas, materiais, prazo, revisões, suporte, pagamento, preço/moeda e validade. Exclusões são opcionais. Nenhum preço, prazo ou serviço é presumido a partir dos modelos. A estimativa da oportunidade só entra no rascunho quando você usa o botão correspondente.

O perfil BR usa rótulos em português e o site `.com.br`. O perfil US usa rótulos em inglês e o site `.com`; o conteúdo digitado não é traduzido. O timbrado original permanece intacto na biblioteca. A exportação US é uma derivação para revisão, não um novo original aprovado da marca.

## Salvar, conferir e revisar

É possível salvar rascunhos incompletos. Confira **Ver prévia da versão salva**, marque a confirmação das condições e use **Aprovar esta versão da proposta**. Campos obrigatórios vazios, marcadores de modelo pendentes, validade vencida ou contexto desatualizado impedem a aprovação.

Cada alteração cria uma versão com conteúdo e contexto comercial preservados. A aprovação aponta para a versão e o hash exatos. Alterações na proposta ou na oportunidade exigem nova revisão. Alterações simultâneas são recusadas em vez de sobrescrever silenciosamente. A consulta de versões anteriores é somente leitura e permite exportar rascunho histórico.

A revisão é interna: não registra aceite do cliente, assinatura, contratação ou pagamento. Não envia mensagens nem muda a etapa da oportunidade. O histórico registra salvamento, aprovação e exportação. Dados e versões entram no backup criptografado do cache.

## Exportar Word ou PDF

**Baixar rascunho Word** gera um arquivo identificado como rascunho em todas as páginas. **Baixar Word revisado** exige revisão interna vigente. Edições não salvas impedem ambos os downloads. O arquivo usa o papel timbrado fornecido, preserva logo, dimensões, margens e os demais componentes do pacote original; somente corpo e rodapé são derivados. O hash da fonte é conferido antes da geração.

Mudanças feitas no Word baixado não atualizam o CRM nem sua aprovação. Confira o arquivo final antes de compartilhá-lo. O download é manual e não anexa o arquivo a nenhuma conversa. O PDF é gerado localmente, em memória, a partir do mesmo DOCX derivado e da mesma versão salva. Não depende de Office nem de serviço externo. Usa o logo e a geometria do timbrado, fonte incorporada, status em todas as páginas e numeração. A paginação é própria e pode diferir do Word.

**Baixar rascunho PDF** e **Baixar PDF revisado** respeitam as mesmas guardas do Word, incluindo edição pendente, versão e revisão vigente. Rascunho histórico é permitido; arquivo histórico não pode ser apresentado como revisão atual. O registro de exportação identifica o formato. Nenhum arquivo é anexado ou enviado.

O conteúdo digitado é texto literal, inclusive sequências parecidas com HTML; o PDF não carrega recursos remotos, cria scripts ou ativa links. A exportação recusa caracteres sem representação na fonte, mais de mil parágrafos ou mais de cinquenta páginas, com mensagem para revisar ou usar Word. Os limites são específicos do PDF. A fonte preferida é Arial do Windows, com fallback Vera distribuída pelo ReportLab. O rodapé US usa +55; o logo original conserva o lema em português incorporado à imagem, conforme [materiais da marca](BRAND_MATERIALS.md).

## Indicadores

A tela **Indicadores** reúne empresas cadastradas, candidatos pendentes de tarefas não canceladas, negociações abertas, ações atrasadas, propostas salvas e propostas com revisão vigente. Mostra contagens por etapa e até oito próximas ações com data, ordenadas cronologicamente.

As estimativas são somadas separadamente em BRL e USD, divididas entre abertas, ganhas e perdidas. Oportunidades sem valor são contadas à parte. A proporção de ganhas considera somente negociações encerradas: ganhas / (ganhas + perdidas). Sem encerramentos, a proporção não é apresentada. Esses números não comprovam receita, respostas humanas ou aceite. Datas seguem o calendário pessoal `America/Sao_Paulo` e não executam ações.

## API e verificação

- `GET /api/insights`: agregados locais.
- `POST /api/proposals`: rascunho com chave idempotente e versão atual da oportunidade.
- `PUT /api/proposals/{id}`: nova revisão com controle de concorrência.
- `GET /api/proposals?opportunity_id=...`: propostas da oportunidade.
- `GET /api/proposals/{id}?version=N`: versão salva e condições para revisão.
- `POST /api/proposals/{id}/approve`: confirmação explícita, versão e hash.
- `GET /api/proposals/{id}/docx?version=N&reviewed=true|false`: exportação Word auditada.
- `GET /api/proposals/{id}/pdf?version=N&reviewed=true|false`: exportação PDF auditada, com a mesma revisão.

As rotas usam a proteção de sessão/origem local existente. Textos têm limites e validação XML; valores usam centavos inteiros. A migração 0008 adiciona propostas e versões sem modificar correio ou candidatos.

Validação desta etapa: 207 testes passando, build TypeScript/esbuild e auditoria npm sem vulnerabilidades. Testes cobrem concorrência, integridade, invalidação, ausência de preenchimento, moedas e preservação dos componentes do timbrado. Dois DOCX fictícios BR/US foram abertos no Microsoft Word e conferidos em todas as páginas por PDF renderizado. LibreOffice não estava disponível. No navegador separado: edição, salvamento de versão, prévia, revisão interna, download, histórico e indicadores; em 320 px, sem overflow horizontal ou erros de console. Os dados fictícios ficaram exclusivamente no banco de testes.


Atualização PDF: 35 testes focados de propostas/materiais passaram. Quatro exemplos fictícios BR/US, rascunho/revisado, com duas páginas cada, foram renderizados e todas as oito páginas inspecionadas. Extração confirmou status em todas as páginas e markup visível literalmente. QA no navegador conferiu PDF revisado BR e histórico US baixados, guardas durante edição, quatro larguras sem overflow e console sem erros/avisos. Nenhuma proposta ou aprovação comercial real foi criada nesta verificação.

Implementação: [Paragraphs e texto literal](https://docs.reportlab.com/reportlab/userguide/ch6_paragraphs/), [paginação Platypus](https://docs.reportlab.com/reportlab/userguide/ch5_platypus/) e [desenho do cabeçalho/rodapé](https://docs.reportlab.com/reportlab/userguide/ch2_graphics/).
