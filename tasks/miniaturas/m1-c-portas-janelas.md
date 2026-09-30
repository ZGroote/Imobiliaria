# M1-C — portas e janelas locais

Extensão de `/capturador`, sem persistência ou integração produtiva. No modo
**Portas e janelas**, a pessoa seleciona uma parede existente no SVG (ou na
lista de paredes), informa medidas e cria a abertura. Não há desenho livre.
Portas usam traço ocre; janelas usam traço azul pontilhado. Aberturas também são
selecionáveis no SVG ou na lista, editáveis e excluíveis.

## Contrato e decisões

- Mantém `leitura` 1.0.0 e procedência declarada. Não muda schema, validador
  M1-0, normalizador M1-A ou consumidor produtivo.
- Medidas textuais em metros viram mm inteiros. Offset e peitoril aceitam zero;
  largura/altura continuam estritamente positivas. Sem percentuais persistidos.
- Offset parte da menor coordenada: esquerda para norte/sul, inferior para
  leste/oeste. A UI explica a direção e destaca a origem no SVG.
- Porta força `sillMm=0` no formulário; o modelo recusa porta com peitoril
  diferente de zero. Janela exige declaração de peitoril.
- Par é calculado ao criar/aplicar a abertura, usando as relações reais entre
  paredes. Trecho inteiramente compartilhado recebe `pairedWallId`; trecho
  externo omite o campo. Cruzar fronteira de trecho compartilhado é recusado,
  inclusive quando há dois pares diferentes na mesma parede.
- Limites de parede/pé-direito e sobreposição são bloqueios. Sobreposição é
  física, por eixo, coordenada fixa, intervalo longitudinal e altura: também
  detecta duplicatas inseridas pela face oposta. Contato só na borda é permitido;
  vãos separados verticalmente não se sobrepõem.
- IDs `aN` não são reciclados após undo. Aberturas entram no mesmo histórico
  dos cômodos; criação, edição, exclusão e restauração preservam identidade.

## Alterações posteriores de cômodos

Mover/redimensionar um cômodo ou alterar pé-direito pode invalidar uma abertura.
Ela permanece no estado, com seu offset/medidas/par, e bloqueia exportação até
revisão explícita. Aplicar a abertura recalcula o par para a geometria atual;
não há reparo silencioso ao mover cômodos.

Excluir o cômodo dono remove suas aberturas na mesma ação reversível. Abertura
de outro dono que apontava para a parede excluída permanece com par inválido;
a pessoa deve revisá-la. Undo restaura o estado completo.

## Gate e testes

Feedback TypeScript é local; a autoridade normativa continua sendo
`pipeline.validar_leitura`. Os testes serializam a lógica real do frontend,
passam o arquivo sem alteração por M1-0 e M1-A e verificam IDs/pares, centro
`p`, largura, `y0/y1` e vínculo de revisão. Sem renderer ou Blender.

`tests/test_capturador_aberturas.mjs` cobre os doze casos autorizados, faces
opostas, separação vertical, coordenadas negativas, centros de meio mm e
alterações de cômodos. Também reproduz byte a byte a fixture baixada no smoke.

Comandos na raiz:

```sh
node --test tests/test_capturador.mjs tests/test_capturador_aberturas.mjs
npm test
npm run test:py
```

No painel: `npm run typecheck`, `npm run build`; para uso local, `npm run dev`
e abrir `/capturador`. [Checkpoint e smoke](../checkpoints/m1-c-2026-09-30.md).

## Limites

Estado somente na memória da aba, perdido ao recarregar. Sem fotos, referências,
cadastro, salvamento no imóvel, Firestore, BuildJob, LEVE, Blender ou deploy.
Sem alteração do bypass de sessão aprovado em M1-B.

Alvos de parede/abertura ampliados no SVG e lista alternativa auxiliam seleção.
Em paredes coincidentes, o clique pode escolher a face desenhada por último;
a lista explicita cômodo/lado. O par identifica a mesma região física.
Vãos separados só em altura coincidem na vista superior; a lista permite
selecionar cada um. Plantas muito pequenas/extensas continuam sem pan/zoom dedicado.

Smoke em viewport 390 × 844 com ponteiro desktop não comprova touch físico.
**Aparelho físico é gate obrigatório de M1.1/usabilidade** antes de considerar
o capturador pronto para corretor. Integração produtiva e M2–M5 seguem bloqueados.
