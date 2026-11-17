# Prévia 3D do pavimento gerado (Motor, 17/11)

**Onde:** na cópia `viabilidade/projetista/` da worktree `imobiliaria-viabilidade`. A central leva o resultado para o galho `projetista-g0`. Não commite.

O Terreno está mexendo na mesma pasta, em `sintese.py`, `test_sintese.py`, `gerador.py` e `test_gerador.py`: **não toque neles.** Crie só `para_vista.py` e `test_para_vista.py`. **Não mude `viabilidade/visual/index.html`**: a prévia tem que entrar pelo formato que ele já aceita.

## Ideia

O `visual/index.html` (`carregar` → `validar` → `criarVista`) já desenha os volumes de um estudo do motor (`?estudo=<arquivo>`). Então a prévia é só um **conversor**: revisão do projetista → JSON de estudo que esse visualizador aceita.

## O que fazer

`para_vista.py: revisao_para_estudo(revisao, estudo_json, pavimentos=None) -> estudo` e a linha de comando:

```
python -I -X utf8 viabilidade/projetista/para_vista.py <revisao.json> <estudo.json> --saida <arquivo>
```

1. **Base:** o estudo original do piloto, sem alterar o arquivo. Mantenha `lote`, `zona` e a caixa máxima. Troque `opcoes` por **uma** opção `projetista`.
2. **Volumes:** cada unidade, o corredor e o núcleo de cada pavimento, com `base_utm` de volta ao UTM pelo `site.local_frame`.
   - Use `uso` diferente para unidade, circulação e núcleo.
   - Respeite os limites do visualizador: até 200 volumes por opção, até 10 mil vértices por polígono, sem buracos e altura finita. Se passar de 200, junte por pavimento e diga isso no relato.
3. **Pavimentos:** empilhe o pavimento tipo de `height_m` em `height_m`.
   - O padrão é o maior número de andares em que **cada** andar ainda cabe no `envelope_by_height` da sua faixa de altura (confira com Shapely). Diga onde parou e por quê.
   - `pavimentos=N` força N. Se algum andar sair do envelope, recuse com erro claro; nunca desenhe por cima.
4. **Métricas da opção:** só o que o visualizador lê, com tipos válidos (inteiros onde ele exige). A área privativa vem da revisão, não é recalculada. Ponha um alerta dizendo que é prévia esquemática do projetista, preliminar e com a zona não conferida, quando for o caso.
5. **Determinístico:** a mesma entrada dá bytes iguais.

## Testes (`test_para_vista.py`, só `assert`)

1. Revisão gerada do piloto 22421 (gere com `gerador.gerar_pavimento` dentro do teste, ou com a linha de comando numa pasta temporária) → estudo com uma opção e volumes = (6 unidades + corredor + núcleo) × pavimentos. Todo `base_utm` cai dentro do `lote.poligono_utm` (tolerância 1 mm).
2. Volta de coordenada: UTM → local → UTM preserva os vértices com erro < 1 mm.
3. `pavimentos` acima do que o envelope permite → erro.
4. O estudo original não muda (bytes). A saída é idêntica entre execuções.
5. **Passa no `validar` do próprio `index.html`:** rode no navegador headless, ou extraia a função e rode no node, o que for mais simples e confiável. Se não der para rodar, diga isso; não finja.

## Prova visual

Abra o visualizador com a saída do piloto 22421 e tire um print. Salve em `viabilidade/projetista/previa-22421.png` (não commite: a central decide). Compare com o lote: os volumes têm que estar dentro dele, empilhados e sem nada flutuando.

## Regras

- Não toque em `motor/`, `terreno/`, `visual/`, `relatorio/`, painel, `.github/`, config nem hook. Nada de rede externa: um servidor local só para o print pode.
- Relato curto em `RELATORIO-6.md`, nesta pasta.
- Ao terminar: `maestri ask "Claude Code" "Motor tarefa 6 do projetista pronta"`.
