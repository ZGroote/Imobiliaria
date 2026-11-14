# Entrada 3D — implementação e publicação concluídas

Entregue em 01/11/2026. LIV e Parque das Laranjeiras publicados na versão
`65f0ba3ccdc9fced`, com as mesmas mudanças nas fontes e nos preparadores normais
dos pacotes. Commits de implementação: `380200b`, `ec18075`, `6bb7bcb`, `e0e04a8`.
A branch compartilhada não foi trocada. As 16 pendências rastreadas de outras
sessões foram preservadas byte a byte. Acompanhamento automático já inexistente,
confirmado pela ferramenta de automações; nenhuma mensagem enviada ao Claude.

## Resultado medido nas URLs públicas

Três aberturas por site, contextos novos de Chrome desktop, CPU nativa, worker
paralelo ativo confirmado e sem injeções experimentais:

| Site | Repetições | Mediana | Primeira abertura após publicar |
| --- | --- | --- | --- |
| LIV | 4,86 / 3,02 / 3,48 s | 3,48 s | 16,09 s |
| Laranjeiras | 3,11 / 2,70 / 3,14 s | 3,11 s | 14,95 s |

Esses tempos variam com rede e caches de CDN/driver. Contexto novo não limpa esses
caches. Não são homologação em celulares físicos nem garantia de 3 s para qualquer
aparelho/conexão. O Pixel 9 em 4 s e as entradas acima de 80 s foram relatos do
usuário, não medições reproduzidas em aparelho por esta sessão.

A etapa local anterior mediu CPU4 em ~9,93/8,25 s, contra medianas anteriores
36,85/28,60 s. Esses números não incluíam toda a rede pública. A abertura pública
ainda demorava 34,45/32,22 s com a fila serial. Um ensaio com o worker bloqueado
caiu para 8,69/7,27 s e confirmou a espera adicional da fila. A fila limitada foi
então implementada, testada e publicada; não foi desligado o cache do produto.

Experimentos de HTTP versionado/cache padrão e registro antecipado do worker
não demonstraram ganho adicional consistente e não foram incorporados. O antigo
ensaio `pai.json` está invalidado: a alteração de viewer não executara porque o
HTML ainda carregava bundle. Nenhuma conclusão depende desse ensaio.

## Implementação

- WebGLRenderer direto nos interiores auto/WebGL, evitando construir grafos TSL
  por material no momento da entrada. WebGPU explícito continua funcionando.
- PBR, RGBM, sondas por cômodo, transparência em HDR e LUT aprovada preservados.
  Canais de luz usam menos samplers, cabendo no limite de 16 testado. O atlas só
  reserva camadas distintas. Bindings WebGPU mantêm identidade por canal.
- Alvo HDR verifica os formatos suportados e escolhe MSAA disponível; ausência de
  HDR aciona recuperação. No hardware ensaiado, a imagem ficou idêntica antes e
  depois dessa seleção de formatos. Não houve redução de DPR ou de modelos.
- `pipeline/preparar_interiores.mjs` prepara geometria/UV1/PNGs/rotas e HDR no
  gerador. Leitor binário usa vistas tipadas sem nova conversão de todos os vértices,
  valida fonte/UV/SHA/tipos/bounds. Rotas específicas de cada prédio são reutilizadas
  só com chave de colisão compatível e são invalidadas ao mudar uma porta.
- HDR convertido pelo mesmo HDRLoader para os mesmos bits half-float. Originais
  permanecem disponíveis; a fila evita baixar fonte/UV redundantes. Cena preparada
  usa URL com SHA para não receber uma revisão antiga do cache HTTP.
- Worker com até quatro urgentes e orçamento de 16 MiB de buffers de transferência;
  um arquivo maior roda sozinho. Fundo fica em um download. Tamanho/SHA continuam
  verificados antes da entrega; requisições iguais compartilham trabalho e cancelar
  um consumidor preserva outro. Nenhum renderer é criado pelo worker.

Os dois comandos normais geraram saídas novas em `entrada-rapida/fila/`, 455
arquivos LIV e 403 Laranjeiras. A prévia LEVE/PREMIUM usa outra família de templates,
sem o gargalo TSL, e mantém o padrão próprio descrito em `pipeline/MAQUETES.md`.

## Validação

- 145 testes Node e dois Python do manifesto aprovados.
- Oráculo real de seis plantas: 1471 atributos, UVs/índices/grupos/esferas, PNGs e
  oito ambientes HDR conservam os dados anteriores; rotas iguais e segmentos seguros.
- Seis plantas × seis vistas/horários, edição/restauração e WebGPU real nos dois
  sites aprovados localmente e nas URLs públicas da versão final.
- Corte reversível, hora/lado reversíveis, OrbitControls, caminhada, toque, portas,
  desenho parado sem novas submissões, perda de contexto e recuperação aprovados.
- Falta de GPU -> seleção/2D; limites de dois contextos -> troca entre quatro tipos
  com dimensões editadas restauradas. Um teste de link 2D falhou uma vez antes de
  capturar diagnóstico; repetição integral e oito contextos novos passaram.
- Worker real: pico de quatro transferências, oito arquivos em ~0,72 s na fixture,
  sem downloads duplicados, corrupção rejeitada/retry e outra aba preservada após
  abortar um consumidor. Orçamento, arquivo grande e pré-requisito também testados.
- Comparação inicial entre renderers não é pixel-idêntica: erro RGB médio no objeto
  ~0,44/255 LIV e ~0,41/255 Laranjeiras, alfa igual; diferenças em bordas/sombras.

## Publicação e integridade

`deploy-fila/` registra a versão anterior `77cfc77ad88b6603`, inventário, configuração,
publicação e hashes HTTP. A versão final tem 1684 arquivos, 21 mudanças nesta última
etapa, 1241 arquivos fora do pacote preservados e configuração integral conservada.
As etapas anteriores estão em `deploy-final/` e `deploy-cache/`. Chunks antigos
foram conservados para páginas já abertas. URLs verificadas: `/`, `/maquetes/liv/`,
`/laranjeiras/`, `/checkup/liv.html`. Laranjeiras continua com noindex.

O procedimento existente de reversão verifica a versão atual antes de restaurar
a anterior. Não usar o firebase.json da raiz para essas maquetes.

Evidências completas ficam em:
`C:/Users/respawn/.codex/visualizations/2026/10/31/01a193a3-c81d-79f2-8f50-40b6061cd0c2/entrada-rapida/`.
Arquivos principais: `resultado-publico.json`, `entrada-publica-repeticoes.json`,
`qa-publico/report.json`, `qa-fila-compartilhada/report.json`, `estabilidade.json`,
`capacidades.json`, `oraculo-binarios.json`, `testes-fila.log`, `deploy-fila/`.

Fontes técnicas consultadas: Three.js r186 no ambiente e fontes oficiais;
[Arm Mobile GPUs](https://arm-software.github.io/magog/docs/03_mobile_gpus/),
[MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
e [MDN Request.cache](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache).
