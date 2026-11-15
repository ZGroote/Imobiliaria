# Tarefa 9 — diagnóstico
O ~1,3 s e os 9,5 s ficam no caminho até o primeiro render; imports CDN precedem o fetch do estudo.
O relatório não bloqueia a maquete: o HTML só é buscado após clique; o piloto está desatualizado (0.8.0, sem SHA; JSON 0.8.1).
O remembramento tem 47.644 bytes e 448 vértices; parse/hash em Node local: 0,53/0,69 ms.
O intervalo 346 ms → 9.515/9.520 ms veio com diferença de 88.194 bytes entre a rodada rápida e as lentas.
A medição agregada não separa CDN, fetch local e criação WebGL; não atribui exatamente os 9 s nem o ~1,3 s.
Sem causa específica confirmada, não alterei o Visual; não consegui repetir porque o Windows bloqueia o bind local.
`MEDICAO.md` registra a análise e deixa a repetição pendente, sem substituir a linha de base.
