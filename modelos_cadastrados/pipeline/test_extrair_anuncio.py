"""Testes determinísticos: python -m unittest discover -s modelos_cadastrados/pipeline -p test_extrair_anuncio.py"""
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from extrair_anuncio import ExtractionError, _fetch, _parse_page, _photo_url, _public_address, _roca_originals, _validate_url, extrair


ROCA = "https://roca.com.br/imovel/locacao/casas/sao-carlos/madre-cabrini/57881"
FIRST = "https://cdn.example.com/imovel/fotos/57881/front.jpg"
SECOND = "https://cdn.example.com/imovel/fotos/57881/side.jpg"


def roca_fixture():
    data = {"props": {"initialProps": {"pageProps": {"template": {"data": {
        "property": {"idtProperty": 57881, "desTitleSite": "Casa em São Carlos", "prop_char_1": 100,
                     "jsonPhotos": json.dumps([{"urlPhoto": FIRST}, {"urlPhoto": SECOND},
                                               {"urlPhoto": "https://cdn.example.com/imovel/fotos/57881/private.jpg", "flgNotShowSite": 1},
                                               {"urlPhoto": "https://cdn.example.com/imovel/fotos/999/unrelated.jpg"}])},
        "similars": [{"idtProperty": 123, "jsonPhotos": json.dumps([{"urlPhoto": "https://cdn.example.com/imovel/fotos/123/other.jpg"}])}]
    }}}}}}
    return '<script id="__NEXT_DATA__" type="application/json">' + json.dumps(data) + '</script>'


def photo():
    out = io.BytesIO()
    Image.new("RGB", (700, 500), (34, 100, 80)).save(out, "JPEG")
    return out.getvalue()


def response(url, body, mime="text/html; charset=utf-8", status=200):
    return {"url": url, "data": body.encode() if isinstance(body, str) else body, "content_type": mime, "status": status}


