# Spec — relatorios-acesso

Objetivo: resultados por imóvel/corretor/período com entrada pela raiz,
encaminhamento, retorno, incerteza e permanência por seção. Depende de
links-corretor/navegacao-metricas. Contrato: [CONTRATO](rastreabilidade/CONTRATO.md).

Estrutura: `rastreabilidade/relatorios.mjs`, API `/report` e componente
`painel/src/components/rastreabilidade.tsx`. Estilo: agregação pura,
`resumir(sessoes,{from,to})`, sem identidade privada na resposta.
Verificação: `node --test tests/test_rastreabilidade_servidor.mjs`; painel com
dados locais, `npm --prefix painel exec -- tsc --noEmit` e build.

Aceite: agente vê só suas raízes/resultados; gerente só agência; staff conforme
papel existente. Distintos no período, sem somar únicos diários/por corretor;
tempo/seções reconciliam com o total; relatórios limitados sinalizam parcial;
ausência de coleta não vira afirmação de zero visitantes. Sem histórico retroativo.

Sempre mostrar período, estimativa, tempo ativo e cobertura de aceite. Nunca
mostrar visitorKey/recibos/IPs, prometer atenção humana ou exposição por cômodo.
Período seleciona sessões iniciadas em `[from,to)`, com contadores acumulados
até a consulta. A retenção detalhada é 30 dias; TTL preparado, sem deploy nesta
etapa. Leituras e autorizações verificam o prazo independentemente do TTL.
