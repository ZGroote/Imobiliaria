# Spec — navegacao-metricas

Objetivo: observar sessões consentidas, navegadores estimados, visualizações e
tempo ativo por página/seção. Depende de cadeia-encaminhamentos. Contrato:
[CONTRATO](rastreabilidade/CONTRATO.md). Sem tracking de cômodos 3D.

Estrutura: `rastreabilidade/public/metricas.mjs`, eventos/sessões do servidor,
`tests/test_rastreabilidade_cliente.mjs` e testes do servidor.
Estilo: tempo injetável/monotônico; `observar({page,section,visible,now})`.
Verificação: testes com relógio controlado via `node --test tests/test_rastreabilidade_*.mjs`; prova real de aba oculta no navegador.

Aceite: recusa funciona sem analytics; duas visitas reconhecidas não viram duas
pessoas estimadas; pausa oculta/inatividade; intervalos sem sobreposição;
retry/duplicata não infla tempo/visitas; números inválidos/excessivos recusados;
encerramento perde no máximo o fragmento não entregue, sem presumir tempo.

Sempre limitar payload/tempo/frequência e minimizar dados. Nunca capturar IP,
conteúdo de formulário, câmera, fingerprint, replay ou recibos em logs.
Dados novos só em emulador/local nesta entrega; retenção detalhada 30 dias.
