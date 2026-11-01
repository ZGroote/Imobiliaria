# Entrada 3D — etapa rápida em implementação

Usuário rejeitou 42 s como suficiente e pediu aproveitar melhor os celulares.
Implementação/publicação de LIV, Laranjeiras e gerador continua autorizada.
Não confundir CPU limitada/viewport mobile com homologação em aparelho físico.

Base publicada: c9d002294057220d; fontes e87b6d7. Trabalho isolado em
`codex/entrada3d-rapida-20261101`, `_to_delete/worktree-desempenho`.
Checkout principal tem pendências de outras sessões; preservar e não mudar branch.
`quem_mexeu.py` executado. Sem agentes auxiliares. Ruflo indisponível.

Evidências: pasta durável `entrada-rapida/`, ao lado dos relatórios anteriores.

Resultados exploratórios:
- perfil.json: TSL atual 41,59 s CPU4; lote de 8 ms 26,93 s; ainda insuficiente.
- pai.json INVALID_TREATMENT_NOT_APPLIED: o HTML carregava bundle, ignorando a
  alteração de viewer.js. A suposta vitória de visibilidade foi retirada e o usuário
  avisado. Não usar esses tempos como prova. Nenhuma mudança de visibilidade mantida.
- GLSL dentro do TSL: 28,82 s, insuficiente; protótipo removido das fontes.
- Renderer WebGL direto, sem construção TSL por material, preservando PBR, RGBM,
  sondas, HDR linear, mistura/transparência e LUT aprovada: classico.json PASS
  14,38 s CPU4, compilação 2,38 s. Imagem próxima, não idêntica em todos os pixels.
- Geometria binária preparada no gerador: classico-preparado.json PASS 12,07 s.
- Geometria + rotas iniciais + HDR preparados: classico-preparado3.json PASS
  10,16 s CPU4. refreshRooms caiu de 2111,5 ms para 2,5 ms. Falta A/B repetido dos
  pacotes finais, e não apenas estes overlays de diagnóstico.

Correções implementadas localmente:
- Bindings independentes por canal de luz, mesmo com textura inicial compartilhada.
  Testes RED/GREEN reais. Laranjeiras conserva interpolação de texels já decodificados.
- WebGL clássico para interiores auto/webgl; WebGPU explícito e caminho diagnóstico
  TSL conservados. Fallback entre backends usa contexto novo uma vez.
- Fontes de geometria comuns e formato validado por SHA/revisão/bounds, sem cópia de
  arrays preparados; originais mantidos para leitores antigos.
- Rotas iniciais preparadas pela navegação específica de cada prédio, com chave
  de layout/folhas/colisão/versão; invalidação recalcula depois de mudança de porta.
- HDR convertido pelo mesmo HDRLoader no gerador, preservando bits half-float.
- Dois empacotadores normais chamam pipeline/preparar_interiores.mjs. Manifesto de
  transferências prefere arquivos preparados, evitando baixar os originais redundantes.
- Publicador inclui catálogos, binários novos e fontes; preserva Hosting compartilhado.

Pacotes novos gerados pelo fluxo normal em `entrada-rapida/pacotes/`:
LIV 455 arquivos, Laranjeiras 403. Testes unitários existentes 59 PASS;
4 testes novos de codec/revisão/HDR/rotas PASS; 2 Python do manifesto PASS.

QA integrado em andamento: primeira rodada encontrou falha na alternância
Tour à noite -> planta. Reproduzindo com captura de diagnóstico; resolver antes
publicação. Falta oráculo de bits real das seis plantas, revisão visual completa,
WebGPU/semGPU/context loss/câmera/edição/colisão, A/B final e integração/commit/deploy.
Nada desta etapa foi publicado ou commitado ainda.

Fontes oficiais: Three r186 Renderer/NodeBuilder/WebGLRenderer, MDN WebGL best
practices e Arm Mobile GPU Guide. Sem alterar dependências ou reduzir DPR/modelos.


Checkpoint seguinte (01/11): `pacotes3/` regenerados pelos dois preparadores normais.
QA integrado PASS: seis plantas × seis vistas (dia/noite/amanhecer/Tour/planta),
edição/restauração, contextos por unidade, WebGPU real em ambos. 138 testes Node
PASS; dois Python PASS. Oráculo real PASS: 1471 atributos de geometria, PNGs,
rotas nas seis plantas e 8 ambientes HDR com os mesmos bits.

A validação encontrou e corrigiu o limite de 16 samplers no WebGL noturno:
canais de atlas numa textura array, canais de sondas agrupados em X numa textura
3D (sem aumentar a profundidade). Texturas inativas não geram downloads.
Em seguida, candidato atual passou a guardar somente camadas distintas do atlas;
teste de uma -> duas -> uma camada, descarte e mistura PASS. Precisa regenerar e
validar esse último ajuste (fonte posterior a pacotes3), depois medir de novo.

A/B de pacotes3 em andamento: LIV CPU4 [49,16;36,85;35,98] s antes e
[11,89;11,75;10,54] depois; CPU1 6,50 -> 2,68 s. Laranjeiras primeiras rodadas
38,60/28,60 -> 9,15/8,28 s. Não usar resultados incompletos como teste concluído.
Diferença visual do LIV inicial: alfa igual; erro RGB médio no objeto 0,436/255,
1,95% dos pixels do objeto com diferença >8 em algum canal, sobretudo bordas.
Não declarar imagem pixel-idêntica entre backends.

HTML público do LIV interior contém preloads antigos. Download preservado em
`interior-publico-antes.html`; comparação confirmou que só os preloads diferem da
base. Publicador inclui o HTML com os nomes atuais e aceita exatamente essa
variação pré-existente, sem tolerar outras mudanças no HTML. Mantém chunks antigos.
Ainda sem commit/publicação desta etapa. Falta candidato final, estabilidade,
interação, comparação final, revisão, integração preservando pendências e deploy.
