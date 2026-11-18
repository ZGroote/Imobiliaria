# Propostas e indicadores

Abra uma oportunidade e escolha **Propostas comerciais → Nova proposta**. Selecione explicitamente Brasil ou EUA e preencha projeto, destinatário, responsável, escopo, entregas, materiais, prazo, revisões, suporte, pagamento, preço/moeda e validade. Exclusões são opcionais. Nenhum preço, prazo ou serviço é presumido a partir dos modelos. A estimativa da oportunidade só entra no rascunho quando você usa o botão correspondente.

O perfil BR usa rótulos em português e o site `.com.br`. O perfil US usa rótulos em inglês e o site `.com`; o conteúdo digitado não é traduzido. O timbrado original permanece intacto na biblioteca. A exportação US é uma derivação para revisão, não um novo original aprovado da marca.

## Salvar, conferir e revisar

É possível salvar rascunhos incompletos. Confira **Ver prévia da versão salva**, marque a confirmação das condições e use **Aprovar esta versão da proposta**. Campos obrigatórios vazios, marcadores de modelo pendentes, validade vencida ou contexto desatualizado impedem a aprovação.

Cada alteração cria uma versão com conteúdo e contexto comercial preservados. A aprovação aponta para a versão e o hash exatos. Alterações na proposta ou na oportunidade exigem nova revisão. Alterações simultâneas são recusadas em vez de sobrescrever silenciosamente. A consulta de versões anteriores é somente leitura e permite exportar rascunho histórico.

A revisão é interna: não registra aceite do cliente, assinatura, contratação ou pagamento. Não envia mensagens nem muda a etapa da oportunidade. O histórico registra salvamento, aprovação e exportação. Dados e versões entram no backup criptografado do cache.

## Exportar Word

**Baixar rascunho Word** gera um arquivo identificado como rascunho em todas as páginas. **Baixar Word revisado** exige revisão interna vigente. Edições não salvas impedem ambos os downloads. O arquivo usa o papel timbrado fornecido, preserva logo, dimensões, margens e os demais componentes do pacote original; somente corpo e rodapé são derivados. O hash da fonte é conferido antes da geração.

Mudanças feitas no Word baixado não atualizam o CRM nem sua aprovação. Confira o arquivo final antes de compartilhá-lo. O download é manual e não anexa o arquivo a nenhuma conversa. A aplicação exporta DOCX; PDF pode ser gerado pelo Word do operador.

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
- `GET /api/proposals/{id}/docx?version=N&reviewed=true|false`: exportação auditada.

As rotas usam a proteção de sessão/origem local existente. Textos têm limites e validação XML; valores usam centavos inteiros. A migração 0008 adiciona propostas e versões sem modificar correio ou candidatos.

Validação desta etapa: 207 testes passando, build TypeScript/esbuild e auditoria npm sem vulnerabilidades. Testes cobrem concorrência, integridade, invalidação, ausência de preenchimento, moedas e preservação dos componentes do timbrado. Dois DOCX fictícios BR/US foram abertos no Microsoft Word e conferidos em todas as páginas por PDF renderizado. LibreOffice não estava disponível. No navegador separado: edição, salvamento de versão, prévia, revisão interna, download, histórico e indicadores; em 320 px, sem overflow horizontal ou erros de console. Os dados fictícios ficaram exclusivamente no banco de testes.
