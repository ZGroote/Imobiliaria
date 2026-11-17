# Vitrine: os 7 terrenos piloto prontos para a tela (Motor, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Terreno está mexendo na mesma pasta, em `fluxo.py`, `cargas.py`, `pacote.py` e nos testes deles: **não toque neles.** Você cria `vitrine.py` e `test_vitrine.py`. Os outros módulos (`gerador`, `torre`, `para_vista`, `editor`) você usa sem mudar; se for indispensável mudar, explique no relato.

## Para quê

O usuário quer mostrar a ideia para uma pessoa numa página com:
- a **lista de terrenos** para estudo;
- **onde fica** cada um no mapa;
- a **maquete** do prédio;
- **como o prédio fica no mapa**.

A tela é do Visual. Você entrega os **dados** de todos os pilotos, num formato que a tela só desenha, sem conta nenhuma.

## O que fazer

`python vitrine.py <pasta-saida>` percorre os pilotos de `viabilidade/motor/exemplos/pilotos/` (hoje são 7). Para cada um:

1. **Gera o prédio.** Roda o motor para obter o estudo, o mesmo caminho do exemplo 22421, e depois `gerador`, `torre.compor` sem térreo e com térreo e `para_vista`. Grava em `<saida>/terreno-N/`:
   - `estudo-previa.json`;
   - `estudo-previa-terreo.json`;
   - `resumo.json`, no formato da tarefa 22 do Visual (`viabilidade/visual/TAREFA-22.md`, seção "Formato do resumo"), com os números de `metrics_summary.torre`, cada um com sua unidade.
2. **Converte para o mapa.** Passa de UTM 23S (EPSG:31983) para WGS84, como `[lon, lat]` com 7 casas decimais:
   - o contorno do lote;
   - o centro;
   - a base de cada volume da torre, com `z0_m`, `altura_m` e `uso`, nas duas versões (sem térreo e com térreo).

   Use `pyproj` se estiver instalado. Se não estiver, use a fórmula padrão de UTM inversa em stdlib e confira com um ponto conhecido. Diga no relato qual dos dois usou e o erro medido.
3. **Grava o índice** em `<saida>/indice.json`, com um item por terreno:
   - `id`;
   - `nome` neutro ("Terreno 1"...);
   - `lote_ref` (o id do piloto);
   - `centro`;
   - `lote_wgs84`;
   - `volumes_wgs84` e `volumes_terreo_wgs84`;
   - o caminho do `resumo`;
   - `status`: `"ok"` ou `"falhou"`, com `motivo`.

   **Um piloto que falha não derruba os outros:** ele entra com `falhou` e o motivo, em linguagem simples.
4. **Nada de dado pessoal.** Use só o que o piloto já tem. Não leve nome de dono, CPF nem endereço de pessoa. Se o piloto tiver um campo assim, deixe-o de fora e diga isso no relato.
5. **Determinismo.** Sem relógio e com os mesmos bytes em duas rodadas. Grave com o `gravar` atômico do `esquema.py`.

## Testes (`test_vitrine.py`, só `assert`)

1. Rodar numa pasta temporária grava `indice.json` e uma pasta por piloto. O 22421 fica `ok`, com 12 unidades sem térreo e 6 com térreo.
2. Converter um ponto UTM e voltar dá o ponto de origem (até 0,01 m). O centro de cada lote cai dentro do contorno dele, e todos os pontos ficam em São Carlos (lat entre −22,2 e −21,8; lon entre −48,1 e −47,7).
3. Todo número do resumo tem unidade, e `area_computavel` bate com `metrics_summary.torre`.
4. Um piloto quebrado, feito à mão numa pasta temporária, sai `falhou` com motivo, e os outros saem normalmente.
5. Mesmos bytes em duas rodadas.
6. Continuam passando: `test_projetista` (18), `test_gerador` (8), `test_editor` (10), `test_torre` (7) e `test_para_vista`.

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Gere a saída de exemplo em `viabilidade/projetista/vitrine/`. A tela vai ler essa pasta.
- Relato curto em `RELATORIO-11.md`, com uma linha por terreno: unidades e andares sem e com térreo, ou o motivo da falha.
- Ao terminar: `maestri ask "Claude Code" "Motor tarefa 11 do projetista pronta"`.
