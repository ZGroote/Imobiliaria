# Runtime V2 — plano pós-mapa: preload da experiência

Estado: **PLANEJADO / BLOQUEADO ATÉ O MAPA V2 SER APROVADO**

Este documento registra a próxima etapa de produto depois do aceite visual e de
performance do Runtime V2. Não autoriza antecipar estas mudanças para dentro do
trabalho de fechamento do mapa.

## Gate de entrada

Só iniciar este trilho depois que o Runtime V2 tiver:

- proporção/variedade das casas aprovada visualmente;
- chão/gramado V2 aprovado;
- smoke móvel verde;
- benchmark V1 x V2 registrado;
- fluxo server-first sem dependência de payload urbano offline;
- V1/original preservado como fallback/referência.

## Objetivo

Usar o tempo em que a pessoa entra e observa a miniatura/ficha do imóvel para esconder
latência de rede e aproximar a percepção de carregamento da Visita 3D.

O sistema continua **online/server-first**. Cache/prewarm é apenas de sessão e nunca
substitui a necessidade de conexão com o servidor.

## Fluxo aprovado para experimentar

1. Usuário abre um imóvel/miniatura.
2. Mostrar uma transição de carregamento de **1 segundo**.
3. Nesse 1 s, disparar em paralelo:
   - shell/dados mínimos da experiência;
   - mapa V2 crítico ao redor do imóvel;
   - versão LEVE da Visita 3D (fallback imediato);
   - início da versão PREMIUM.
4. Após 1 s, liberar a tela inicial/miniatura mesmo que o carregamento total não tenha
   terminado.
5. Enquanto a pessoa permanece na miniatura/ficha:
   - continuar o PREMIUM em background;
   - continuar os chunks warm do mapa;
   - pré-carregar POIs/entorno apenas depois do núcleo crítico.
6. Ao tocar em **Mapa**:
   - montar primeiro o núcleo já aquecido;
   - completar o entorno em background.
7. Ao tocar em **Visita 3D**:
   - usar PREMIUM se já estiver pronto;
   - caso contrário abrir em LEVE imediatamente;
   - promover para PREMIUM quando terminar, sem reiniciar a experiência.

## Prioridade de rede

Primeira janela:

1. mapa crítico / dados mínimos do imóvel;
2. shell + LEVE da visita;
3. PREMIUM;
4. mapa warm / POIs / entorno secundário.

Depois que o mapa crítico estiver pronto:

1. PREMIUM;
2. mapa warm;
3. dados secundários.

A prioridade pode ser rebaixada em conexão lenta, mas o servidor continua obrigatório.

## Reuso obrigatório

Nenhuma resposta deve ser baixada ou parseada duas vezes na mesma sessão.

O prewarm e o carregamento real devem compartilhar:

- index/context do Runtime V2;
- urban-kit;
- chunks;
- payload LEVE;
- payload PREMIUM;
- metadados do imóvel.

## Métricas de aceite

O benchmark principal deste trilho não é mais apenas "cold page -> mapa completo".
Medir pelo caminho real do produto:

- 1 s de transição inicial;
- 3 s de permanência simulada na miniatura;
- toque em Mapa -> primeiro frame útil;
- toque em Visita 3D -> primeira interação;
- tempo de promoção LEVE -> PREMIUM;
- bytes duplicados = 0 dentro da sessão;
- requests críticos antes do first useful frame;
- heap e frame time durante a promoção.

Meta inicial para experimento, não contrato final:

- Mapa: primeira imagem convincente em **< 1–2 s após o toque**, quando houve prewarm;
- Visita 3D: entrada imediata pelo LEVE se PREMIUM ainda não estiver pronto;
- PREMIUM: promoção sem tela vazia, reload ou perda de câmera/interação.

## Regras de segurança do rollout

- Não remover o LEVE: ele continua formato suportado e fallback de baixa latência.
- Não alterar o V1/original durante o experimento.
- Não bloquear a UI esperando o PREMIUM.
- Não permitir que o PREMIUM monopolize a banda antes do mapa crítico.
- Não chamar cache de sessão de "modo offline".
- PR -> CI -> smoke isolado -> A/B -> autorização antes de promover.

## Ordem após o mapa

1. Implementar shared session fetch/cache.
2. Implementar transição de 1 s.
3. Prewarm do mapa a partir da miniatura.
4. Prewarm LEVE + PREMIUM da Visita 3D.
5. Fallback LEVE e promoção transparente para PREMIUM.
6. Benchmark do caminho real.
7. Teste móvel.
8. Só então decidir promoção do fluxo.
