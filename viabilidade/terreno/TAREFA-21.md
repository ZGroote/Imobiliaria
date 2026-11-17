# Tarefa 21 do Terreno: recuperar lotes recusados por engano (consertos 2 e 1 do RELATORIO-20)

**Quem:** Terreno.
**Galho:** `viabilidade/pos-124`, worktree `C:/Users/respawn/Desktop/imobiliaria-viabilidade`.
**Onde mexer:** `viabilidade/terreno/` (código e testes). Não mexer em `dados/`; se precisar de arquivo novo de dado (por exemplo, as vias do OSM), pare e diga qual, de onde vem e quanto pesa.
**Não fazer:** não commitar; não tocar em motor, tela, relatório nem `conferir.py`.

## Decisão da central (com segunda opinião)

Do `RELATORIO-20.md`, aplicar o **2** e depois o **1**.
- O **3** (testada de 5 m) fica fora.
- A margem de 10 m da zona **não muda**.

### Parte A: conserto 2, `make_valid` no vizinho inválido

- Use só na conferência de sobreposição. O lote estudado não muda.
- Se o vizinho consertado mudar de área mais de 1%, recuse com o motivo, em vez de aceitar.
- Teste com 68044 e 17553: diga o que acontece com cada um.

### Parte B: conserto 1, rua do OSM como segunda fonte de frente

Só entra quando a malha de asfalto não deu frente. Salvaguardas:

1. **Tipos de via:** `residential`, `primary`, `secondary`, `tertiary` e `living_street`. Fora `track`, `unclassified` e `service`.
2. **Proximidade e paralelismo:** o lado livre (≥ 8 m) fica a até 8 m do eixo da via e quase paralelo a ela (diga o ângulo que escolheu e por quê). Não basta estar perto.
3. **A via se liga à rede:** o trecho do OSM toca a malha de asfalto ou outra via aceita. Um trecho solto na mata não conta.
4. **Ambiguidade:** se o lote tiver mais de uma via candidata (esquina, fundo), a principal é a mais perto e o lote leva o alerta "frente pela rua do OSM, conferir qual é a testada".
5. **Rastro:** a frente sai com `regra: "rua_osm"` e com o nome/id da via, a classe, a distância e o ângulo, como as outras regras.

Escreva no texto de método que o OSM indica uma frente provável, mas não prova testada legal nem acesso público.

### De onde vem o OSM

Use o que o projeto já tem. Se não houver vias do OSM salvas para São Carlos, diga antes de baixar:
- de onde viria (só fonte aberta: extrato da Geofabrik ou Overpass, sem forçar nada);
- quanto pesa;
- se fica fora do git, como os mapas (cache).

## Aceite

- Rode de novo a mesma amostra da T20 (semente 20261120, 500 lotes) e mostre a tabela de antes e depois.
- Abra 10 lotes recuperados pelo conserto 1 na foto aérea. Em quantos a frente escolhida é a certa?
- Mostre também os que viraram aceitos e você acha errados.
- Os 7 pilotos e os lotes da T15 (75931, 92058, 46087, 62350, 73863, 77017, 76476) não mudam.
- Testes: `novo_lote.py --testar`, `gerar_lotes.py --testar`, `test_estudar.py`, `test_varrer.py` e `conferir.py` 8/8.

## Relatório

`viabilidade/terreno/RELATORIO-21.md`, até 15 linhas. Depois: `maestri ask "Claude Code" "Terreno tarefa 21 pronta"`.

## Decisão da central sobre o dado do OSM (15/11)

**Opção (a), comprimido:** `viabilidade/terreno/dados/osm-vias-sao-carlos.json.gz`, no git.
- O teste da main (`tests/test_tamanho_versionado.py`) barra arquivo acima de 1 MiB fora da lista de exceções, e essa lista fica fora de `viabilidade/`. O JSON puro (1,54 MB) obrigaria a mexer nela. Com gzip (~0,35 MB) não precisa. Leia com `gzip` da biblioteca padrão.
- O script gerador fica em `terreno/` e recebe o caminho do pbf por argumento (o pbf fica só na pasta principal, fora do git).
  - Grave a data do pbf (29/08/2026) e a origem (Geofabrik `sudeste-latest`) dentro do arquivo.
  - Para a mesma entrada, a saída tem que sair igual byte a byte: use `mtime=0` no gzip.
- Licença ODbL: o lote e o método citam "© OpenStreetMap contributors". Registre a fonte em `lei/FONTES.md` ou no documento do terreno que já lista as fontes.
- Liberado mexer em `dados/` só para esse arquivo novo.
- O `conferir.py` precisa passar 8/8. Se algum teste de dados privados reclamar do `.gz`, pare e diga qual.
