# Preparação da homologação M1.1-A — 04/10/2026

O usuário confirmou que ainda não existem as cinco sessões físicas e pediu para
prepará-las. Esta entrega torna a rodada executável; o aceite continua pendente
até haver observação, exports e evidências dos aparelhos reais.

Baseline do capturador: `4586e7cec78155369ea10cdc37fc0418ada02e61`, após a
consolidação. Os pilotos anteriores e a baseline `d4a0307` não contam nesta rodada.
O protocolo recuperado de `1b4d303` será adaptado aos downloads atuais, aos dois
pavimentos e à preservação dos móveis. Não se muda a UI durante esta preparação.

## Incrementos e verificação

- [x] Recuperar o protocolo e preparar uma ficha vazia reutilizável: cinco plantas
  reais distintas, dois operadores, evidência física, métricas separadas e
  critérios de parada. Verificar que nenhum ensaio local fecha o aceite.
- [x] Preparar um pacote local com apenas a rota do capturador e seus assets,
  build da baseline identificada, hashes, cinco fichas não iniciadas e índice.
  Testar recusa de destino ocupado, divergência da fonte e alteração do bundle.
- [x] Extrair e avaliar downloads sem alterar os originais, usando o mesmo modelo
  puro do editor e os portões Python. Preservar cada piso e seus móveis; geração
  demonstrativa ou com contexto real explicitamente escolhido. Testar roundtrip,
  recusas e distinção entre validação técnica e aceite físico.
- [x] Gerar a rodada local, conferir hashes e acesso HTTPS às rotas previstas,
  testar o percurso com fixtures sintéticas e documentar os comandos finais.
  Atualizar o índice de continuidade e registrar os resultados desta preparação.

## Limites desta entrega

As fichas começam sem tempos, participantes ou resultados inventados. Fontes e
exports reais ficam em `publicacao/`, ignorado pelo Git. O servidor serve somente
uma pasta dedicada, nunca a pasta de evidências. Não se expõe a API demonstrativa
na LAN, não se altera o firewall e não se publica o produto. Na sessão, o download
vai ao PC sem edição; a maquete gerada volta ao mesmo celular por HTTPS.

M1.2 e M2 seguem depois da homologação e da decisão sobre as limitações encontradas.
Os planos históricos permanecem preservados; este documento registra o incremento
autorizado no novo cronograma.

## Resultado da preparação

Pacote local: `publicacao/m1-1a/rodada-2026-10-04/`. Contém site enxuto (43 arquivos),
manifesto, instruções operacionais e C1–C5 com fichas `nao-iniciada`, sem métricas
observadas. SHA-256 do manifesto:
`3b9552b190b30afb88b9ce9eee1d9fbf09201a20ae57ca5ed4767aef0f115582`.
O verificador também confere ferramentas, schemas, renderer e a equivalência do
modelo puro do avaliador com o editor congelado.

Verificação desta entrega:

- Node: 217/217, incluindo oito testes do novo avaliador.
- Python: 329/329, incluindo treze testes da preparação.
- Build da baseline com `npm ci --include=dev` em cópia nova: 23 páginas estáticas;
  pacote separado somente do capturador, com a barreira de conteúdo do CI.
- HTTPS local: certificado exato e hostname verificados; 44 respostas 200 com
  identidade dos arquivos conferida, seis respostas 404 para raiz/rotas fora do
  pacote/evidências. Registro local: `verificacao-https-local.json` dentro da rodada.
- Navegador in-app em 390 px: capturador vazio e render inicial da maquete sintética,
  sem overflow horizontal ou erros de console. UI verificada em HTTP loopback;
  HTTPS verificado separadamente com validação do certificado. Não é teste físico.
- Ensaio sintético separado em `publicacao/m1-1a/ensaios-preparacao-2026-10-04/`:
  leitura preservada, gates positivos, geração demonstrativa; encaixe real não
  avaliado e `physicalAccepted: false`. Nenhuma ficha C1–C5 recebeu esses resultados.

A primeira instalação em modo de produção omitiu dependências de compilação.
O preparador agora inclui as dependências de desenvolvimento durante `npm ci`.
O checkout reaproveitado continuou com erro de resolução após a instalação; o
build aceito foi executado numa cópia nova, sem seu cache anterior.

Preparação concluída; homologação continua **0/5**. A rede do PC permanece Pública;
o preflight de acesso pelo telefone está pendente. Nenhum deploy ou ajuste de
firewall foi feito. As próximas ações são escolher as cinco fontes reais e dois
operadores, conferir HTTPS nos aparelhos e conduzir o protocolo antes de M1.2/M2.
