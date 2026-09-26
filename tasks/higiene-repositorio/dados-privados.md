# Dados privados no repositório — 26/09/2026

Os dados de **imóveis reais** que estão no repositório são **privados**: cadastro, planta,
modelos, luz assada e páginas montadas. Eles são entradas reais do produto e dos builds
publicados, e por isso **não saíram** neste ciclo.

- **Onde ficam:** no repositório, que agora é privado.
- **Até quando:** até a política de artefatos e fontes definir o armazenamento privado para eles.
- **Como vão para a internet:** só pelo fluxo de publicação por imóvel
  ([proposta, §6–§9](../painel/proposta.md)).

**A trava é `tests/test_dados_privados.py`,** que roda no CI. Nada disto entra no repositório sem
estar nas listas do teste:

- unidade real nova;
- modelo do Blender novo;
- página de maquete nova;
- luz assada de uma unidade desconhecida;
- imagem nova fora de uma pasta já classificada.

Pôr um item na lista é a classificação explícita. Tirar um item nunca reprova.

## As unidades reais

| Unidade | Cidade | Observação |
|---|---|---|
| `monte-dos-cedros-37` | São Carlos | piloto publicado em produção (proposta, §14) |
| `monte-das-colinas-39` | São Carlos | piloto (`tasks/v1.0/piloto.json`) |
| `wish-castanheiras-58` | São Carlos | piloto (`tasks/v1.0/piloto.json`) |
| `sanca-135-29` | São Carlos | — |
| `mirra-114` | Ribeirão Preto | o cadastro partiu de um anúncio do `roca.com.br`; o endereço foi informado pelo usuário (`unidade.json`, `_fonte_endereco`) |

Mais um prédio real: o "Edifício da planta · Apartamento 304", da planta enviada em 19/09/2026.
Ele está **dentro do código**, como a constante `IMOVEL` de `v1.5/miniaturas/pagina_maquete.py` e
nos demos `demo_v17.py` e `demo_v18.py`, e já está montado em `v1.5/miniaturas/maquete.html`.

## Onde esses dados estão

| O quê | Onde |
|---|---|
| Cadastro (planta, lote, cores) e mobília | `plantas_fornecidas/<unidade>/unidade.json` e `moveis.auto.json` |
| Luz assada no Unreal | `unreal/lightmaps/<unidade>.png` e `unreal/malhas/<unidade>.tiles.json` |
| Modelos do Blender (`.blend`, `.glb`, `modelo.json` e prévias) | `v1.5/miniaturas/{castanheiras,monte-das-colinas,monte-dos-cedros}_blender/` |
| Código com a forma de um prédio real | `v1.5/miniaturas/modelar_castanheiras.py`, `castanheiras.js` e `editor_cedros.js` |
| Bake do Cedros (template, geometria, lightmaps, `source.json` e texturas) | `v1.5/miniaturas/padrao-atual/` |
| Páginas de maquete montadas | `v1.5/miniaturas/maquete-monte-das-colinas-39.html`, `maquete-wish-castanheiras-58.html` e `maquete.html` |
| Lista do piloto | `tasks/v1.0/piloto.json` |

**Nas páginas geradas,** esses dados entram assim:

- no mapa, todas as unidades, pelo bloco `__unidades`;
- no tour, as unidades que caem no raio (`pipeline/recorte.py:344`);
- na maquete, a própria unidade.

## O que parece, mas não é dado privado de cliente

| O quê | Por quê |
|---|---|
| `plantas_fornecidas/_exemplo/` | gabarito sintético, sem imóvel por trás |
| `painel/exemplo/` | contrato de exemplo do painel: só o id do Cedros, sem dado da unidade |
| `sao-carlos/dados/imoveis.json` | a vitrine de demonstração, **fictícia** desde 26/09/2026. A trava é `tests/test_vitrine_ficticia.py` |
| `modelos_cadastrados/estudos.json` | vazio desde 26/09/2026. Os 6 estudos derivados das fotos da Roca saíram, junto com o `gerar_estudos.mjs` |
| `experimentos/mirante-7-2026-09-22/` | material de **terceiro**, não de cliente (seção seguinte) |

## Material de terceiro que continua no `HEAD`

As **imagens** do Mirante 7 saíram, e o `ESTUDO.md` registra o motivo. Continuam na pasta dados
que não são imagem, mas são de terceiro. Ficaram fora deste PR:

- **`iplano.json` e `dados-anuncio.json`:** o registro completo que a API da iPlano devolveu para
  o anúncio: descrição, preço, características e ids internos.
- **`anuncio.json`, `coleta.json` e `coleta-iplano.json`:** o que o extrator viu, e a URL de cada
  imagem.
- **`unidade.json` e `modelo/`:** a planta e o modelo, interpretados a partir das plantas do
  folheto.
- **`miniatura.html`:** a página montada.

## Como a lista muda

1. **Entrar uma unidade real nova:** acrescentar o id em `UNIDADES_REAIS` e a linha na tabela de
   cima, **no mesmo PR** que traz o dado.
2. **Imagem nova:** acrescentar em `IMAGENS`, com um comentário dizendo de onde veio. Se a imagem
   for de terceiro, a licença entra antes no [THIRD_PARTY.md](../../THIRD_PARTY.md).
3. **Migração para armazenamento privado,** que vem com a política de artefatos: o dado sai do
   repositório, e o item sai da lista no mesmo PR.
