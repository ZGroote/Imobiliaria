# Execução autorizada — 16/10/2026

Servidor: `root@js2.blockelite.cn`, porta `24112`. Chave local cadastrada pelo usuário.
2× A100-SXM4 40 GB, 46 GiB de RAM, Rocky Linux 9.7, aproximadamente 190 GB livres no início.
Fim informado pelo usuário: **17/10/2026 04:46:54 Brasília**, equivalente a 07:46:54 UTC.

Raiz remota: `/root/liv-corrigido-20261016`.
Pacote SHA-256: `b87a49bf1ec2a96898417088f788333040d1749117dcd725cee90d50b1d8bb49`.
Fonte corrigida SHA-256: `fb1cdfb78b9d0635c78113a1899e9497558a46b739c9291b7b01756fa2db6b82`.
Pontos iniciais: `32ac7093d617be03d0676cd9d581e36e3bb1bf8bf4969735fec9c27bc0d2d1bd`.

O pacote e os 33 arquivos do manifesto foram conferidos antes da extração.
Blender 5.2.2 instalado e render iniciado às 22:08:39 UTC (19:08:39 Brasília).
As duas GPUs renderizam partes complementares do plano fixo de 2.590 vistas, reutilizando as 18 referências.
Resolução 1280×720, 128 amostras, oito rumos, piso/horizonte/teto, sem modificar o plano.
Torch 2.4.1+cu124, gsplat 1.4.0+pt24cu124 e Nerfstudio 1.1.5 instalados.

## Processos e retomada

- Pipeline: `executar-servidor.sh`, log `/root/liv-corrigido-pipeline.log`.
- Render: `render-0.log` e `render-1.log` na raiz remota.
- Backups: `preservar-servidor.py`, log `/root/liv-corrigido-backups.log`.
- Monitor local: `acompanhar-servidor.py`, sessão de execução local 96821;
  log `acompanhamento-servidor.log`, estado em `execucao-servidor/status-remoto.json`.
- O monitor baixa/extrai lotes de 100 PNGs, checkpoints intermediários e o resultado final.
  Cada lote é publicado com renomeação atômica depois de completo. Capturas já baixadas podem ser reaproveitadas.

O treino inicia só após render completo e validação de arquivos, divisões e fonte.
São 30 mil etapas, câmera fixa, cull-alpha 0,005, checkpoints a cada 5 mil etapas.
O cache de imagens usa uint8 em CPU, opção confirmada no help instalado; isso evita duplicar
as imagens em float32 e poupa RAM, mantendo os valores dos PNGs de 8 bits.
Depois ocorrem exportação PLY e avaliação das 377 vistas reservadas.

Na leitura de 22:37 UTC, o render estava em 347/2.590 e a média recente era 13 vistas/minuto.
Essa média projetava mais 172,5 minutos para as capturas. Rever a estimativa com o avanço.

Após obter PLY/avaliações: preservar arquivos localmente, converter para SOG, abrir uma prévia
separada e percorrer os seis ambientes. Verificar especialmente teto da suíte, portas, vidro e
regiões que eram pretas. Não declarar a qualidade aprovada só por conclusão do treino ou métricas médias.
