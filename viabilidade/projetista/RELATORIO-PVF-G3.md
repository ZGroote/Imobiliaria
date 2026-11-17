# PVF-G3: cadastro de sondagem SPT e ligação na síntese (17/11)

Criei `sondagem.py`, `test_sondagem.py` e `exemplo-sondagem-ficticia.json`. Mexi em `sintese.py` e `test_sintese.py`.
Não toquei em `editor.py`, `test_editor.py`, `para_vista.py`, `test_para_vista.py` nem em nada fora desta pasta. Nada de rede. Não commitei.

## 1. `sondagem.py`: só cadastro

- Contrato `sondagem/0.1.0`, descrito no topo do arquivo. Guarda:
  - id, CRS, referência a estudo/lote e empresa;
  - profissional (nome, conselho e registro, os três obrigatórios);
  - método em texto com `verified`;
  - data do ensaio em texto.
- **Furo:** id, posição UTM, cota da boca (número, ou `null` com motivo), profundidade final e critério de paralisação.
- **SPT por metro:** guarda os golpes e a penetração crus de cada um dos 3 segmentos de 15 cm.
  - `n_spt()` soma o 2º e o 3º segmento.
  - Um N digitado é recusado: tanto um campo `n_spt` solto quanto uma leitura sem segmentos dão erro.
  - Penetração incompleta é guardada como veio, sai com N `None` e `penetracao_incompleta: true` no `perfil()`, e gera um **aviso**.
- **Camadas:** topo, base, descrição e classificação livre. Precisam ser contíguas até a profundidade final, sem sobreposição e sem buraco.
- **Nível d'água:** profundidade (ou "não encontrado") e leitura, ambas em texto.
- **Selo:** `investigation_sha256` sobre o JSON canônico do esquema.
  - `selar_sondagem` recusa cadastro com erro; aviso não impede.
  - A gravação usa `esquema.gravar(..., selador=selar_sondagem)`.
  - `ler_sondagem` confere o selo e a forma canônica.
- Não há cálculo de capacidade, tensão ou fundação. O N-SPT é só o dado do boletim.

## 2. Conferências (`conferir(inv, lote_utm)`)

- **Aviso:**
  - furo fora do lote (diz a distância até a divisa);
  - penetração incompleta.
- **Erro:**
  - camada que passa da profundidade final;
  - sobreposição de camadas;
  - buraco entre camadas ou antes do fim;
  - N sem segmentos;
  - segmento negativo (golpes ou penetração);
  - profissional sem nome, conselho ou registro;
  - cota nula sem motivo;
  - campos obrigatórios vazios.
- Cada item traz `nivel`, `elemento` e `motivo`.

## 3. Síntese (`sintese/0.3.0`)

- `sintetizar(..., sondagem=cadastro)` e `avaliar(..., sondagem=cadastro)`: a síntese recebe o cadastro. Em `evidencias["sondagem"]` vai a referência `{"investigation_id", "sha256"}`.
- O motivo "Falta sondagem do terreno" só sai quando:
  - o id bate com o cadastro;
  - o sha da referência bate com o selo gravado **e** com o selo recalculado (um cadastro mexido sem selar de novo cai);
  - o cadastro não tem erro, o que inclui o profissional completo.
- **Motivos novos:**
  - `"sondagem declarada sem cadastro"`, para o `True` antigo;
  - "Selo da sondagem não bate com a referência";
  - "Sondagem referenciada não está no cadastro";
  - "Sondagem com erro no cadastro: …".
- **O geotécnico nunca fica `conforme`:** mesmo com achado conforme e sondagem válida, o domínio vira `nao_verificado`, com a ação "Falta método de cálculo geotécnico validado por engenheiro (PVF-G4)". Com o geotécnico no escopo, a síntese fica no máximo CONDICIONAL.

### Teste antigo que mudei (e por quê)

O `test_trava` da PVF-G1 exigia duas coisas que a regra nova proíbe:

- **`COM` (com `sondagem: True`) → VERIFICADO.**
  - Agora `True` trava, e o geotécnico nunca fica conforme.
  - O `COM` passou a usar a referência do exemplo fictício e espera CONDICIONAL.
  - Sem o geotécnico no escopo (geométrico + estrutural), o mesmo `COM` ainda dá VERIFICADO, então a trava estrutural continua testada.
- **O `SEM` dava "regra 4 da precedência".**
  - Agora dá regra 3, porque o geotécnico `nao_verificado` segura a síntese antes da trava.
  - Os 4 motivos continuam iguais.

Também mudei duas coisas pela versão nova:
- o literal da versão do motor passou para `sintese/0.3.0`;
- o teste de "versão do método mudou" agora usa `0.2.0` como versão velha.

## 4. Exemplo fictício

`exemplo-sondagem-ficticia.json` é um boletim fictício, já selado:
- `"ficticio": true`, com o aviso dentro do arquivo;
- empresa, profissional e registro inventados;
- 2 furos dentro do lote 22421:
  - SP-01: 6 m, com cota da boca;
  - SP-02: 5 m, cota `null` com motivo e o último metro com penetração incompleta (30/15, 25/10).

## Testes (só assert)

- **`test_sondagem.py`: 3 passam.**
  1. O exemplo carrega, sela de novo e regrava com os mesmos bytes, e o N-SPT é a soma dos segmentos.
  2. Dão erro com motivo, e o `selar` recusa:
     - camadas sobrepostas, buraco no meio, buraco no fim e camada abaixo da profundidade final;
     - N sem segmentos e `n_spt` digitado;
     - registro em branco e conselho faltando;
     - golpe negativo e penetração negativa;
     - cota nula sem motivo.
  3. Furo 21 m fora do lote dá aviso, não erro, e sela.
- **`test_sintese.py`: 13 passam.** O novo é `test_sondagem_na_sintese`. Ele confere:
  - `True` trava com o motivo novo;
  - sha errado, cadastro mexido, cadastro ausente e profissional incompleto (com selo refeito) travam;
  - uma referência válida tira só o motivo da sondagem;
  - no adversário, o geotécnico nunca fica conforme e a síntese fica CONDICIONAL, tanto no escopo de 5 domínios quanto só com o geotécnico;
  - o `avaliar` com o cadastro dá uma avaliação válida.
- **Também passam:**
  - `test_projetista`: 18;
  - `test_gerador`: 8.
- **`test_para_vista` (do Motor, só rodei): falha, e a causa não é desta tarefa.**
  - Ele exige o sha de bytes do piloto `motor/exemplos/pilotos/SC-completo-22421.json`.
  - Esse piloto é um dos arquivos soltos que já estavam mexidos antes de eu começar.
  - O `git diff` não mostra mudança de conteúdo, só o aviso de fim de linha (LF/CRLF).
  - Não toquei nele.

## Limites

- O teste de furo fora do lote usa o polígono do lote passado pelo chamador. A síntese não confere a posição: isso fica com quem monta o estudo.
- `avaliacao_valida` não guarda o cadastro, só a referência. Para revalidar a sondagem, é preciso ter o cadastro em mãos.
