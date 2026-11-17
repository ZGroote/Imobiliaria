# PVF-G3: cadastro versionado de sondagem SPT (Terreno, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. O módulo fica no pacote do projetista: um contrato só, como manda o `PVF-G0.md`, seção 6.1. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Motor está mexendo na mesma pasta, em `editor.py` e `test_editor.py`: **não toque neles.** Você cria `sondagem.py` e `test_sondagem.py` e pode mexer em `sintese.py` e `test_sintese.py`.

**Leia:**
- `PVF-G0.md`, seções 2, 6 e 7;
- `DECISOES-PVF-G0.md`;
- `sintese.py`: a trava das linhas ~160–175.

Estão todos na pasta `viabilidade/pre-fisica/` do galho. A central copiou os dois `.md` para esta pasta.

## O que fazer

1. **`sondagem.py`, só cadastro: nada de capacidade de carga, tensão admissível nem fundação.** É o PVF-G3, e o cálculo fica reservado ao PVF-G4 com engenheiro.
   - **Investigação geotécnica:**
     - id estável;
     - estudo/lote de referência;
     - empresa executora;
     - profissional responsável (nome, conselho e registro, todos obrigatórios);
     - método declarado (texto, por exemplo "NBR 6484:2020"; `verified: false` até alguém conferir);
     - data do ensaio, como texto informado. **Não use relógio.**
   - **Furo:** id, posição UTM, cota da boca (pode ser `null` com motivo), profundidade final e critério de paralisação (texto).
   - **SPT por metro:** guarde os **golpes e a penetração de cada um dos 3 segmentos de 15 cm, crus**. O N-SPT é derivado: soma dos 2 últimos segmentos. Nunca aceite N digitado sem os segmentos. Se a penetração não completar, guarde como veio e marque.
   - **Camada de solo:** topo, base e descrição do boletim, com classificação textual livre. As camadas de um furo ficam contíguas, sem sobrepor nem deixar buraco, até a profundidade final.
   - **Nível d'água:** profundidade ou "não encontrado", leitura inicial ou depois de N horas, sempre como texto informado.
   - **Selo:** SHA-256 próprio. Use o `gravar` atômico do `esquema.py` com `selador=`, como na avaliação.
2. **Conferências:** furo fora do lote é **aviso**, não erro (sondagem em vizinho existe). Profundidade de camada maior que a final, N sem segmento, profissional incompleto e segmento negativo são **erro**.
3. **Ligar na síntese.** Hoje a trava aceita `evidencias["sondagem"] is True`, um booleano que qualquer um declara. Troque por uma **referência**:
   - `evidencias["sondagem"] = {"investigation_id": ..., "sha256": ...}`;
   - a síntese recebe o cadastro e só tira o motivo "Falta sondagem" se o selo bater e o profissional estiver completo;
   - o `True` antigo vira motivo de trava: "sondagem declarada sem cadastro".
   - Suba `method_version` (`sintese/0.3.0`).
   - **Adversário:** com a sondagem cadastrada e válida, o domínio geotécnico **nunca** sai `conforme` nem `VERIFICADO`. Sem método de cálculo validado, ele continua `nao_verificado`, e a síntese continua no máximo CONDICIONAL.
4. **Exemplo fictício:** um boletim com 2 furos, em `exemplo-sondagem-ficticia.json`, com `"ficticio": true` e o aviso no próprio arquivo. Nada de dado real de empresa ou pessoa.

## Testes (só `assert`)

1. O exemplo fictício carrega, sela e relê com os mesmos bytes, e o N-SPT bate com a soma dos segmentos.
2. Camadas sobrepostas, camada com buraco, N sem segmentos, profissional sem registro e segmento negativo dão erro, cada um com motivo.
3. Furo fora do lote dá aviso e não erro.
4. Síntese:
   - `sondagem: True` trava, com o motivo novo;
   - uma referência com sha errado trava;
   - uma referência válida tira só o motivo da sondagem;
   - o geotécnico nunca vira `conforme`.
5. Continuam passando: os 12 da `test_sintese`, `test_projetista` (18) e `test_gerador` (8).

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede.
- Relato curto em `RELATORIO-PVF-G3.md`, nesta pasta.
- Ao terminar: `maestri ask "Claude Code" "Terreno PVF-G3 pronto"`.
