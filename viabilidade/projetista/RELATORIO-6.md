# Relatório da tarefa 6 do Projetista: prévia 3D do pavimento gerado

Data: 17/11. Nada foi commitado. Não toquei em `sintese.py`, `gerador.py`, seus testes, `visual/`, `motor/` nem em nenhum outro arquivo fora da lista da tarefa.

## O que foi feito

- `para_vista.py`: `revisao_para_estudo(revisao, estudo_json, pavimentos=None) -> estudo` e a linha de comando
  `python -I -X utf8 viabilidade/projetista/para_vista.py <revisao.json> <estudo.json> --saida <arquivo> [--pavimentos N]`.
- `test_para_vista.py`: 6 funções de teste, só com `assert`. Todas passam.
- `previa-22421.png`: print do `visual/index.html` com a saída do piloto 22421 (não commitar).

O `index.html` não foi mudado. A prévia entra pelo formato de estudo do motor que ele já aceita (`?estudo=<arquivo>`).

## Como funciona

1. Parte do estudo original do piloto (o arquivo não é alterado). Mantém `lote`, `zona`, `premissas`, `caixa_maxima`, `dominio`. Troca `opcoes` por **uma** opção `projetista`. Tira `opcoes_ausentes` (eram das opções do motor). Troca o `criterio_escolha.texto` e põe uma frase nas `incertezas` dizendo que as opções do motor foram trocadas.
2. Um volume por unidade, por espaço comum (corredor/hall) e por peça do núcleo, em cada andar. `uso` = `unidade`, `circulacao` ou `nucleo`. O `base_utm` volta ao UTM pela inversa **exata** do `site.local_frame`.
3. Andares: empilha o pavimento tipo de `height_m` em `height_m`. Para cada andar confere (Shapely) que a laje, engordada pela meia espessura externa, cabe na interseção das faixas do `envelope_by_height` que o andar atravessa, e que o topo não passa da caixa. Sem `pavimentos`, para no primeiro andar que não cabe e diz onde e por quê. Com `pavimentos=N`, se qualquer andar sair, dá `ValueError` claro (nunca desenha por cima).
4. Métricas: `unidades_estimadas`, `area_privativa_m2` (da revisão × andares, sem recalcular), `pavimentos` (inteiros), `vagas`, `area_nao_computavel_m2` e `vgv_estimado` como `null`. Alertas: prévia esquemática e preliminar; onde parou; zona não conferida (quando o lote ou a zona não estão conferidos); regras não verificadas da revisão; limitações.
5. Determinístico: JSON com a ordem de chaves herdada, UTF-8, LF. Mesma entrada, mesmos bytes.

## Piloto 22421

- 6 unidades por andar + corredor + núcleo, **2 pavimentos**, 24 volumes, 12 unidades, área privativa 661,29 m².
- **Parou no 2º andar**: o 3º (z 6 a 9 m) sai do envelope dessa altura em 15,55 m². O limite de 13,5 m da caixa não foi o motivo; foi o envelope encolhido nessa faixa de altura.
- Print: dois andares empilhados, dentro do lote e da caixa máxima, nada flutuando.
- Mais de 200 volumes: **não aconteceu** no piloto (24). O caminho de juntar por andar (circulação e núcleo viram um volume cada) existe e está coberto por teste com envelope sintético alto; se mesmo assim passar de 200, dá erro.

## Testes

- Volumes = (6 unidades + corredor + núcleo) × andares; todo `base_utm` dentro do lote com 1 mm de folga; `uso` distintos; `z0` empilhado.
- Volta de coordenada UTM → local → UTM com erro < 1 mm.
- `pavimentos` acima do envelope, 0, negativo, fracionário e estudo trocado dão erro.
- Passa de 200: junta por andar e avisa; 40 andares dá erro.
- Estudo original intacto (bytes e dict) e saída idêntica entre execuções.
- **`validar` do próprio `index.html` rodou de verdade no node**: o teste extrai o texto do `index.html` (de `const finito` até antes de `async function carregar`), roda no node e confere que a saída passa e que um volume com `altura_m` nula é recusado (prova de que o teste enxerga defeito).

Suítes conferidas juntas: `test_projetista.py` (18), `test_gerador.py` e `test_para_vista.py`, todas passam.

## Achado no caminho

O `local_frame` da revisão tem `u` e `v` arredondados a 4 casas, então não são ortonormais exatos (e formam um espelho). Voltar ao UTM pela transposta errava ~1,5 mm; por isso uso a inversa exata da matriz. O teste de volta de coordenada pegou isso.

## Limitações

- Só repete o pavimento tipo: sem térreo, garagem, vagas, recuos por volume nem relevo. Os alertas dizem isso.
- Aceita revisão com um só pavimento tipo.
- Com estudo passado como `dict`, a conferência de "mesmo estudo" compara só o id (o `dict` não guarda os bytes do arquivo); com `Path` ou bytes, compara o SHA-256.
- Print feito no Chrome headless com SwiftShader; precisa da aba visível (o 3D só desenha com a aba na tela).

## Sobra no git

`viabilidade/projetista/` aparece como não rastreada neste galho. Arquivos novos desta tarefa: `para_vista.py`, `test_para_vista.py`, `RELATORIO-6.md`, `previa-22421.png`. Nada commitado. Os `viabilidade/visual/evidencias/*.png` modificados e os arquivos do Terreno (`sintese.py`, `gerador.py` e testes) não são meus.
