# Mapa 3D de São Carlos, versão melhorada (v2, a partir de 07/10/2026)

Esta pasta guarda o mapa otimizado e as **casas procedurais por regra**. O plano completo, as medições de partida e as decisões estão em [PLANO.md](PLANO.md); a especificação das casas, em [casas/ESPEC.md](casas/ESPEC.md).

**Nada fora desta pasta foi alterado.**
- O renderizador de hoje continua em `../renderizador-v16-moveis/` e é a base de comparação. Os 49 testes de equivalência do repositório dependem dele.
- A montagem oficial (`pipeline/montar.py`) é chamada só para LER as peças, com a escrita no repositório bloqueada.

## O que já mudou

| | Hoje | v2 |
|---|---|---|
| Página | 1 HTML de 14 MB (dados em base64 dentro dele) | HTML de 45 KB que já mostra a tela de carga; o resto em arquivos com hash, guardados pelo navegador por um ano |
| Dados | todos aberto no boot, um depois do outro | baixados em paralelo, com progresso real; móveis e luz do apartamento só para quem entra nele |
| Desenho | a cena inteira em todo quadro da tela, parada ou não | sob demanda: parado, nenhum quadro; montando, o progresso aparece a cada 150 ms |
| Montagem dos quarteirões | 1 quarteirão por quadro desenhado | orçamento por tempo, maior quando ninguém mexe no mapa (cidade completa ~2–3× mais rápido no ambiente de medição) |
| Rótulos de rua | lista inteira refeita a cada quarteirão | entram por quarteirão |
| Sombra | refeita a cada metro andado | a cada 5% da área do mapa de sombra |
| Celular | 1 pixel por ponto numa tela de DPR 3 (borrado) | até 1,5, com o governador descendo a 0,75 se precisar |
| Casas | 74 modelos Blender repetidos (7.585 cópias da mesma casa) e volumes com telhado de 72–98% | casas por lote com regras de arquitetura e engenharia, em 3 níveis de detalhe (em integração) |

Com as mesmas casas de hoje (`--sem-casas`), a v2 desenha a cidade **igual pixel a pixel**: PSNR máximo nas vistas de centro, bairro e rua (`medicoes/compara.mjs` + `medicoes/psnr.py`).

## Estrutura

| Pasta | O que tem |
|---|---|
| `fonte/` | Cópia do renderizador com as mudanças da v2. As notas `v2` no código explicam cada uma. Novos: `entrega/carregador.js`, `scene/sob-demanda.js`, `world/casas-mundo.js`, `casas/geometria.js`. |
| `casas/` | Casas por regra: `sorteio.js` (determinístico), `regras.js` (lote → plano), `formato.js` (plano binário de 40 B por casa e o detalhamento). |
| `regras/sao-carlos.json` | Todos os números das regras. Os que vêm de prática estão marcados `a_conferir`, para conferência com o Plano Diretor e o Código de Obras. |
| `gerador/` | `casas.mjs` (cidade inteira → `derivados/casas/`), `pecas.py` (lê a montagem oficial), `montar.mjs` (monta `publicado/`). |
| `medicoes/` | `medir_mapa.mjs` (o medidor da linha de base), `compara.mjs` + `psnr.py` (comparação visual) e `vitrine.mjs` (casas de amostra). |
| `testes/` | `npm test`. |

## Comandos

Os comandos rodam dentro desta pasta e precisam de Node 20+ e Python 3.11+:

```powershell
npm ci
node gerador/casas.mjs                  # casas da cidade inteira (~30 s) -> derivados/casas/
node gerador/montar.mjs                 # publicado/ (com as casas; --sem-casas para o desenho antigo)
npm test
node medicoes/compara.mjs --base <piloto>   # mesmas câmeras, página de hoje × v2
node medicoes/medir_mapa.mjs --pasta publicado --paginas cidade --perfis desktop,celular-fraco
```

Para ver no navegador, rode `node ../miniaturas/versao-melhorada-07-10/medicoes/servidor.mjs publicado 8790` e abra `http://127.0.0.1:8790/`.

Os parâmetros úteis na URL:
- `?q=alto|medio|baixo`;
- `?casas=antigas` (volumes de antes);
- `?em=lat,lon&r=&p=&t=` (posição da câmera).

## Publicar (somente com autorização)

O `firebase.json` desta pasta publica `publicado/` com o HTML revalidando e todo arquivo com hash marcado como imutável. Use um **canal de pré-visualização**, que não altera o site no ar:

```powershell
node gerador/montar.mjs
npx firebase-tools@15 hosting:channel:deploy mapa-v2 --config firebase.json --project imobilaria-deccb --expires 7d
```
