# Continuidade da luz acima de portas e janelas

01/11/2026. Corrigidos e publicados o LIV (Canto/Meio) e Laranjeiras (Canto/Meio e respectivos espelhados).

O atlas bruto já apresentava um salto de luz entre faces coplanares na emenda acima da porta. No ponto de regressão, duas amostras separadas por 2 mm tinham diferença relativa de 65,70%. Retirar faces internas não resolveu o caso; aumentar a resolução reduziu parte do problema, mas não tratou a continuidade entre ilhas.

[suavizar_paredes.py](../../v1.5/miniaturas/liv-ipanema/interior/suavizar_paredes.py) agrupa as superfícies pelo plano e orientação reais, respeita componentes desconectados e filtra a luz em coordenadas da parede. Usa grade de 2,5 cm e raio de 12 cm; atua a partir de 2 m, com transição de 15 cm. As margens do atlas são avaliadas no mesmo plano, em vez de repetir o último texel da ilha. Isso evita que o bilinear revele a emenda. Detalhes pequenos da iluminação indireta nessa faixa ficam mais suaves; os brutos permanecem preservados.

O LIV também passou a usar a interpolação RGBM já existente no Laranjeiras: decodificar os quatro texels antes de interpolar, tanto em WebGL2 quanto em WebGPU. A alteração preserva três bindings temporais e não aloca novas texturas ao mudar a hora.

Foram reempacotados **146 atlas**, sem mudar geometria, UVs, sondas, piso ou texels fora da máscara da correção. Os seis manifestos receberam os novos tamanhos/hashes e `wallDenoise: surface-plane-v1`. O empacotador compartilhado incorpora o tratamento para futuras gravações; a adaptação do Laranjeiras continua compatível.

O [relatório dos atlas](evidencias/vergas/atlas.json) confere hashes, texels preservados e identidade das sondas/geometria. Na emenda de regressão, o salto caiu para **0,61%**. O [ensaio no navegador](evidencias/vergas/runtime.json) registra portas/janelas, dia/noite e viewport estreito nas seis plantas, em WebGL2 e WebGPU, com os hashes dos manifestos usados. Capturas PNG ficam locais e ignoradas no git. O ensaio é em Chrome desktop; não houve teste em aparelho físico.

Repetição dos testes:

```powershell
python -m unittest discover -s tests -p test_suavizar_paredes.py
node --test experimentos/liv-experimental-2026-10-14/testes/time-bindings.test.mjs experimentos/liv-experimental-2026-10-14/testes/horario-luz-gravada.test.mjs experimentos/liv-experimental-2026-10-14/testes/prepared.test.mjs experimentos/liv-experimental-2026-10-14/testes/horario-interior.test.mjs
python experimentos/liv-experimental-2026-10-14/qa_vergas.py
```

Para corrigir um pacote anterior, `python tools/corrigir_luz_paredes.py --site <pasta-do-site>` valida a identidade dos recursos e altera somente os texels da máscara. Uma segunda execução ignora plantas já corrigidas. As texturas `.rgbm.gz` são ignoradas no git; ao preparar uma entrega é necessário incluir os binários locais correspondentes aos novos manifestos.

## Publicação

Endereços: [LIV](https://conectaimoveis3d.com.br/maquetes/liv/) e [Laranjeiras](https://conectaimoveis3d.com.br/laranjeiras/).

Versão Firebase Hosting `e777c369933136ea`, anterior `461a1ae2c283dbfe`. A preparação usou as fontes efetivamente publicadas, aplicando somente a nova interpolação no interior do LIV e os seis conjuntos de atlas. As alterações pendentes do mapa, do painel e das outras conversas não entraram no pacote. Os manifestos foram normalizados em LF, sem mudar o conteúdo JSON testado.

O pacote atualiza 161 arquivos, preserva outros 1.219 e mantém a configuração do Hosting. Os chunks anteriores são conservados. [Registro da publicação](evidencias/vergas/publicacao.json) e [validação pública](evidencias/vergas/publico.json).

```powershell
node tools/publicar_correcao_paredes.mjs
node tools/publicar_correcao_paredes.mjs --publicar
python experimentos/liv-experimental-2026-10-14/qa_vergas.py --origin https://conectaimoveis3d.com.br --out publicacao/correcao-vergas-20261101/qa-publico
```

`--desfazer` restaura a versão anterior somente se nenhuma outra publicação tiver ocorrido. O script usa o inventário/configuração integrais da versão corrente, valida os parâmetros da iluminação e recusa publicar se outra sessão mudar o Hosting durante a preparação ou envio.
