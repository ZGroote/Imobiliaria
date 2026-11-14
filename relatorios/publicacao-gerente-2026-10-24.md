# Visibilidade controlada pelo gerente — 24/10/2026

Complemento posterior: o bloqueio agora também alcança as entradas públicas independentes.
Consulte `pausa-publica-liv-2026-10-24.md` para a correção e as evidências.

Atualiza `controle-publicacao-2026-10-24.md`: somente o gerente da imobiliária do imóvel
pode pausar e reativar sua publicação. Administrador, operador, corretor e gerente de outra
imobiliária não têm essa permissão, inclusive por acesso direto ao Firestore.

## Entrega

- Chave na lista e na ficha: cinza à esquerda para desligado, verde à direita para ligado.
  Selo com o estado, acesso pelo teclado, `role="switch"`, `aria-checked` e bloqueio ao salvar.
- Sem conteúdo preparado, a chave fica desabilitada com o motivo. Outros papéis veem só o selo.
- Regras exigem gerente ativo da agência, transição entre `active` e `inactive` e AuditLog
  atômico com autor, agência, imóvel e estados anterior/novo correspondentes. A operação
  não permite alterar dados, build, corretor ou agência junto com a visibilidade.
- Registrar ou reverter um build preserva a disponibilidade escolhida pelo gerente.
- Tokens e endereços permanecem: raiz e encaminhamentos retornam 410 durante a pausa e voltam
  ao mesmo conteúdo ao reativar. Permanecem expiração/revogação próprias dos links e as 48h do Kanban.

## Validação

- Suíte conjunta: 44 testes de regras e 78 de painel. Na primeira execução, 121 passaram;
  um teste novo reenviava o corretor já atribuído, sem mudança real, esperando uma negação.
  Corrigido o caso para efetivamente trocar a atribuição, os três testes de visibilidade
  foram reexecutados e passaram. Nenhuma implementação mudou entre essas execuções.
- Casos: papéis negados, agência alheia, auditoria incorreta/ausente, mistura de campos,
  conteúdo ausente, tokens preservados e pausa mantida ao registrar/reverter build.
- Build de produção e TypeScript aprovados; diff dos arquivos da tarefa sem erro de whitespace.
- Navegador no emulador: gerente pausou pela lista e reativou na ficha pelo teclado;
  administrador e corretor receberam zero chaves. Fluxo do gerente sem erros/avisos no console.
- Capturas em `tmp/publicacao-gerente-ligada.png` e `tmp/publicacao-gerente-desligada.png`.
- Quatro HTMLs e três bundles do domínio oficial idênticos ao build local, byte a byte.
  Regras online relidas e idênticas ao arquivo testado.

## Implantação

- Hosting: `sites/imobilaria-deccb-painel/versions/f1d93f9034734190`.
- Hosting anterior: `sites/imobilaria-deccb-painel/versions/2f52f171f192be72`.
- Regras: `projects/imobilaria-deccb/rulesets/78946d95-56d2-4525-822b-94c25aa207ce`.
- SHA-256 das regras normalizadas em LF:
  `5497580c5520a1321a81d284d848ff4de2a1682804b9d4274dfa737237849e58`.
- Regras anteriores: `projects/imobilaria-deccb/rulesets/731f84b8-41b3-410e-a03f-04305ad982fb`.
- Deploy somente de regras Firestore e Hosting do painel. Nenhum imóvel foi alterado em
  produção nesta etapa. Funções, índices, segredos, IAM e outros sites foram preservados.

## Arquivos desta etapa

`firebase/firestore.rules`, `painel/src/components/publicacao.tsx`,
`painel/src/app/(agencia)/properties/view/page.tsx`,
`painel/src/app/admin/properties/view/page.tsx`, `painel/src/lib/publicar.ts`,
`painel/tests/disponibilidade-publicacao.test.ts`, `painel/tests/publicacao.test.ts`,
`tasks/painel/proposta.md` e os dois relatórios de controle/gerente. As alterações desta
conversa estão incluídas no commit autorizado pelo usuário em 24/10/2026. O trabalho
pendente de outras conversas foi preservado fora desse commit.
