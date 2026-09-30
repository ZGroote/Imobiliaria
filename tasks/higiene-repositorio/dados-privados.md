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
| `mirra-114` | Ribeirão Preto | **não publicar até confirmar a origem.** Ver a seção seguinte |

### `mirra-114`: não publicar até confirmar a origem

- **O que falta confirmar:** o cadastro partiu de um anúncio do `roca.com.br`, e o endereço foi
  informado pelo usuário (`unidade.json`, `_fonte_endereco`). A origem e a autorização dos dados
  usados na modelagem não foram confirmadas.
- **Um problema a mais:** o próprio cadastro anota que a planta e a ficha descrevem **unidades
  diferentes** (`unidade.json`, `_conflito`).
- **Os dados ficam:** não apagamos o trabalho, mas também não fingimos que a proveniência está
  resolvida.
- **A trava está no build e na montagem de publicação:** `pipeline/build_imovel.py` recusa a
  `mirra-114` antes de gerar, com o motivo (`NAO_PUBLICAR`). `pipeline/publicar_imovel.py`
  consulta a mesma lista ao conferir cada build, inclusive artefatos antigos, rollback e builds
  preservados ao promover outro imóvel. A recusa mantém o site anterior intacto.
  Os testes são `NaoPublicarTests` em `tests/test_build_imovel.py` e
  `tests/test_publicacao_live.py`; a fábrica também recusa com `ORIGIN_UNCONFIRMED`.
- **Para liberar:** registrar a origem confirmada e tirar a unidade de `NAO_PUBLICAR`, no mesmo PR.
- **O que a trava não cobre:** o mapa de Ribeirão Preto, montado por `pipeline/montar.py`, ainda
  listaria a unidade. Ribeirão está fora do escopo, e esse mapa não é montado nem publicado.

Mais um prédio real: o "Edifício da planta · Apartamento 304", da planta enviada em 19/09/2026.
Ele está **dentro do código**, como a constante `IMOVEL` de `v1.5/miniaturas/pagina_maquete.py`, e
já está montado em `v1.5/miniaturas/maquete.html`. Os demos `demo_v17.py` e `demo_v18.py` também o
traziam; saíram do `HEAD` no #48 e continuam no histórico do git.

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
| `experimentos/mirante-7-2026-09-22/` | era material de **terceiro**, não de cliente. Saiu do `HEAD` em 26–27/09 (seção seguinte) |

## Material de terceiro do Mirante 7: retirado do `HEAD`

A regra: sai o que é de terceiro ou derivado dele; fica o que é nosso e não carrega conteúdo de
terceiro. As 15 imagens saíram em 26/09. Estes 20 arquivos saíram em 27/09, somando 4,05 MB:

| Arquivo | Classe | Quem lia |
|---|---|---|
| `iplano.json` | de terceiro: o registro que a plataforma devolveu para o anúncio da iPlano (descrição, preço, características, ids internos) | ninguém; escrito por `coletar_complemento.py` |
| `dados-anuncio.json` | de terceiro: o mesmo registro, para o anúncio da Maria Aires | ninguém; escrito por `coletar.py` |
| `anuncio.json` | de terceiro: título, descrição e fotos, como o extrator viu | ninguém |
| `coleta.json`, `coleta-iplano.json` | de terceiro: URL e texto alternativo de cada imagem | ninguém |
| `coletar.py`, `coletar_complemento.py` | nosso, mas a única função deles é baixar conteúdo de terceiro de novo | ninguém |
| `processo.json` | registro do extrator, mas guardava a URL do anúncio e apontava o `anuncio.json` | ninguém |
| `hipoteses.json` | derivado: os contornos em pixel da planta do folheto e a calibração | `gerar_miniatura.py` (saiu junto) |
| `unidade.json` | derivado: a planta interpretada, com a ficha do anúncio | `gerar_miniatura.py` (saiu junto) |
| `layout-automatico.json`, `ajustes-layout.json` | derivado: a mobília sobre a planta interpretada | `gerar_miniatura.py` (saiu junto) |
| `gerar_miniatura.py` | derivado: os contornos e a ficha do anúncio estão escritos no código | ninguém |
| `modelar.py` | derivado: a volumetria das torres, estimada a partir das imagens | ninguém |
| `modelo/` (`.blend`, `.glb`, `modelo.json`, `preview.png`, `validacao.json`) | derivado: o modelo do prédio e o render dele | ninguém; escrito por `modelar.py` |
| `miniatura.html` | derivado: a página montada, com a planta, o modelo e a ficha | ninguém |

**Prova de uso.** Fora da própria pasta, nenhum código, teste, configuração ou CI lê um caminho de
`experimentos/mirante-7-2026-09-22/`. As únicas referências eram documentos e a linha do
`preview.png` na lista de imagens de `tests/test_dados_privados.py`, que saiu junto.

**Ficam:**

- o `ESTUDO.md`, reduzido ao método em nível alto, tempos, verificações, limitações e o registro
  das duas retiradas. Saíram dele as URLs das fontes, preço, área e tipologia, a comparação entre
  anúncios, as dimensões e hipóteses tiradas das imagens e os detalhes da interpretação da planta e
  do modelo;
- três registros nossos de medição: `resultado-teste.json`, `tempo-blender.json` e
  `tempo-montagem.json`.

Reinventariado em 30/09 no [M0-B](../checkpoints/m0b-2026-09-30.md): nenhum novo
material a retirar. `tests/test_dados_privados.py` impede que arquivos fora desses
quatro remanescentes voltem à pasta experimental versionada.

## Como a lista muda

1. **Entrar uma unidade real nova:** acrescentar o id em `UNIDADES_REAIS` e a linha na tabela de
   cima, **no mesmo PR** que traz o dado.
2. **Imagem nova:** acrescentar em `IMAGENS`, com um comentário dizendo de onde veio. Se a imagem
   for de terceiro, a licença entra antes no [THIRD_PARTY.md](../../THIRD_PARTY.md).
3. **Migração para armazenamento privado,** que vem com a política de artefatos: o dado sai do
   repositório, e o item sai da lista no mesmo PR.
