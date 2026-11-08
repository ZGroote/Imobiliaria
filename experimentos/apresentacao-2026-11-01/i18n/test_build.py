"""Regressões do HTML traduzido e do contrato usado pelos estados da landing."""

from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import unittest

from build import ROOT, SOURCE, load_catalog, runtime_source, translate_html


class Elements(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.nodes = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.nodes.append((tag, dict(attrs)))


class TranslationTests(unittest.TestCase):
    def test_actual_page_preserves_viewer_assets_and_dom_contract(self):
        source = SOURCE.read_text(encoding="utf-8")
        english = translate_html(source)
        before, after = Elements(source).nodes, Elements(english).nodes
        self.assertEqual([tag for tag, _ in before], [tag for tag, _ in after])
        for (tag, original), (_, translated) in zip(before, after):
            for key, value in original.items():
                if key in {"id", "class", "src", "href", "aria-controls", "aria-labelledby"} or key.startswith("data-"):
                    if tag == "link" and original.get("rel") == "canonical" and key == "href":
                        self.assertEqual(translated[key], "https://conectaimoveis3d.com/")
                    elif "data-contato-en" in original and key == "href":
                        self.assertEqual(translated[key], "#contato")
                    elif "data-contato-en" in original and key == "data-whatsapp":
                        self.assertNotIn("data-whatsapp", translated)
                    elif "data-contact-privacy-en" in original and key == "href":
                        self.assertEqual(translated[key], "assets/contact-privacy.html")
                    else:
                        self.assertEqual(translated[key], value, f"{tag}[{key}]")
        self.assertIn('<html lang="en"', english)
        self.assertIn("Your property,", english)
        self.assertIn("a new perspective.", english)
        self.assertEqual(sum(tag == "iframe" for tag, _ in after), 1)
        languages = {attrs["data-idioma"]: attrs for _, attrs in after if "data-idioma" in attrs}
        self.assertEqual(languages["en"].get("aria-current"), "page")
        self.assertNotIn("aria-current", languages["pt-BR"])

    def test_contact_form_is_ready_in_both_languages_and_portuguese_keeps_whatsapp(self):
        source = SOURCE.read_text(encoding="utf-8")
        english = translate_html(source)
        pt, en = Elements(source).nodes, Elements(english).nodes
        before = next(attrs for _, attrs in pt if attrs.get("class") == "contato-card")
        after = next(attrs for _, attrs in en if attrs.get("class") == "contato-card")
        self.assertNotIn("hidden", before)
        self.assertNotIn("hidden", after)
        for nodes in [pt, en]:
            target = next(attrs for _, attrs in nodes if attrs.get("id") == "contato")
            self.assertNotIn("hidden", target, "Switching language preserves a visible contact anchor.")
        for attrs in [attrs for tag, attrs in pt if tag == "a" and "data-contato-en" in attrs]:
            self.assertIn("data-whatsapp", attrs)
            self.assertTrue(attrs["href"].startswith("https://wa.me/"))
        links = [attrs for tag, attrs in en if tag == "a" and "data-contato-en" in attrs]
        self.assertEqual(len(links), 2)
        for attrs in links:
            self.assertEqual(attrs["href"], "#contato")
            self.assertNotIn("data-whatsapp", attrs)
            self.assertNotIn("target", attrs)
            self.assertNotIn("rel", attrs)
        self.assertNotIn("https://wa.me/", english)
        self.assertNotIn("Fale com a equipe pelo WhatsApp", english)
        self.assertIn("using the contact form", english)
        self.assertTrue(all("hidden" in attrs for _, attrs in en if "data-portuguese-only" in attrs))
        required = [attrs["name"] for tag, attrs in en if tag in {"input", "textarea"} and "required" in attrs]
        self.assertEqual(required, ["name", "email", "message"])
        submit = next(attrs for tag, attrs in en if tag == "button" and attrs.get("type") == "submit")
        self.assertIn("disabled", submit, "The no-JS fallback must not submit URL-encoded personal data.")
        trap = next(attrs for tag, attrs in en if tag == "input" and attrs.get("name") == "website")
        self.assertEqual(trap["tabindex"], "-1")
        self.assertTrue(any(tag == "a" and attrs.get("href") == "mailto:contact@conectaimoveis3d.com" for tag, attrs in en))

    def test_form_privacy_notice_matches_the_actual_flow_without_replacing_portuguese_documents(self):
        source = SOURCE.read_text(encoding="utf-8")
        english = translate_html(source)
        pt, en = Elements(source).nodes, Elements(english).nodes
        pt_links = [attrs["href"] for tag, attrs in pt if tag == "a" and "data-contact-privacy-en" in attrs]
        en_links = [attrs["href"] for tag, attrs in en if tag == "a" and "data-contact-privacy-en" in attrs]
        self.assertEqual(sorted(pt_links), ["assets/aviso-contato.html", "https://conectaimoveis3d.com.br/privacidade.html"])
        self.assertEqual(en_links, ["assets/contact-privacy.html"] * 2)
        aviso = (ROOT / "site/assets/aviso-contato.html").read_text(encoding="utf-8")
        self.assertIn('<html lang="pt-BR"', aviso)
        for fact in ["Firebase", "Resend", "contact@conectaimoveis3d.com", "armazenamento do navegador", "marketing automático"]:
            self.assertIn(fact, aviso)
        self.assertEqual(sum(tag == "a" and attrs.get("href") == "assets/contact-privacy.html" for tag, attrs in en), 2)
        self.assertIn("Read how this form uses your information.", english)
        notice = (ROOT / "site/assets/contact-privacy.html").read_text(encoding="utf-8")
        nodes = Elements(notice).nodes
        self.assertIn("<html lang=\"en\"", notice)
        for fact in ["name, email address and message", "company name is optional", "Firebase", "Resend",
                     "contact mailbox", "technical metadata", "browser storage", "automated marketing"]:
            self.assertIn(fact, notice)
        self.assertFalse(any(tag == "script" for tag, _ in nodes))
        self.assertTrue(any(tag == "link" and attrs.get("rel") == "stylesheet" and attrs["href"].startswith("../styles.css") for tag, attrs in nodes))
        self.assertTrue(any(tag == "a" and attrs.get("href") == "https://conectaimoveis3d.com/#contato" for tag, attrs in nodes))

    def test_parser_translates_text_and_accessible_metadata_only(self):
        source = '''<!doctype html><html lang="pt-BR"><head>
<meta name="description" content="Texto &amp; mais"><meta property="og:locale" content="pt_BR">
<link rel="canonical" href="https://conectaimoveis3d.com.br/">
<link rel="alternate" hreflang="pt-BR" href="https://conectaimoveis3d.com.br/">
<script>const label = "Texto & mais"; if (1 < 2) console.log(label);</script>
</head><body><button data-modo="Texto &amp; mais" aria-label="Texto &amp; mais"> Texto &amp; mais </button>
<img alt="Texto &amp; mais" src="imagem.jpg?a=1&amp;b=2"></body></html>'''
        result = translate_html(source, {"Texto & mais": "Text & more"})
        elements = Elements(result).nodes
        self.assertIn('aria-label="Text &amp; more"', result)
        self.assertIn('alt="Text &amp; more"', result)
        self.assertIn('> Text &amp; more </button>', result)
        self.assertIn('const label = "Texto & mais"; if (1 < 2)', result)
        self.assertIn(("meta", {"property": "og:locale", "content": "en_US"}), elements)
        self.assertIn(("link", {"rel": "alternate", "hreflang": "pt-BR", "href": "https://conectaimoveis3d.com.br/"}), elements)
        self.assertEqual(next(attrs for tag, attrs in elements if tag == "button")["data-modo"], "Texto & mais")
        self.assertEqual(next(attrs for tag, attrs in elements if tag == "img")["src"], "imagem.jpg?a=1&b=2")

    def test_untranslated_copy_fails_instead_of_publishing_mixed_language(self):
        with self.assertRaisesRegex(ValueError, "Frase nova"):
            translate_html('<p>Frase nova</p>', {})

    def test_runtime_english_and_portuguese_with_safe_parameter_fallback(self):
        source = runtime_source()
        # Exercise the exact browser file without a DOM dependency.
        script = '''const vm = require('node:vm');
const source = __SOURCE__;
const results = ['en', 'pt-BR'].map(lang => {
  const context = {document:{documentElement:{lang}}, window:{}};
  vm.runInNewContext(source, context);
  const api = context.window.ConectaI18n;
  return {lang:api.lang, english:api.isEnglish,
    title:api.t('Seu imóvel, em uma nova perspectiva.'),
    step:api.t('Etapa {atual} de 4',{atual:2}),
    unknown:api.t('Mensagem nova: {nome}',{nome:'<Ana & João>'}),
    missing:api.t('Etapa {atual} de 4'),
    inherited:api.t('{toString}')};
});
process.stdout.write(JSON.stringify(results));'''.replace("__SOURCE__", json.dumps(source))
        completed = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=True)
        english, portuguese = json.loads(completed.stdout)
        self.assertEqual(english["title"], "Your property, a new perspective.")
        self.assertEqual(english["step"], "Step 2 of 4")
        self.assertTrue(english["english"])
        self.assertEqual(portuguese["step"], "Etapa 2 de 4")
        self.assertFalse(portuguese["english"])
        self.assertEqual(english["unknown"], "Mensagem nova: <Ana & João>")
        self.assertEqual(english["missing"], "Step {atual} of 4")
        self.assertEqual(english["inherited"], "{toString}")


if __name__ == "__main__":
    unittest.main()
