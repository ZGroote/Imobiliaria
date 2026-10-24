from html.parser import HTMLParser
from pathlib import Path
import tempfile
import unittest
from urllib.parse import urlsplit

from fachada.montar import PAGINAS, RAIZ, montar


class Pagina(HTMLParser):
    def __init__(self, texto):
        super().__init__()
        self.tags = []
        self.feed(texto)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class FachadaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporarios = (RAIZ / "public").resolve()
        cls.temporarios.mkdir(exist_ok=True)

    def test_site_completo_links_ancoras_e_acessibilidade_basica(self):
        with tempfile.TemporaryDirectory(dir=self.temporarios) as pasta:
            destino = montar(Path(pasta))
            paginas = {}
            for slug in PAGINAS:
                texto = (destino / f"{slug}.html").read_text(encoding="utf-8")
                self.assertNotIn("{{", texto)
                pagina = Pagina(texto)
                paginas[f"{slug}.html"] = pagina
                self.assertEqual(sum(tag == "h1" for tag, _ in pagina.tags), 1, slug)
                self.assertEqual(sum(tag == "main" for tag, _ in pagina.tags), 1, slug)
                self.assertIn(("html", {"lang": "pt-BR"}), pagina.tags)
                ids = [attrs["id"] for _, attrs in pagina.tags if "id" in attrs]
                self.assertEqual(len(ids), len(set(ids)), slug)
                for tag, attrs in pagina.tags:
                    if tag == "img":
                        self.assertIn("alt", attrs)
                        self.assertIn("width", attrs)
                        self.assertIn("height", attrs)
                    if tag in ("input", "textarea", "select"):
                        self.assertTrue(any(t == "label" and a.get("for") == attrs.get("id") for t, a in pagina.tags))
            for arquivo, pagina in paginas.items():
                for tag, attrs in pagina.tags:
                    if tag == "base":
                        self.assertEqual(arquivo, "404.html")
                        self.assertEqual(attrs["href"], "/")
                        continue
                    endereco = attrs.get("href", attrs.get("src"))
                    if not endereco:
                        continue
                    url = urlsplit(endereco)
                    if url.path in ("/painel", "/maquetes/liv/"):
                        continue
                    if url.scheme:
                        self.assertEqual(url.scheme, "https", endereco)
                        if attrs.get("target") == "_blank":
                            self.assertIn("noopener", attrs.get("rel", ""))
                        if url.netloc == "wa.me":
                            self.assertEqual(url.path, "/5516981288075")
                        continue
                    alvo = url.path or arquivo
                    self.assertTrue((destino / alvo).is_file(), f"{arquivo}: {endereco}")
                    if url.fragment:
                        self.assertTrue(any(a.get("id") == url.fragment for _, a in paginas[alvo].tags), endereco)

    def test_nome_da_marca_e_escapado_e_nao_vira_template(self):
        with tempfile.TemporaryDirectory(dir=self.temporarios) as pasta:
            montar(pasta, {"nome": '<script>{{numero}}</script> & "marca"', "whatsapp": "5516981288075"})
            texto = (Path(pasta) / "index.html").read_text(encoding="utf-8")
            self.assertIn("&lt;script&gt;{{numero}}&lt;/script&gt; &amp; &quot;marca&quot;", texto)
            self.assertNotIn("<script>{{numero}}", texto)

    def test_formulario_sem_javascript_nao_envia_dados_por_get(self):
        pagina = Pagina((RAIZ / "paginas" / "contato.html").read_text(encoding="utf-8"))
        self.assertTrue(any(tag == "fieldset" and "disabled" in attrs for tag, attrs in pagina.tags))
        self.assertTrue(any(tag == "noscript" for tag, _ in pagina.tags))

    def test_404_em_caminho_aninhado_resolve_recursos_na_raiz(self):
        with tempfile.TemporaryDirectory(dir=self.temporarios) as pasta:
            montar(pasta)
            pagina = Pagina((Path(pasta) / "404.html").read_text(encoding="utf-8"))
            self.assertIn(("base", {"href": "/"}), pagina.tags)

    def test_whatsapp_invalido_falha_antes_de_escrever(self):
        for numero in ("016981288075", "5516", "5516981288075?x=1", 5516981288075):
            with self.subTest(numero=numero), tempfile.TemporaryDirectory(dir=self.temporarios) as pasta:
                with self.assertRaises(ValueError):
                    montar(pasta, {"nome": "Teste", "whatsapp": numero})
                self.assertEqual(list(Path(pasta).iterdir()), [])

    def test_build_nao_pode_sobrescrever_fontes(self):
        for destino in (RAIZ, RAIZ.parent, RAIZ / "paginas", RAIZ / "assets" / "subpasta"):
            with self.subTest(destino=destino), self.assertRaises(ValueError):
                montar(destino)


if __name__ == "__main__":
    unittest.main()
