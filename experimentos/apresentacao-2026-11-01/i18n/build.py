"""Gera a página inglesa a partir do HTML português e de um catálogo único."""

import argparse
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
CATALOG = Path(__file__).with_name("en.json")
SOURCE = ROOT / "site" / "index.html"
RUNTIME = ROOT / "site" / "i18n.js"
TEXT_ATTRIBUTES = {"alt", "title", "placeholder", "aria-label", "aria-description", "aria-valuetext"}
META_TEXT = {"description", "og:title", "og:description", "og:image:alt", "twitter:title", "twitter:description", "twitter:image:alt"}


def load_catalog():
    def unique_keys(pairs):
        values = {}
        for key, value in pairs:
            if key in values:
                raise ValueError(f"Chave repetida no catálogo: {key}")
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"Tradução vazia ou inválida: {key}")
            if set(re.findall(r"\{(\w+)\}", key)) != set(re.findall(r"\{(\w+)\}", value)):
                raise ValueError(f"Parâmetros diferentes na tradução: {key}")
            values[key] = value
        return values
    return json.loads(CATALOG.read_text(encoding="utf-8"), object_pairs_hook=unique_keys)


class EnglishPage(HTMLParser):
    def __init__(self, catalog):
        super().__init__(convert_charrefs=True)
        self.catalog = catalog
        self.output = []
        self.raw = None
        self.missing = set()

    def text(self, value):
        key = re.sub(r"\s+", " ", value).strip()
        if not key:
            return value
        if key in self.catalog:
            translated = self.catalog[key]
        elif not any(char.isalpha() for char in key):
            return value
        else:
            self.missing.add(key)
            return value
        leading = value[:len(value) - len(value.lstrip())]
        trailing = value[len(value.rstrip()):]
        return leading + translated + trailing

    def start(self, tag, attrs, closed=False):
        values = dict(attrs)
        translated = []
        for key, value in attrs:
            if key == "aria-current" and "data-idioma" in values:
                continue
            if "data-contato-en" in values and key in {"data-whatsapp", "target", "rel"}:
                continue
            if "data-english-only" in values and key == "hidden":
                continue
            if tag == "html" and key == "lang":
                value = "en"
            elif "data-contato-en" in values and key == "href":
                value = "#contato"
            elif "data-contact-privacy-en" in values and key == "href":
                value = "assets/contact-privacy.html"
            elif tag == "link" and values.get("rel", "").lower() == "canonical" and key == "href":
                value = "https://conectaimoveis3d.com/"
            elif value is not None and key in TEXT_ATTRIBUTES:
                value = self.text(value)
            elif tag == "meta" and key == "content":
                identity = values.get("name", values.get("property", "")).lower()
                if identity in META_TEXT:
                    value = self.text(value)
                elif identity == "og:locale":
                    value = "en_US"
            translated.append(" " + key if value is None else f' {key}="{html.escape(value, quote=True)}"')
        if "data-portuguese-only" in values and "hidden" not in values:
            translated.append(" hidden")
        if values.get("data-idioma") == "en":
            translated.append(' aria-current="page"')
        self.output.append("<" + tag + "".join(translated) + (" />" if closed else ">"))
        if tag in {"script", "style"} and not closed:
            self.raw = tag

    def handle_starttag(self, tag, attrs):
        self.start(tag, attrs)

    def handle_startendtag(self, tag, attrs):
        self.start(tag, attrs, True)

    def handle_endtag(self, tag):
        self.output.append(f"</{tag}>")
        if self.raw == tag:
            self.raw = None

    def handle_data(self, data):
        self.output.append(data if self.raw else html.escape(self.text(data), quote=False))

    def handle_comment(self, data):
        self.output.append(f"<!--{data}-->")

    def handle_decl(self, decl):
        self.output.append(f"<!{decl}>")

    def handle_pi(self, data):
        self.output.append(f"<?{data}>")


def translate_html(source, catalog=None):
    parser = EnglishPage(catalog if catalog is not None else load_catalog())
    parser.feed(source)
    parser.close()
    if parser.missing:
        raise ValueError("Textos sem tradução:\n" + "\n".join(sorted(parser.missing)))
    return "".join(parser.output)


def runtime_source(catalog=None):
    entries = json.dumps(catalog if catalog is not None else load_catalog(), ensure_ascii=False, indent=2)
    entries = entries.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    return r"""// Gerado por i18n/build.py a partir de i18n/en.json. Edite o catálogo.
(() => {
  "use strict";
  const english = /^en(?:-|$)/i.test(document.documentElement.lang || "");
  const catalog = __CATALOG__;
  function t(text, params = {}) {
    const value = english && Object.prototype.hasOwnProperty.call(catalog, text) ? catalog[text] : text;
    return value.replace(/\{(\w+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match);
  }
  window.ConectaI18n = Object.freeze({ lang: english ? "en" : "pt-BR", isEnglish: english, t });
})();
""".replace("__CATALOG__", entries)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=ROOT / "site" / "index.en.html")
    parser.add_argument("--check", action="store_true", help="Valida traduções e runtime sem gravar arquivos.")
    parser.add_argument("--runtime-only", action="store_true", help="Atualiza somente site/i18n.js.")
    args = parser.parse_args()
    catalog = load_catalog()
    page = translate_html(args.source.read_text(encoding="utf-8"), catalog)
    runtime = runtime_source(catalog)
    if args.check:
        if not RUNTIME.exists() or RUNTIME.read_text(encoding="utf-8") != runtime:
            raise SystemExit("Runtime desatualizado: rode i18n/build.py --runtime-only.")
        print(f"HTML e runtime válidos; {len(catalog)} entradas no catálogo.")
        return
    if not args.runtime_only:
        if args.output.resolve() == args.source.resolve():
            raise SystemExit("O destino não pode sobrescrever o HTML português.")
        args.output.write_text(page, encoding="utf-8", newline="\n")
        print(f"Inglês gerado em {args.output}")
    RUNTIME.write_text(runtime, encoding="utf-8", newline="\n")
    print(f"Runtime gerado em {RUNTIME}")


if __name__ == "__main__":
    main()
