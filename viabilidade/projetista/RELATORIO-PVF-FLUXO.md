# Fluxo de ponta a ponta e cargas na torre (17/11)

Criei `fluxo.py` e `test_fluxo.py`. Mexi em `cargas.py` (versão 0.2.0) e `pacote.py` (versão 0.2.0).
Não mexi em `sintese.py` nem nos testes de cargas e pacote: os 6 de cada continuam passando sem mudança.
Não toquei em `vitrine.py`, `test_vitrine.py`, `vitrine/` nem em nada fora desta pasta. Nada de rede. Não commitei.

## 1. `fluxo.py`

Comando:

```
python viabilidade/projetista/fluxo.py <piloto> <pasta> [--terreo] [--sondagem arq] [--escopo a,b]
```

- **Ordem:**
  1. lê a sondagem, se houver;
  2. gerador (melhor revisão);
  3. `torre.compor`;
  4. `sintese.avaliar`;
  5. `cargas.estimar`;
  6. `pacote.montar`.
- **Com `--sondagem`:** a avaliação cita o cadastro em `evidencias.sondagem`, e o pacote confere a citação.
- **Arquivos gravados:**
  - `revisao-01.json`: o pavimento;
  - `revisao-02.json`: a torre, filha da 01;
  - `avaliacao-02.json`, `cargas-02.json` e `pacote-02.json`: as peças da torre.
- **Tudo ou nada:** tudo é calculado antes de gravar.
  - Se uma etapa falha, a saída diz `falhou na etapa <nome>: <motivo>`, o código é 1 e nenhum arquivo é gravado.
  - Na gravação, um arquivo existente com outro conteúdo para tudo antes de gravar qualquer coisa.
  - Se a falha vier no meio da gravação, o que esta rodada criou é apagado.
- **Sem relógio:** duas rodadas dão os mesmos bytes.

## 2. Cargas na torre (22421)

A torre do 22421 tem 2 pavimentos: 2 andares tipo sem térreo, ou térreo + 1 andar tipo com térreo.
Faixas em mínimo / central / máximo:

| Torre | Pavimento (topo → base) | g (kN) | q (kN) | Total (kN) | kN/m² | Acumulado do topo (kN) |
|---|---|---|---|---|---|---|
| sem térreo | andar_02 (z 3 m) | 2193 / 3155 / 4319 | 624 / 692 / 854 | 2817 / 3847 / 5174 | 6,99 / 9,54 / 12,84 | 2817 / 3847 / 5174 |
| | andar_01 (z 0 m) | 2193 / 3155 / 4319 | 624 / 692 / 854 | 2817 / 3847 / 5174 | 6,99 / 9,54 / 12,84 | **5633 / 7694 / 10348** |
| com térreo | andar_01 (z 3 m) | 2193 / 3155 / 4319 | 624 / 692 / 854 | 2817 / 3847 / 5174 | 6,99 / 9,54 / 12,84 | 2817 / 3847 / 5174 |
| | terreo (z 0 m) | 2193 / 3155 / 4319 | 1092 / 1180 / 1180 | 3285 / 4335 / 5499 | 8,15 / 10,75 / 13,64 | **6102 / 8182 / 10673** |

- O acumulado cresce até a base, e o total da torre é a soma dos pavimentos.
- O aviso "pilha de pavimentos ausente" some.
- O térreo usa `q.hall` e `q.garagem`, que já existiam. Por isso o q dele é maior.
- A laje tem 403,1 m².
- **Isto não é carga na fundação.** O aviso fixo continua.

**Desconto do vão.** O vão do elevador e do shaft não leva mais o g da **laje**. Vigas, pilares, paredes e piso continuam espalhados pelo contorno inteiro.
- O vão é a união dos dois polígonos dentro da laje: 9,74 m² por pavimento.
- O desconto é de 9,74 m² × 2,5 / 3,0 / 3,5 kN/m², ou seja, 24 / 29 / 34 kN por pavimento.
- No andar tipo, o g central foi de 3184,5 para 3155,3 kN.
- O total da torre caiu:
  - sem térreo: de 5682 / 7753 / 10416 para 5633 / 7694 / 10348 kN;
  - com térreo: de 6150 / 8241 / 10742 para 6102 / 8182 / 10673 kN.
- A parcela `g.laje` traz `vao_descontado` (área em m² e `element_ids`).
- O q não muda, porque o vão já não tinha sobrecarga.

## 3. Pacote: a sondagem citada na avaliação

A avaliação que cita uma sondagem (`evidencias.sondagem`) fica `invalida` quando o pacote:
- tem outra sondagem: "avaliação cita outra sondagem: sond_ficticia_01 (sha…), o pacote tem sond_ficticia_01 (sha…)";
- não tem sondagem: "avaliação cita a sondagem X, ausente no pacote".

A avaliação que não cita sondagem não tem o que conferir.

## Testes (só assert, sem depender do rótulo da síntese)

- **`test_fluxo.py`: 5 passam.**
  1. **22421, sem e com térreo:**
     - grava os 5 arquivos, com os mesmos bytes em duas rodadas;
     - a torre é filha do pavimento;
     - avaliação, cargas e pacote ficam ligados pelo `revision_id` e pelo sha da torre;
     - as 4 peças ficam `valida` e o `pacote_valido` dá `True`.
  2. **Cargas da torre:**
     - o acumulado cresce até a base;
     - o total é a soma dos pavimentos (até 0,01 kN);
     - não há aviso de pilha;
     - o térreo usa hall e garagem.
  3. **Desconto do vão:** comparei com a mesma torre sem elevador e shaft.
     - o g cai exatamente vão × g da laje (até 0,01 kN), no mínimo, no central e no máximo;
     - sem vão, o g é o contorno inteiro;
     - o q é idêntico.
  4. **Sondagem citada:**
     - a avaliação que cita outra sondagem fica `invalida` com motivo, e a sondagem do pacote continua `valida`;
     - a avaliação que cita uma sondagem ausente também fica `invalida`;
     - a avaliação que cita a certa, ou que não cita nenhuma, fica `valida`.
  5. **Etapa que falha:**
     - cargas forçadas a falhar, sondagem inexistente, conflito no `pacote-02.json` e erro de disco na 3ª gravação;
     - em todos, a mensagem diz a etapa e nenhum arquivo novo fica na pasta.
- **Continuam passando:**
  - `test_cargas`: 6;
  - `test_pacote`: 6;
  - `test_sintese`: 13;
  - `test_sondagem`: 3;
  - `test_projetista`: 18;
  - `test_gerador`: 8;
  - `test_editor`: 10;
  - `test_torre`: 7.

## Limites

- **Número de unidades:** o fluxo usa o padrão do gerador (`PADROES["unidades"]`). Não abri opção para mudar.
- **Cargas antigas:** um `cargas-NN.json` gravado com a versão 0.1.0 agora sai "versão do método mudou". Isso é de propósito, porque a conta mudou.
