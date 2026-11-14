# Entrada 3D e estabilidade — implementação autorizada

Usuário autorizou implementar a auditoria aprofundada, com foco nas entradas acima de 80 s em vários aparelhos/navegadores. Pixel 9 abriu em cerca de 4 s segundo o usuário. Não tratar simulação como homologação física.

Base: `f6393df`. Branch isolada `codex/entrada3d-20261031`, worktree `_to_delete/worktree-desempenho`; principal `feat/predio-novo` contém alterações de outras sessões. Aviso enviado antes de modificar arquivos sobrepostos. Não trocar a branch compartilhada. Commits com `Co-Authored-By: Codex <noreply@openai.com>`.

Auditoria e dados: `C:/Users/respawn/.codex/visualizations/2026/10/31/01a193a3-c81d-79f2-8f50-40b6061cd0c2/auditoria-profunda-2/relatorio.md` e JSONs ao lado.

1. [x] Entrada: verificar o agendamento da construção dos shaders, repetição de grafos e trabalho bloqueante. A dependência local usa `scheduler.yield()` quando disponível e **requestAnimationFrame** em outros navegadores, nove esperas por builder: medir substituto cooperativo por tarefas, sem bloquear render/UI e sem esperar repaint de iframe estacionado. Não desligar pré-compilação como solução já provada: A/B anterior foi inconsistente.
2. [x] Navegação: eliminar testes contínuos repetidos nas amostras do segmento, conservar segurança de portas/móveis/contorno. Ampliar oráculo e testar casos de fronteira.
3. [x] Recursos: biblioteca de móveis só com dependências da tipologia, autoria temporária liberada, luz só com canais de peso positivo e samplers válidos; preservar edição/fallback.
4. [x] Estabilidade: falha inicial WebGPU troca para iframe/contexto novo WebGL uma vez; erro sem GPU compreensível; seleção/2D e links conhecidos independentes de renderização 3D.
5. [x] Retenção e desenho: limite de interiores preparados com snapshot/câmera preservados, cancelamento real de preparação obsoleta; desenho sob demanda com eventos/portas/movimento corretos.
6. [x] Gerador: fontes e empacotadores, saída nova normal. Preservar os ajustes já publicados de renderer/picking ao incorporar novos imports.
7. [x] Comparação: entrada do clique ao primeiro quadro com CPU limitada e scheduler ausente/presente, WebGL/WebGPU, imagens, unidades/lados/espelhadas, navegação, edição, relógio, perda de contexto, falta total de GPU, versões frio/quente.
8. [x] Revisar, commitar, reconciliar checkout principal, construir pacotes e publicar ambos com versão anterior/inventário/configuração preservados; verificar URLs/hashes e fluxos públicos.

Não aplicar DPR menor ou simplificação de aparência sem ganho e QA visual. Shader de sondas 18→9 não melhorou a entrada no ensaio anterior; só manter se benefício medido justificar. O acompanhamento anterior foi excluído; não voltar a esperar Claude.


Checkpoint de implementação (01/11 UTC): 125 testes Node e o teste Python do
manifesto passaram. Oráculo: 144 mil segmentos em seis plantas (com/sem móveis e
folhas de portas) e rotas iguais; cálculo das rotas caiu de 537–845 ms para
327–553 ms no ensaio local. Primeiros pacotes: seis plantas × quatro vistas e
WebGPU real nos dois sites passaram. Após revisão, o LIV também recebeu o progresso
de compilação que já estava pendente no checkout principal. Pacotes regenerados
pelo fluxo normal em `release-entrada-v3/`, ao lado das evidências duráveis.

`implementacao-entrada/estabilidade.json` PASS: falta total de GPU → seleção 2D
validada nos dois sites, links 2D sem construir renderer, falha inicial de WebGPU
→ WebGL em iframe novo nos dois sites (exterior e interior). Seis trocas de plantas
sob limite de dois contextos: cache de até dois interiores e dimensões editadas
restauradas após descarte. Corrigida na validação real uma importação ausente do
rótulo de pavimento no seletor de recuperação. Validação de interação/desenho parado,
comparação de entrada e repetição integral dos pacotes finais ainda em andamento.
Nenhuma mudança desta segunda rodada foi publicada neste checkpoint.


Concluído: publicação `c9d002294057220d` (01/11 às 01:48:34 UTC), anterior
`4c56bcec8bc6c6db`. 38 alterações, 35 uploads, 1.209 arquivos externos e toda a
configuração preservados. QA público PASS: oito casos de plantas/backends e nove
casos de falhas/recuperação/cache, além dos mesmos ensaios locais. A última
conferência encontrou a mesma versão, 1.621 arquivos e zero diferenças dos pacotes.
128 testes Node + teste Python passaram no checkout integrado; fonte no commit
`63d1955`. As quatro capturas A/B RGBA são idênticas. Relatório de resultados e
limitações em `resultado.md`; evidências completas em `implementacao-entrada/` e
`deploy-entrada/`, na pasta durável já indicada. Nenhuma homologação física foi
realizada: com CPU 4× os casos ainda levaram 35–42 s. Não generalizar os ganhos dos
ensaios para todos os dispositivos. Alterações de outras sessões preservadas;
nenhum acompanhamento automático ativo desta tarefa.
