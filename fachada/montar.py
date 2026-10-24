"""Monta o site institucional estático, sem dependências ou acesso ao Firebase."""

import argparse
import html
import json
from pathlib import Path
import re
import shutil
from urllib.parse import quote

RAIZ = Path(__file__).resolve().parent
PAGINAS = {
    "index": ("Imóveis que fazem sentido, antes da visita", "Apresente imóveis com plantas, maquetes e experiências digitais. Conheça a proposta, os planos LEVE e PREMIUM e fale com a equipe."),
    "planos": ("Planos", "Conheça as propostas LEVE e PREMIUM para apresentar seus imóveis. Escopo, valores e prazos sob consulta."),
    "contato": ("Vamos conversar", "Converse pelo WhatsApp sobre apresentações de imóveis, planos LEVE e PREMIUM e solicitações de privacidade."),
    "termos": ("Termos de uso", "Rascunho dos termos de uso do site institucional. Conheça o escopo das informações, das ilustrações e dos serviços apresentados."),
    "privacidade": ("Política de privacidade", "Rascunho da política de privacidade: dados de contato, atendimento pelo WhatsApp e direitos dos titulares."),
    "cookies": ("Cookies e navegação", "Saiba como esta versão do site funciona sem cookies de publicidade, ferramentas de análise ou armazenamento dos dados do formulário."),
    "404": ("Página não encontrada", "Volte ao início ou fale com a equipe pelo WhatsApp."),
}


def montar(destino=None, configuracao=None):
    config = configuracao if configuracao is not None else json.loads((RAIZ / "config.json").read_text(encoding="utf-8"))
    nome = config.get("nome")
    numero = config.get("whatsapp", "")
    if not isinstance(nome, str) or not nome.strip():
        raise ValueError("Informe o nome do site.")
    if not isinstance(numero, str) or not re.fullmatch(r"55[1-9]{2}9[0-9]{8}", numero):
        raise ValueError("WhatsApp deve conter 55, DDD e celular de nove dígitos, somente números.")
    # A prévia de link (og:image/og:url) precisa de endereço absoluto: o crawler não conhece a página.
    dominio = config.get("dominio", "https://conectaimoveis3d.com.br")
    if not isinstance(dominio, str) or not re.fullmatch(r"https://[a-z0-9.-]+\.[a-z]{2,}", dominio):
        raise ValueError("Domínio deve ser https://nome.dominio, sem barra no fim.")
    destino = Path(destino) if destino is not None else RAIZ / "public"
    destino = destino.resolve()
    if destino == RAIZ or destino in RAIZ.parents or destino.is_relative_to(RAIZ / "paginas") or destino.is_relative_to(RAIZ / "assets"):
        raise ValueError("O destino não pode sobrescrever as fontes.")
    destino.mkdir(parents=True, exist_ok=True)
    shutil.copytree(RAIZ / "assets", destino / "assets", dirs_exist_ok=True)
    # Navegadores e apps pedem /favicon.ico na raiz, mesmo com o ícone em SVG declarado.
    shutil.copy2(RAIZ / "assets" / "favicon.ico", destino / "favicon.ico")
    layout = (RAIZ / "layout.html").read_text(encoding="utf-8")
    substituicoes = {
        "nome": html.escape(nome),
        "dominio": dominio,
        "numero": numero,
        "telefone": html.escape(config.get("whatsapp_exibicao", numero)),
        "whatsapp": f"https://wa.me/{numero}?text={quote('Olá! Gostaria de conhecer as apresentações de imóveis e os planos.')}",
    }
    for pagina, (titulo, descricao) in PAGINAS.items():
        conteudo = (RAIZ / "paginas" / f"{pagina}.html").read_text(encoding="utf-8")
        texto = layout.replace("{{conteudo}}", conteudo)
        valores = substituicoes | {"titulo": html.escape(titulo), "descricao": html.escape(descricao), "pagina": pagina, "base_404": '<base href="/">' if pagina == "404" else "",
                                   "url": f"{dominio}/" if pagina == "index" else f"{dominio}/{pagina}.html"}
        valores |= {f"ativo_{aba}": 'aria-current="page"' if pagina == aba else "" for aba in ("index", "planos", "contato")}
        # Uma única passagem impede que o nome da marca seja interpretado como template.
        texto = re.sub(r"\{\{(\w+)\}\}", lambda m: valores[m[1]], texto)
        (destino / f"{pagina}.html").write_text(texto, encoding="utf-8")
    # O preview contém documentos em revisão e ainda não deve entrar nos buscadores.
    (destino / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
    return destino


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destino", type=Path)
    args = parser.parse_args()
    print(f"Site montado em {montar(args.destino)}")
