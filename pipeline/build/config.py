"""Configuracao de montagem sem leitura de cidade ou argumentos ao importar."""
from dataclasses import dataclass
from pathlib import Path
import os

RAIZ = Path(__file__).resolve().parents[2]
# A variante de quem nao pede outra (`--variante`/`MAPA_V`). Ate o #46 era o v15, que
# saiu de VARIANTES no #49 junto com a arvore `renderizador/`: o historico do git e a
# referencia. Hoje e a unica variante viva.
V_PADRAO = 'v16-moveis'
# O LAYOUT dos caminhos de saida que os JSON das cidades declaram
# (`html_saida: v15/<cidade>-v15-aberto.html`). E um fato dos JSON, nao de quem e o
# padrao: o `saida()` troca este componente pelo da variante. Ate o #46 os dois eram a
# mesma constante, e trocar o padrao teria parado de remapear as cinco cidades. Este
# `v15` NAO e variante: e so o layout historico dos caminhos (o v15 saiu no #49).
BASE_CAMINHO_SAIDA = 'v15'
# `v16` saiu: era um galho intermediario entre o v15 e o v16-moveis, e ficou de pe
# enquanto a matriz de capacidades era portada. Com a portagem fechada nao restou
# nada nele que os outros dois nao tenham -- medido linha a linha -- e a pasta foi
# removida. O v17 e o v18 sairam no #48, e o v15 no #49. Ver tests/test_build_config.py.
VARIANTES = ('v16-moveis',)


@dataclass(frozen=True)
class BuildConfig:
    slug: str
    versao: str
    destino: Path | None = None

    def __post_init__(self):
        if self.versao not in VARIANTES:
            raise ValueError('variante desconhecida: %s (tem: %s)' %
                             (self.versao, ', '.join(VARIANTES)))

    @property
    def fonte(self):
        # A fonte e da VARIANTE, nao de quem e o padrao. O que saiu da modularizacao foi
        # reunido em `v1.5/`, junto das miniaturas. O nome da variante nao muda: MAPA_V
        # continua sendo a chave de SAIDA (v16-moveis/...html).
        return RAIZ / 'v1.5' / ('renderizador-' + self.versao)

    def cidade(self):
        from padrao.cidade import carrega
        return carrega(self.slug)

    def cidade_para_qa(self):
        cid = self.cidade()
        cid._fontes = dict(cid._fontes)
        for chave in ('html_saida', 'html_comprimido'):
            cid._fontes[chave] = str(self.saida(chave, cid))
        return cid

    def saida(self, chave, cid=None):
        cid = cid if cid is not None else self.cidade()
        original = Path(cid.caminho(chave))
        # Trocar apenas componentes relativos, nunca o diretorio do usuario.
        relativo = original.relative_to(RAIZ)
        partes = [self.versao if p == BASE_CAMINHO_SAIDA else
                  p.replace('-' + BASE_CAMINHO_SAIDA, '-' + self.versao)
                  for p in relativo.parts]
        alvo = RAIZ.joinpath(*partes)
        return Path(self.destino) / alvo.name if self.destino is not None else alvo


def resolve(slug=None, versao=None, destino=None, environ=None):
    env = os.environ if environ is None else environ
    return BuildConfig(slug or env.get('CIDADE') or 'sao-carlos',
                       versao or env.get('MAPA_V') or V_PADRAO,
                       Path(destino).resolve() if destino is not None else None)
