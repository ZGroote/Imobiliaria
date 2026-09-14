"""Configuracao de montagem sem leitura de cidade ou argumentos ao importar."""
from dataclasses import dataclass
from pathlib import Path
import os

RAIZ = Path(__file__).resolve().parents[2]
V_PADRAO = 'v15'
VARIANTES = ('v15', 'v16', 'v16-moveis')


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
        return RAIZ / ('renderizador' if self.versao == V_PADRAO
                       else 'renderizador-' + self.versao)

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
        partes = [self.versao if p == V_PADRAO else
                  p.replace('-' + V_PADRAO, '-' + self.versao)
                  for p in relativo.parts]
        alvo = RAIZ.joinpath(*partes)
        return Path(self.destino) / alvo.name if self.destino is not None else alvo


def resolve(slug=None, versao=None, destino=None, environ=None):
    env = os.environ if environ is None else environ
    return BuildConfig(slug or env.get('CIDADE') or 'sao-carlos',
                       versao or env.get('MAPA_V') or V_PADRAO,
                       Path(destino).resolve() if destino is not None else None)


# Compatibilidade com os medidores antigos; apenas strings, sem I/O.
VERSAO = os.environ.get('MAPA_V') or V_PADRAO
