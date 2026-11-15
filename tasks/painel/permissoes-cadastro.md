# Permissões do cadastro de imóveis e unidades

Regra definida em 29/10/2026: o cadastro comercial é responsabilidade do gerente da imobiliária dona do imóvel e do administrador da plataforma.

| Ação | Administrador | Gerente da empresa dona | Operador | Corretor |
|---|---|---|---|---|
| Cadastrar imóvel | Sim, escolhendo a imobiliária | Sim, na própria imobiliária | Não | Não |
| Editar título, empreendimento, endereço e anúncio | Sim | Sim | Não | Não |
| Cadastrar e editar apartamentos, plantas comerciais, preços e disponibilidade | Sim | Sim | Não | Não |
| Vincular vagas da implantação aos apartamentos | Sim | Sim | Não | Não |
| Alterar ID do pipeline | Sim | Não | Não | Não |

O gerente acessa **Imóveis → imóvel → Unidades e disponibilidade do empreendimento**, em `/properties/units?id=...`. O administrador usa a rota equivalente em `/admin/properties/units?id=...`. As duas usam o mesmo editor. A identidade ativa, o papel e a imobiliária são conferidos pelas regras do Firestore; esconder um botão não concede nem revoga permissão no banco.

O gerente não escolhe uma imobiliária ao cadastrar: o formulário usa a imobiliária da sua sessão. As regras também recusam criação ou alteração de imóveis de outra empresa, campos técnicos e troca da imobiliária do registro. Disponibilidade e vagas continuam com revisão e histórico atômico. O controle auditado de pausar/reativar uma publicação preparada permanece separado da edição cadastral.

Esta correção trata do cadastro comercial. Os fluxos de solicitações e produção conservam suas permissões próprias.

Validação: `npm run test:regras`, `npm run test:painel`, `npm --prefix painel run typecheck` e `npm --prefix painel run build`.
