# Reflexos preparados antes da abertura — 11/10/2026

O exterior agora importa o mapa de reflexos já filtrado. O gradiente de céu original, os materiais PBR padrão, RGBM, geometria e UVs permanecem iguais. O aparelho deixa de gerar o PMREM desse gradiente a cada criação da cena. Canto e Meio conservam seus próprios recursos e iluminação; na revisão aqui medida, a fila secundária tinha 140 arquivos. A integração posterior da entrada usa os mesmos reflexos; resultados atuais em [INTEGRACAO-ENTRADA.md](INTEGRACAO-ENTRADA.md).

`preparar_ambiente.py` gera o recurso com Three.js 0.186.1 e WebGPU nativo. Remove o alinhamento de 256 bytes da leitura GPU e reorganiza as faces depois da filtragem para a convenção de CubeUV externo. Inverter o gradiente antes do filtro produzia diferenças de até 4/255; apenas inverter linhas ou omitir o alinhamento produzia erros visíveis. O arquivo qualificado é RGBA float16 little-endian, 336×64: **172.032 bytes brutos / 37.854 bytes gzip**. O manifesto identifica gradiente, recurso, runtime e receitas por SHA-256.

`ambiente.js` valida edição, tamanho e hashes antes de criar uma DataTexture CubeUV padrão, linear, sem mipmaps adicionais. Ambos os backends usam o mesmo arquivo. `ambiente=procedural` preserva o caminho de comparação. Se manifesto/recurso estiver indisponível, corrompido ou de outro gradiente/runtime, a cena usa o gradiente original e registra `__livProva.environmentFallbackError`. O recurso é inicial; não acrescenta cenas ocultas ou itens à fila de Tour/Mapa/Planta 2D.

O renderer passou a possuir os recursos antes das esperas de ambiente/texturas. Trocar de modo durante essas fases cancela a requisição e libera atlas/ambiente já criados. Um ImageBitmap concluído após o descarte é fechado sem entrar na cena. Esse cuidado se aplica às duas edições.

## Evidência

Os relatórios de ambiente e medição desta seção qualificam a revisão `612819e`. A adição posterior do estudo isolado da entrada e seu enquadramento conserva o caminho das duas edições integradas: regressões atuais em [unidades-entrada-estudo/runtime.json](evidencias/unidades-entrada-estudo/runtime.json) e [sombras-entrada-estudo/runtime.json](evidencias/sombras-entrada-estudo/runtime.json). O estudo usa os mesmos reflexos preparados; sua geometria/luz e medição separadas estão em [entrada/README.md](modelo/entrada/README.md).

[ambiente-precalculado-final/runtime.json](evidencias/ambiente-precalculado-final/runtime.json) compara aberturas independentes: original/contorno em WebGPU, WebGL2 e toque emulado. Cinco vistas e um final selecionado por caso, mesma resolução/câmera, diferença máxima **1/255**. Confere seis recuperações (HTTP, hash e gradiente incompatível nos dois backends), quatro cancelamentos durante ambiente/texturas e descarte único. As rotas de teste são resolvidas após a navegação cancelar o fetch.

[sombras-ambiente-final/runtime.json](evidencias/sombras-ambiente-final/runtime.json) mantém a comparação de sombras reutilizadas/automáticas nas duas edições. [unidades-ambiente-final/runtime.json](evidencias/unidades-ambiente-final/runtime.json) cobre piloto, seleção/sessão, ambos os interiores em Planta 2D/3D/Tour, falhas de catálogo e retorno do mapa.

[medicao-ambiente-final/medicao.json](evidencias/medicao-ambiente-final/medicao.json): três rodadas por tratamento, frio/reload, Chrome novo por rodada, execução sequencial, canvas igualado a 720×390, DPR 1, viewport 1440×900, Chrome 154/Windows/GTX 1650. A fila é pausada depois da primeira cena utilizável. HTTP local sem compressão adicional; arquivos `.gz` já comprimidos. Caches do driver e outras aplicações não são controlados. Não mede FPS/tempo GPU ou telefone físico.

| Tratamento | Conteúdo inicial | Mediana fria | Mediana reload |
|---|---:|---:|---:|
| Base pública preservada | 38.378.801 bytes | 2.152 ms | 1.269 ms |
| Contorno procedural / WebGL2 | 19.972.646 bytes | 4.975 ms | 3.680 ms |
| Contorno pré-calculado / WebGL2 | 20.011.590 bytes | 4.042 ms | 1.324 ms |
| Contorno procedural / WebGPU | 19.972.646 bytes | 2.460 ms | 2.175 ms |
| Contorno pré-calculado / WebGPU | 20.011.590 bytes | 2.393 ms | 2.186 ms |

WebGL2 melhora **18,8% frio / 64,0% na recarga**. WebGPU varia **−2,7% / +0,5%**: ganho pequeno frio e sem ganho na recarga; não afirmar aceleração generalizada. A melhoria foi mantida pela redução do trabalho de preparação e pelos resultados WebGL2 com equivalência visual. O conteúdo inicial ainda é **47,9% menor** que o da base.

O critério provisório continua pendente: contorno WebGPU está **11,2% acima** da base desta rodada (limite +10%), e WebGL2, 87,8%. A variante continua opcional. Falta medir hospedagem, canvas normal da interface e aparelhos físicos; não inferir aprovação do Poco X6/iPhone. [SOMBRAS-EXTERIOR.md](SOMBRAS-EXTERIOR.md) registra a revisão anterior com ambiente procedural.

## Reproduzir

Com servidor da raiz em `127.0.0.1:8790`, a partir deste experimento, executar os ensaios gráficos sequencialmente:

```powershell
python preparar_ambiente.py
python qa_ambiente.py --saida evidencias/ambiente-outra-revisao
python qa_sombras_exterior.py --saida evidencias/sombras-ambiente-outra-revisao
python qa_unidades.py --geometria contorno --saida evidencias/unidades-ambiente-outra-revisao
python medir_runtime.py --geometria contorno --ambiente ambas --igualar-canvas --rodadas 3 --saida evidencias/medicao-ambiente-outra-revisao
```

A geração exige Chrome com WebGPU nativo. Biblioteca, gradiente ou layout PMREM alterados exigem nova geração e qualificação. O manifesto não valida a autoria arquitetônica. Não houve publicação.
