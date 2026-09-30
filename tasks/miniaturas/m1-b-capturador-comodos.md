# M1-B — captura local de cômodos

Rota `/capturador` do painel, isolada da produção. Estado somente em memória
da aba: recarregar perde a planta. O usuário inspeciona e baixa `leitura.json`.
Não há importação, persistência, cadastro comercial, portas/janelas, Blender,
normalização, Request, BuildJob ou publicação neste estágio.

## Decisões

- SVG em escala com Pointer Events, sem biblioteca nova. Grade visual de 1 m;
  não quantiza medidas. O enquadramento fica estável durante o arraste.
- Nome, largura, profundidade e pé-direito declarados, sem altura implícita.
  O pé-direito é único para a planta conforme M1-0, explicitado na interface.
  Medidas são nominais entre eixos, não medidas livres acabadas.
- Entrada textual em metros aceita vírgula/ponto e até três casas decimais.
  Conversão por partes inteiras para mm; casas extras são rejeitadas.
- Posição de gesto é quantizada para mm inteiro. Snap de 12 pixels convertido
  à escala do SVG copia exatamente a coordenada da parede vizinha; em contato,
  alinha extremidades próximas. Empates usam ordem estável de IDs. Não há
  rotação, redimensionamento livre, atração apenas por vértice ou grade.
- IDs de cômodos e paredes persistem ao editar/mover/desfazer. Contador não
  recicla IDs após undo. Revisão avança em cada alteração confirmada, inclusive
  undo/redo. Um arraste inteiro ocupa uma entrada no histórico.
- Relações são reconstruídas deterministicamente por contato de comprimento
  positivo. Sobreposição e desconexão ficam visíveis e impedem exportação;
  não há reparo automático. Edição de medidas ainda não aplicada também bloqueia.
- JSON M1-0 1.0.0: procedência declarada, referências e aberturas vazias, sem
  contexto comercial. Serialização estável para o mesmo estado confirmado.

## Fronteira e validação

`modelo.ts` contém edição e feedback rápido; **não substitui o validador
normativo Python M1-0**. `tests/test_capturador.mjs` usa a lógica real do frontend
para gerar um L de três cômodos e invoca `pipeline.validar_leitura` em subprocesso.
Também reproduz byte a byte o download real do smoke e o submete ao mesmo gate.
Esses testes entram no `npm test` existente e, portanto, no CI completo.

O layout anterior carregava `SessaoProvider` globalmente, que importa Firebase e
observa autenticação/documentos. `SessaoDaRota` desvia somente `/capturador` (com
ou sem barra final) e carrega o provider por React.lazy nas demais rotas. Portões,
regras e fluxos autenticados existentes permanecem no caminho de sessão.

Comandos: na raiz, `node --test tests/test_capturador.mjs`, `npm test` e
`npm run test:py`; em `painel`, `npm run typecheck` e `npm run build`.
Para uso local: `npm run dev` em `painel`, abrir `/capturador`.

## Limites e continuidade

Smoke em viewport mobile com ponteiro de navegador desktop, não em aparelho
físico. Pointer capture/cancel e toque são tratados pela API, mas Android/iOS
reais ainda exigem validação. Sem pan/zoom dedicado; plantas muito extensas ou
cômodos muito pequenos podem dificultar o arraste. Lista e passos de 10 cm
oferecem alternativa de seleção/movimento. Rolagem ocorre fora do SVG.

M1-C, persistência e integração produtiva dependem de autorização posterior.
Precisão do renderer legado de 5 cm permanece gate da integração futura.
Evidências e sequência do smoke: [checkpoint](../checkpoints/m1-b-2026-09-30.md).
