# LIV — parede que muda de claridade ao girar a câmera

10/10/2026. Relato e duas capturas do link público, em Poco X6 5G, Android 13, Chrome 154.0.8037.127. O aparelho informado não foi acessado por este ensaio. A reprodução usa Chrome 154.0.8037.98 no Windows, GPU desktop, viewport 390×844 e toque emulado.

## Reprodução

O HTML preservado de 38.378.801 bytes corresponde ao público pelo SHA-256 `31ffb45398aed3ad49b289600823232e37f668086ebfea458b96ecd2e1b9d018`. O ensaio verifica novamente essa identidade antes de atribuir o resultado à publicação. As capturas fornecidas pelo usuário ficam locais; não integram o pacote ou o commit.

Na circulação do canto, a câmera permanece em `[-0.8, 1.62, 0.1]`, yaw 1,98 rad. Somente o pitch muda de 0,55 para 0,65 rad. O ponto da parede acima da porta é `[-1.4850000143051147, 2.4, 0.38]`. O raycast encontra a mesma face e os mesmos UVs; a leitura compara a média de uma região de 7×7 pixels em torno da projeção desse ponto. Isso evita confundir a mudança de enquadramento com a amostragem de outro trecho da parede.

| Controle na base r168 | Maior diferença entre canais RGB, escala 0–255 |
|---|---:|
| Composição original | ~60,2 |
| Reflexos especulares retirados | ~62,7 |
| Atlas RGBM isolado | <0,2 |
| Cor base isolada | <0,1 |
| UV1 isolado | 0 |
| Irradiância baked isolada | <0,2 |
| Difuso final do material isolado | ~62,7 |
| Lambert calculado diretamente com atlas e albedo | <0,2 |

O bake continua pronto e a geometria/posição não muda. A mudança grande persiste ao retirar os reflexos. O isolamento da parcela ambiente (`iblIrradiance`) também reproduz uma diferença entre os ângulos. Os resultados apontam para uma contribuição indevida na composição difusa/ambiente do caminho antigo; não demonstram qual operação do driver ou cache de shader a produz. O atlas e a cor base não apresentam esse salto.

Ter iluminação pré-calculada e `shadow.autoUpdate=false` não torna todo o material independente da câmera. A resposta PBR continua calculada por fragmento. Minha conclusão anterior, baseada apenas no bake e na atualização de sombras, não bastava para descartar a observação das capturas.

## Interior nativo

`LivRGBMNodeMaterial`, já usado no interior novo, atribui explicitamente o difuso ao atlas validado, zera a irradiância ambiente adicional e preserva o especular PBR. O mesmo teste passou em **WebGPU e WebGL2**, com bake ativo e câmera fixa. A maior diferença RGB foi cerca de **0,041** em cada backend, abaixo do limite de 2 usado pelo teste. O atlas, a unidade e a geometria de canto continuam com suas identidades originais; não foi necessário alterar a parede ou usar outro atlas.

Essa prova qualifica o caso visual reproduzido na prévia local. Não comprova desempenho nem funcionamento no Poco físico. A versão pública ainda utiliza o renderer anterior. O interior de meio tem sua própria geometria e iluminação dinâmica enquanto seu bake específico não for produzido; este teste trata do canto exibido na publicação antiga.

O [relatório de regressão](evidencias/luz-camera-relatada/runtime.json) registra as amostras, hashes, backend, ambiente e limites. As imagens e o diagnóstico detalhado de shaders ficam locais. Para repetir, com o servidor da raiz na porta 8790:

```powershell
python experimentos/liv-ipanema-webgpu-2026-10-09/diagnosticar_luz_camera.py --rapido --comparar-nativo --verificar-publico
```

Os shaders de diagnóstico existem apenas nos contextos de navegador criados pelo teste, encerrados após a execução. O script não edita a base preservada nem a publicação. Playwright e Pillow são necessários. Não executar em paralelo com outros QAs gráficos.

## Caminhada e custo

O [perfil da caminhada pública](evidencias/perfil-visita-publica/runtime.json), produzido separadamente, registra duas rodadas por variante com CPU normal e throttling 4×. GPU e rede de celular não são emuladas. O giro/caminhada observado ficou perto da cadência de 60 Hz nesta máquina; retirar sombras, diminuir DPR ou dispensar a conferência por frame não identificou a causa do travamento físico relatado.

Na CPU 4×, o cálculo síncrono de rotas consumiu aproximadamente 93–303 ms por chamada, inclusive nas buscas sem caminho. A conferência do bake teve p95 de cerca de 1 ms e o passo de caminhada, 0,2 ms. Isso identifica o cálculo de rotas como candidato para pausas ao solicitar destinos, sem provar que explique a caminhada contínua no aparelho. O defeito visual e o diagnóstico de desempenho precisam ser tratados separadamente.
