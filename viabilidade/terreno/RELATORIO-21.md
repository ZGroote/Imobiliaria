# T21: vizinho inválido consertado e rua do OSM como 2ª fonte de frente (15/11)

**Parte A (conserto 2):** o vizinho inválido passa por `make_valid`, e a validação é recusada se a área mudar mais de 1%. Isso não aconteceu nenhuma vez na amostra. O 68044 agora é aceito pela borda de quadra (com zona `auto`, recusa por zona). O 17553 mostrou uma sobreposição real de 4,639 m² com o 14583. O `obs` registra `vizinhos_consertados`. Conferi na foto os 12 que passaram de "inválida" para aceito: os 12 têm a frente certa.
**Parte B (conserto 1):** só entra quando a malha não deu frente. A via precisa ser de uma das 5 classes, estar ligada à malha, ficar a até 8 m do eixo e ter ângulo de até 20° (o dobro do giro que já junta lado picotado; a lateral de esquina fica perto de 90°). O lado não pode encostar em outro lote, e a ligação do lado até o eixo não pode cortar lote. O rastro é `regra:"rua_osm"` mais `via_osm` (id, nome, classe, data), distância e ângulo. Com mais de uma frente, sai um ALERTA. O texto de método diz que o OSM indica uma frente provável, mas não prova testada legal nem acesso público (© OpenStreetMap contributors, ODbL).
**Dado:** `dados/osm-vias-sao-carlos.json.gz` tem 6.434 vias, 0,34 MiB e sha256 `81d8b494…ec1a8a`. Gerei duas vezes e saiu igual byte a byte. Quem gera é `osm_vias.py <pbf>`, a partir do Geofabrik `sudeste-latest` de 28/08/2026. A fonte e a licença estão no `LOTES.md`; não mexi em `lei/FONTES.md`.

| Sorteio 500 (semente 20261120) | aceito | frente | zona | inválida | buraco | sobreposição | asfalto |
|---|---:|---:|---:|---:|---:|---:|---:|
| antes (T20) | 171 (34,2%) | 157 | 110 | 33 | 18 | 10 | 1 |
| depois | **214 (42,8%)** | 118 | 137 | 0 | 18 | 12 | 1 |

Aceitos por regra: borda 89, tolerância de 12 m 63, **rua_osm 31**, aresta de 6 m 28, colineares 3. Na REVISAO-6 (20 lotes), os aceitos ficaram em 9 → 9; frente foi de 5 para 3 e zona de 6 para 8.
**Fotos:** nas 10 primeiras rua_osm, 9 estão certas (12741, 28105, 28425, 29544, 31571, 48312, 49269, 49287, 49449). Uma é duvidosa: no **44140**, a via sem nome passa por dentro de uma faixa de árvores ao lado da rodovia e a foto não mostra pista. Nas outras 21, todas parecem certas, menos o **53547**, também duvidoso: a linha do OSM corre por trás de uma fileira de casas, e a pista pode estar do outro lado. O 61394 dá para estrada de terra: o lado está certo, mas não é asfalto.
**Pilotos e T15:** sem mudança. A única diferença: o 75352–75354, pelo `novo_lote`, era recusado por causa do vizinho inválido 75351 e agora reproduz o `lotes-piloto.json` exatamente.
**Testes:** atualizei 3 testes que esperavam o comportamento antigo:
- 75352–75354: agora recusa a zona automática por estar a menos de 10 m da divisa.
- 14421+14429: agora sai `rua_osm`; a via 44782760 fica do lado certo na foto.
- 76495: mudou o texto da recusa.

Criei também um teste sintético da regra 4: aceita giro de 15°; recusa `service`, `track`, `unclassified`, giro de 30° e trecho solto.

Passaram: `novo_lote --testar`, `gerar_lotes --testar`, `test_estudar`, `test_varrer` e `conferir.py` **8/8**. O Motor lê `rua_osm` pela mensagem genérica de frente presumida (`motor.py:784`), e isso não quebra nada.
