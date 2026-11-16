# PA-G0, parte técnica: matriz de reuso (Codex, 16/11)

Worktree `C:/Users/respawn/Desktop/imobiliaria-projetista`, galho `viabilidade/projetista-g0` (é a main `633ddaeb`). Leia antes `viabilidade/PRD-PROJETISTA-0.1.md`. O Produto escreve o `PA-G0.md` (casos de uso, esquema, ordem dos portões); **você faz a auditoria do código**, que é a parte que precisa ser exata.

## Fluxo que o usuário quer alcançar

Selecionar terreno → calcular viabilidade → pedir 6 apartamentos por pavimento → gerar distribuições → organizar torres → ver o empreendimento inteiro em 3D → modificar o projeto.

## Decisões do usuário (valem para a matriz)

1. **Não duplicar o motor 3D.** O projetista produz um modelo arquitetônico que é traduzido para o renderizador que já existe. Descobrir que contrato o renderizador aceita hoje.
2. **Geometria separada de legislação.** Geometria válida ≠ proposta legalmente conforme. Ver onde o código atual mistura as duas.
3. **Gerador automático sem IA generativa.** Geometria e otimização reproduzíveis (mesma entrada, mesma saída).

## O que auditar (4 áreas)

1. **Estudo de viabilidade atual:** `viabilidade/motor/` (o que gera: envelope, volume, opções; formato do `estudo.json`; onde entra a lei).
2. **Modelo geométrico do lote:** `viabilidade/terreno/` (`lote.json`: coordenadas, unidade, frente, recuos, zona).
3. **Criação de plantas:** tudo que já desenha ou lê planta no repo (ex.: extrator de planta, mobiliar pela planta, interiores do mapa 3D, unidade em lote, lançamento em blocos, plantas dos lançamentos LIV/Laranjeiras/Containers/Vistas). Ache pelo código, não por esta lista.
4. **Renderizador das maquetes:** o que monta o 3D dos lançamentos e do mapa (qual arquivo carrega o quê, em que formato: lista de volumes, GLB, JSON de cômodos…).

## Entrega: `viabilidade/projetista/MATRIZ-REUSO.md`

- Uma tabela por área com as colunas **o que existe** (`arquivo:função` ou `arquivo:linha`), **entrada → saída**, **reuso** (`usar como está` / `adaptar` / `não serve`) e **por quê**.
- Para cada passo do fluxo acima: o que já cobre, o que falta e o tamanho do que falta (P/M/G).
- **Contrato mínimo para o renderizador**: o menor formato que o modelo canônico teria que gerar para aparecer no 3D atual sem motor novo (campos e de onde cada um sai).
- Onde geometria e legislação estão misturadas hoje (arquivo:função).
- Toda referência conferida no código: se não achou, escreva "não achei", nunca invente nome, linha ou contagem.

## Regras

Só leitura. Escreva **apenas** `viabilidade/projetista/MATRIZ-REUSO.md`. Não rode build, deploy, Firebase, nem mexa em código, config, hook ou `.github/`. Não commite. Sem nome de cliente nem preço. Ao terminar: `maestri ask "Claude Code" "Visual tarefa matriz pronta"`.
