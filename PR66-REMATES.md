# PR #66 — mapa dos erros de remate

## Sequência e causas

| Evidência | Defeito | Causa | Correção e proteção |
|---|---|---|---|
| ac5cb7eb94e7 / 04b20b1 | Abertura vertical: era possível enxergar o teto através da ponta da parede | O remate alongava o prisma, mas `semPontas` removia sua face terminal mesmo onde ela estava exposta | eb09dcc restaurou a face. Teste de raios exige bloqueio nas alturas 0,15 / 1,30 / 2,55 m, nas duas pontas |
| 6d6888e8e14e / eb09dcc | Triângulos/manchas perto do teto | A face inteira restaurada sobrepunha a face longitudinal da verga/parede perpendicular. Duas superfícies coplanares competiam no depth buffer (z-fighting); não era uma textura nova | Recortar da ponta somente a interseção com o prisma vizinho. Manter a superfície exposta e não emitir a região coberta |

## Localização geométrica do encontro sala/corredor

No fixture do Cedros (transformação da planta usada por `test_house_mesh.mjs`):

- Parede sobrevivente: eixo x = -1,065 m, z inicial = -0,110 m; remate A = 0,055 m. Sua ponta desenhada fica em z = -0,165 m.
- Verga perpendicular: eixo z = -0,100 m, meia espessura = 0,065 m. Sua face também fica em z = -0,165 m.
- A verga começa em y = 2,10 m. Abaixo disso, a ponta precisa continuar opaca; acima disso, a parte coberta não pode ser desenhada duas vezes.
- São coordenadas do fixture, não valores hardcoded na implementação.

## Teste que faltava

O teste de eb09dcc provava que existia uma face, mas não que existia **apenas uma** na junção. O teste novo lança raios abaixo e acima da verga e exige exatamente uma interseção na face externa. Antes do recorte, falha com `2 !== 1` em y = 2,15 m; depois passa. Repete com rotações 0 / 0,37 / pi/2.

## Escopo

O recorte é restrito às pontas marcadas como remate, incluindo rodapé. Mantém dimensões, aberturas, eixos de colisão e coordenadas de textura/atlas. Não usa deslocamento artificial, polygonOffset, mudança de textura ou IDs de imóveis. Consumidores sem remate conservam o comportamento anterior.

A prova visual não deve ser declarada aprovada apenas pelos testes: conferir também o canto por ambos os lados, sobretudo entre a verga e o teto. PR permanece draft, sem merge/deploy.


## Terceiro caso encontrado pelo gate geral

O primeiro CI do teste que varre todos os remates encontrou uma sobreposição real no Cedros a y = 0,08 m: a face terminal da parede e a face terminal do próprio rodapé estavam no mesmo plano longitudinal.

O rodapé tem espessura `ESP + 0,032` e a parede `ESP`. Na ponta exposta, o fechamento do rodapé só precisa existir nas duas abas laterais de 0,016 m que ultrapassam a parede. A faixa central de largura `ESP` já é fechada pela ponta da parede.

A correção recorta essa faixa central da face terminal do rodapé. O teste geral permanece inalterado: coincidência de faces continua sendo falha, inclusive na faixa do rodapé.
