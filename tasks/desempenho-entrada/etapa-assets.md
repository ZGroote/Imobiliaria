# Entrada 3D: seleção de recursos e texturas compartilhadas

Escopo autorizado em 01/11/2026: reduzir a primeira abertura nos dois prédios e incorporar o preparo ao gerador. Base publicada: `65f0ba3ccdc9fced`, código `a8f0866`.

1. Selecionar apenas os móveis, acabamentos e decorações efetivamente usados. No Laranjeiras, as decorações do LIV já não são posicionadas; suas dependências também não devem ser carregadas.
2. Preparar GLBs sem repetir imagens. Conservar os bytes originais de geometria, imagens, materiais, nomes e posições. Agrupar imagens em arquivos verificáveis, sem criar dezenas de requisições individuais. Manter originais para compatibilidade.
3. Provar seleção, integridade, revisão autoral e descarte de memória. Gerar os dois pacotes pelo fluxo normal e comparar visual, edição, navegação, rede e primeira abertura.
4. Incorporar apenas tratamentos aprovados. Publicar preservando o inventário e configuração do Hosting e verificar as URLs públicas.

Trabalho isolado na branch `codex/entrada3d-assets-20261101`; não alterar a branch compartilhada nem arquivos pendentes de outras sessões. Evidências novas em `entrada-assets/`, separadas da etapa anterior. Medições de navegador desktop não representam homologação em celular físico.

Estado: implementação em andamento; ganhos e publicação ainda não comprovados.