class ExtractionTests(unittest.TestCase):
    def test_roca_selects_main_listing_and_ignores_hidden_and_related(self):
        parsed = _parse_page(roca_fixture(), ROCA)
        self.assertEqual(parsed["candidatas"], [FIRST, SECOND])
        self.assertEqual(parsed["titulo"], "Casa em São Carlos")
        self.assertEqual(parsed["metadados"]["area_construida_m2"], 100)

    def test_roca_id_mismatch_fails_without_fallback(self):
        with self.assertRaises(ExtractionError):
            _parse_page(roca_fixture(), ROCA.replace("57881", "123"))

    def test_explicit_original_is_preferred_to_thumbnail(self):
        self.assertEqual(_photo_url({"urlPhoto": "thumbnail.jpg", "urlOriginal": "original.jpg"}), "original.jpg")
        self.assertEqual(_photo_url({"url": "thumbnail.jpg", "contentUrl": "original.jpg"}), "original.jpg")

    def test_roca_original_rule_requires_observed_script_and_keeps_evidence(self):
        thumbnail = FIRST.replace("front.jpg", "frontAT.jpg")
        script = "https://roca.com.br/_next/static/chunks/128.abc123.js"
        html = '<script src="/_next/static/chunks/128.abc123.js"></script>'
        code = 'function gallery(e){return{src:e.urlPhoto.replace("AT.",".")}}'
        with patch("extrair_anuncio._fetch", return_value=response(script, code, "application/javascript")) as fetch:
            urls, evidence = _roca_originals(html, ROCA, [thumbnail])
            self.assertEqual(urls, [FIRST])
            self.assertEqual(evidence["script"], script)
            self.assertEqual(len(evidence["sha256"]), 64)
            self.assertEqual(evidence["mapeamento"], [{"thumbnail": thumbnail, "original": FIRST}])
            self.assertEqual(fetch.call_count, 1)

    def test_missing_gallery_rule_never_guesses_original_url(self):
        thumbnail = FIRST.replace("front.jpg", "frontAT.jpg")
        with patch("extrair_anuncio._fetch") as fetch:
            urls, evidence = _roca_originals("<html></html>", ROCA, [thumbnail])
            self.assertEqual(urls, [thumbnail])
            self.assertIsNone(evidence)
            fetch.assert_not_called()

    def test_changed_gallery_code_keeps_thumbnail(self):
        thumbnail = FIRST.replace("front.jpg", "frontAT.jpg")
        html = '<script src="/_next/static/chunks/128.abc123.js"></script>'
        with patch("extrair_anuncio._fetch", return_value=response(ROCA, "other code", "application/javascript")):
            urls, evidence = _roca_originals(html, ROCA, [thumbnail])
            self.assertEqual(urls, [thumbnail])
            self.assertIsNone(evidence)

    def test_jsonld_multiple_listings_only_matching_url(self):
        url = "https://site.example/anuncio/42"
        html = '<script type="application/ld+json">' + json.dumps([
            {"@type": "House", "url": "/anuncio/99", "image": "other.jpg"},
            {"@type": "RealEstateListing", "url": url, "image": ["front.jpg", {"contentUrl": "back.jpg"}]},
            {"@type": "Organization", "image": "logo.jpg"}
        ]) + '</script><main><div class="related gallery"><img src="unrelated.jpg"></div></main>'
        self.assertEqual(_parse_page(html, url)["candidatas"], ["front.jpg", "back.jpg"])

    def test_gallery_is_in_main_and_not_recommendations(self):
        html = '<header><div class="gallery"><img src="logo.jpg"></div></header><main><div class="property-gallery"><a href="big.jpg"><img data-original="front.jpg" src="tiny.jpg"></a></div><aside class="similar"><div class="gallery"><img src="other.jpg"></div></aside></main><img src="tracker.jpg">'
        self.assertEqual(_parse_page(html, "https://example.com/a")["candidatas"], ["big.jpg", "front.jpg"])

    def test_download_deduplicates_and_records_origins(self):
        picture = photo()
        def fake_fetch(url, limit, **kwargs):
            return response(url, roca_fixture()) if url == ROCA else response(url, picture, "image/jpeg")
        with tempfile.TemporaryDirectory() as folder, patch("extrair_anuncio._fetch", side_effect=fake_fetch):
            manifest = extrair(ROCA, Path(folder))
            self.assertEqual(manifest["status"], "ok")
            self.assertEqual(len(manifest["fotos"]), 1)
            image = manifest["fotos"][0]
            self.assertEqual(image["origens_duplicadas"], [SECOND])
            self.assertEqual(len(image["sha256"]), 64)
            self.assertEqual((Path(folder) / image["arquivo"]).read_bytes(), picture)
            self.assertEqual(json.loads((Path(folder) / "anuncio.json").read_text(encoding="utf-8")), manifest)

    def test_image_html_failure_preserves_success_and_reports_partial(self):
        def fake_fetch(url, limit, **kwargs):
            if url == ROCA:
                return response(url, roca_fixture())
            return response(url, photo(), "image/jpeg") if url == FIRST else response(url, "<html>blocked</html>", status=403)
        with tempfile.TemporaryDirectory() as folder, patch("extrair_anuncio._fetch", side_effect=fake_fetch):
            manifest = extrair(ROCA, Path(folder))
            self.assertEqual(manifest["status"], "parcial")
            self.assertEqual(len(manifest["erros"]), 1)

    def test_missing_listing_does_not_download_recommendations(self):
        payload = response("https://roca.com.br/imovel-nao-encontrado?i=57194", roca_fixture())
        with tempfile.TemporaryDirectory() as folder, patch("extrair_anuncio._fetch", return_value=payload) as fetch:
            manifest = extrair("https://roca.com.br/imovel/57194", Path(folder))
            self.assertEqual(manifest["status"], "indisponivel")
            self.assertEqual(manifest["fotos"], [])
            self.assertEqual(fetch.call_count, 1)

    def test_server_block_is_not_retried(self):
        with tempfile.TemporaryDirectory() as folder, patch("extrair_anuncio._fetch", return_value=response(ROCA, "", status=403)) as fetch:
            manifest = extrair(ROCA, Path(folder))
            self.assertEqual(manifest["status"], "bloqueado")
            self.assertEqual(fetch.call_count, 1)

    def test_redirect_to_another_listing_does_not_import_its_photos(self):
        with tempfile.TemporaryDirectory() as folder, patch("extrair_anuncio._fetch", return_value=response(ROCA, roca_fixture())) as fetch:
            manifest = extrair(ROCA.replace("57881", "57194"), Path(folder))
            self.assertEqual(manifest["status"], "erro")
            self.assertEqual(manifest["fotos"], [])
            self.assertEqual(fetch.call_count, 1)

    def test_disallows_local_and_unsafe_urls(self):
        for url in ("file:///etc/passwd", "http://localhost/foo", "http://127.0.0.1", "http://10.0.0.1", "http://[::1]", "http://169.254.169.254", "http://user:pass@example.com", "https://example.com:8080", "https://example.com/\nInjected"):
            with self.subTest(url=url), self.assertRaises(ExtractionError):
                _validate_url(url)

    def test_dns_mixed_private_and_public_answers_rejected(self):
        answers = [(2, 1, 6, "", ("93.184.216.34", 443)), (2, 1, 6, "", ("127.0.0.1", 443))]
        with patch("extrair_anuncio.socket.getaddrinfo", return_value=answers), self.assertRaises(ExtractionError):
            _public_address("example.com", 443)

    def test_redirect_private_rejected_before_second_connection(self):
        class Reply:
            status = 302
            def getheader(self, name, default=None):
                return "http://127.0.0.1/admin" if name == "Location" else default
        class Connection:
            def __init__(self, *args, **kwargs):
                pass
            def request(self, *args, **kwargs):
                pass
            def getresponse(self):
                return Reply()
            def close(self):
                pass
        with patch("extrair_anuncio._public_address", return_value="93.184.216.34"), patch("extrair_anuncio.http.client.HTTPConnection", Connection), patch("extrair_anuncio.socket.create_connection") as connect:
            with self.assertRaises(ExtractionError):
                _fetch("http://example.com/listing", 1000)
            self.assertEqual(connect.call_count, 1)


if __name__ == "__main__":
    unittest.main()
