# Relatório da tarefa 16 do terreno (Claude Code, emprestado): o mapa está fora do lugar?

- **Resposta curta.** O erro não é de 3–5 m. Quem está deslocado são os **anexos**: as ruas do 02 e do 06 aparecem ~44 m a **leste** da realidade em toda a cidade, e no sentido norte-sul o erro vai de ~20 m para o norte (lado norte da cidade) a ~55 m para o sul (lado sul). A malha de asfalto e o cadastro estão certos. Os 3,53 m eram só o resíduo nos 5 controles do perímetro, que ficam quase todos no sul e no oeste. Isso não mede a posição das ruas.
- **Como medi.** As linhas de rua do OSM (pbf da Geofabrik já baixado, sem acesso à rede) são deslocadas de −150 a +150 m. Para cada fonte, procuro onde elas caem melhor: no asfalto da malha, fora dos lotes do cadastro, ou no cinza de rua de cada anexo, posicionado como no projeto (31983→29183→afim). Os scripts estão em `C:\Users\respawn\AppData\Local\Temp\claude\4a6da5d3290f4e1e\5cda8dae-e205-4e68-97d0-1170f5c342bd\scratchpad\t16\`: `python -X utf8 medir.py osm_ruas.json centro:201554,7562440 ...` e `python -X utf8 picos.py 02 ...`, que lista os 3 melhores picos para afastar o engano de meia quadra. Cada célula abaixo é a saída (dx, dy) em metros, com dx = leste e dy = norte, e indica onde a fonte está em relação ao OSM. Um "—" quer dizer escore fraco ou ponto fora do quadro.

| ponto (E, N em 31983) | malha | anexo 02 | 05 | 06 | 07 |
|---|---|---|---|---|---|
| Centro 201554, 7562440 | −4, −2 | +42, +8 | +54, +6 | +46, +10 | — |
| Lote 75931 201278, 7562395 | −2, 0 | +44, +10 | +56, +8 | +46, +10 | +64, −10 |
| NO 196886, 7568029 | −4, 0 | +46, −20 | +58, −20 | +44, −20 | +74, −44 |
| NE 203000, 7565750 | −2, −4 | +40, −24 | +64, −28 | +44, −20 | +80, −62 |
| SO 199205, 7558010 | — | +44, +56 | +40, +56 | +48, +54 | +28, +50 |
| SE 203463, 7559606 | — | +48, +20 | +60, +14 | — | +58, −2 |
| N 200800, 7566500 | −6, 0 | +40, −22 | +62, −22 | +42, −20 | +72, −50 |
| S 201500, 7557500 | +4, −8 | +42, +50 | +48, +44 | +48, +48 | +34, +38 |
| L 205500, 7562500 | 0, −4 | +40, −14 | +68, −20 | +48, −12 | +76, −38 |
| O 197750, 7562750 | −8, +2 | +52, +26 | +62, +26 | +54, +24 | +56, +14 |
| Aeroporto (2,7 km ao sul da pista) 199923, 7575380 | sem malha | fora do quadro | +90, −102 (fraco) | fora do quadro | — |

- **Fontes independentes.** O cadastro bate com o OSM: em todos os pontos que têm lote, 100% das ruas do OSM caem fora dos lotes sem deslocar nada (escore 1,0 em 0,0). A malha fica a até 8 m do OSM. Com essas duas fontes de acordo entre si, não foi preciso usar a foto aérea. **Os nomes das ruas confirmam a direção**, sem engano de quadra: na sobreposição do Anexo 02 com o OSM (`nomes.py`), a Rua Aquidaban, a Av. São Carlos, a Dona Alexandrina e a Nove de Julho do OSM ficam ~45 m a oeste da rua de mesmo nome no anexo. Já a Rua Jesuíno de Arruda fica só ~9 m ao sul.
- **Forma do erro: afim.** Nos 16 pontos medidos no Anexo 02, ajustei o erro como uma função afim da posição. Saiu `dx = 43,7 − 0,90·km_leste − 0,43·km_norte` e `dy = 11,4 − 4,98·km_leste − 8,20·km_norte`, com resíduo RMS de 2,5 e 2,0 m (máximo de 5 m). Ou seja: um deslocamento fixo de ~44 m para leste, mais uma escala e uma rotação no eixo norte-sul (−0,8% de escala). Não é ruído local. É a transformação que está mal ajustada, e os anexos 05 e 07 têm o mesmo padrão, mais forte. Um detalhe à parte: o pyproj faz 31983→29183 em modo "Ballpark", que só desloca −1 m para leste e −8 m para norte. Com os parâmetros do IBGE (`medir_ibge.py`), o dx vai a ~0, mas o dy piora (Centro −46). Então o problema não é só o datum: os 5 controles precisam ser refeitos.
- **Efeito na subárea do art. 80** (`efeito.py`: o lote é levado para a posição corrigida, +46, +10 no Anexo 06). O **74451 muda de lado**: hoje está DENTRO (encosta no tracejado a 0 m); corrigido, fica fora, a 19 m da borda, que é mais que a margem de ~11 m. Na imagem `l74451.png` ele cai no meio da quadra, a leste do tracejado. Ele perderia os 9 m. Os lotes 77015, 77022 e 77375 continuam DENTRO (a borda fica a 133–167 m) e o 80172 continua fora (a 110 m). Os 5 lotes continuam Z1 pelo Anexo 02, antes e depois.
- **Efeito nos pilotos.** As zonas dos pilotos foram anotadas à mão e não mudam. A sugestão automática dá o mesmo resultado nos casos abaixo:
  - 30516 (Z4), 37607 (Z4) e 25297 (Z1): mesma zona antes e depois.
  - 22426, 22421 e q1382: recusados antes e depois; só muda a lista de alternativas.
  - 75352: sai de Z2 decidido para recusado, por "divisa a menos de 10 m"; a única alternativa continua sendo Z2.
- **Conserto proposto (não apliquei).** Trocar os 5 vértices do perímetro por pelo menos 12 cruzamentos de ruas com nome, espalhados pelo quadro inteiro, incluindo o norte, que hoje não tem nenhum controle. A coordenada de cada cruzamento sai do cadastro ou da malha em 31983, e o pixel é lido no anexo. Depois, refazer a afim de cada anexo (02, 05, 06, 07) direto de 31983 para pixel, sem passar pelo SAD69 "ballpark". Pelo modelo afim acima, o resíduo deve cair para ~2–3 m. A subárea e os cones são lidos pela mesma afim, então o cache `subarea-06`/`cones-07` precisa ser invalidado.
- **Teste que pegaria o erro.** Em `test_sugerir_zona.py`, um conjunto de 8 cruzamentos de verificação que não entram no ajuste: nome, UTM tirada do cadastro e pixel lido à mão em cada anexo. O teste exige que a afim de cada anexo leve cada cruzamento ao pixel com erro de até 10 m (a `DIVISA_M`). Hoje ele falharia com 40–75 m. Um segundo caso fixo: o 74451 fora da subárea.
- **O que ficou.** Não mexi em código nem em `dados/`. O único arquivo novo é este relatório, e não fiz commit.
