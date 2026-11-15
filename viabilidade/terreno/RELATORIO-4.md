# Terreno — tarefa 4 — 15/11/2026

`novo_lote.py`: recebe base `completo|antigo`, índices de feições a partir de zero, zona existente e destino JSON; índices múltiplos formam remembramento, ordenados no ID/fonte.
Saída: lote EPSG:31983 a partir do lon/lat (nunca fx/fy), coordenadas com seis casas e área com três; frente de `avaliar()`, relevo de `bilinear()`/`resumir()`, zona informada pelo usuário e conferências falsas.
`python -I -X utf8 viabilidade/terreno/novo_lote.py --testar` passou: cinco pilotos reproduzidos em polígono/área/relevo (tolerância 1e-6) e frente igual; diferenças manuais listadas no teste.
Remembramento completo/11984–11988 reproduziu 1.599,108 m²; base antiga também testada no índice 542.
Recusas verificadas: índice/zona inexistentes, repetição, lotes separados, contato só em ponta, sobreposição entre componentes, buracos e polígono inválido; CLI não deixa JSON parcial nem altera destino existente quando recusa.
Casos reais da base completa: 0 sem frente; 104 sobreposto ao vizinho 105; 295 invade o asfalto. Mensagens distinguem os três motivos.
Motor: completo/19, fora dos pilotos, com SC-Z1 informada → CLI `motor/gerar.py` concluiu sem erro, 0 opções e 4 ausências explicadas.
Tempo: 6,990 s para a CLI de um lote em processo novo, sem cache da aplicação; carga de base/ruas/raster: 6,304 s. Cache do SO não limpo; não houve otimização.
Limites: sem vistoria ou inferência de zona; frente/esquina são indicações da malha; Copernicus DSM ~30 m, com o mesmo aviso de precisão. LID e enriquecimentos manuais omitidos; áreas especiais não verificadas. União sem buffer/gaps: tolera só interseção numérica até 1e-6 m² entre componentes.
Fontes, `lotes-piloto.json`, `dados/` e scripts preexistentes preservados por hashes; testes usam e removem saídas temporárias. Apenas script novo, teste e este relatório; sem commit.
