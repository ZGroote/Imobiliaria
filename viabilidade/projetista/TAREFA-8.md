# Térreo e vagas na prévia (Motor, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Terreno está mexendo em `sintese.py` e `test_sintese.py` na mesma pasta: **não toque neles.** Você mexe em `para_vista.py`, `test_para_vista.py` e, se precisar, em um módulo novo seu.

## Problema

A prévia (tarefa 6) só repete o pavimento tipo a partir de z = 0. Um prédio real tem térreo, com entrada e garagem, e os andares tipo começam acima dele.

## O que fazer

1. **Térreo opcional:** `revisao_para_estudo(..., terreo=True)` e `--terreo` na linha de comando. O padrão continua **sem** térreo, para não mudar a saída da tarefa 6.
   - No térreo (z0 = 0), o núcleo continua na mesma projeção dos andares de cima.
   - Ao lado do núcleo fica um hall de entrada (`uso: "hall"`). A largura e a área são premissa: escreva-as num `PADROES_TERREO`.
   - O resto da laje vira garagem (`uso: "garagem"`; o visualizador já pinta esse uso de lilás).
   - O pé-direito do térreo é premissa própria, padrão 3,0 m. Os andares tipo começam em cima dele.
2. **Vagas:** um número inteiro, `floor(área da garagem / área por vaga)`. A área por vaga, com circulação, é **premissa**, padrão 25 m². Isso não é um desenho de vagas.
   - Vai em `metricas.vagas`.
   - Um alerta diz: "vagas por área bruta (premissa de 25 m² por vaga com circulação), não desenhadas nem conferidas pela lei".
3. **Envelope:** o térreo também tem que caber no `envelope_by_height` da faixa dele. A contagem de andares tipo é refeita com o deslocamento. Diga quantos andares tipo cabem no 22421 com e sem térreo.
4. **Determinístico** e com os mesmos limites do visualizador. A prévia sem `terreo` sai byte a byte igual à da tarefa 6.

## Testes (só `assert`)

1. Com térreo, o 22421 tem núcleo no térreo na mesma projeção do núcleo dos andares, e hall + garagem + núcleo cobrem a laje do térreo sem sobrepor (tolerância de 1 mm²).
2. `vagas` é inteiro e bate com `floor(área da garagem / premissa)`.
3. Sem `terreo`, a saída fica idêntica à da tarefa 6, em bytes.
4. O `validar` do `index.html` aceita a saída com térreo (no node, como na tarefa 6).
5. Continuam passando: `test_projetista` (18) e `test_gerador` (8).

## Prova visual

Tire o print com térreo do 22421 e salve em `viabilidade/projetista/previa-22421-terreo.png`. A garagem tem que estar lilás embaixo, o núcleo alinhado e nada flutuando.

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede externa; um servidor local só para o print pode.
- Relato curto em `RELATORIO-8.md`, nesta pasta.
- Ao terminar: `maestri ask "Claude Code" "Motor tarefa 8 do projetista pronta"`.
