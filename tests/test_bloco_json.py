# -*- coding: utf-8 -*-
"""O bloco de dado da página não pode fechar a própria tag.

`__imoveis` e `__unidades` carregam texto de cadastro -- título, bairro, URL do
anúncio. Um `</script>` ali dentro encerraria o `<script type="application/json">`
e o resto do JSON viraria marcação dentro do documento.
"""
import json
import unittest
from pathlib import Path

from pipeline.montar import bloco_json

RAIZ = Path(__file__).resolve().parents[1]

HOSTIL = [{"id": 1, "titulo": "Casa </script><script>alert(1)</script>",
           "bairro": "Centro", "url": "https://x/1"}]


class BlocoJsonTests(unittest.TestCase):
    def test_the_block_cannot_close_its_own_tag(self):
        partes = bloco_json("__imoveis", json.dumps(HOSTIL, ensure_ascii=False))
        self.assertEqual(len(partes), 3)
        self.assertNotIn("</", partes[1], "nenhum fim de tag sobra no dado")
        self.assertEqual("".join(partes).count("</script>"), 1, "uma tag, a do fim")

    def test_the_renderer_still_reads_the_same_data(self):
        """`<\\/` é escape válido de JSON e volta a `</` -- o dado não muda."""
        partes = bloco_json("__imoveis", json.dumps(HOSTIL, ensure_ascii=False))
        self.assertEqual(json.loads(partes[1]), HOSTIL)

    def test_text_without_the_sequence_comes_out_byte_for_byte(self):
        texto = json.dumps({"b": [1, 2, 3], "nome": "Rua São <João>"},
                           ensure_ascii=False, separators=(",", ":"))
        self.assertEqual(bloco_json("__citydata", texto)[1], texto)

    def test_the_cut_runs_before_the_escape(self):
        class RecorteFalso:
            def aplica(self, ident, texto):
                return texto.replace("TUDO", "</script>")
        partes = bloco_json("__imoveis", '["TUDO"]', RecorteFalso())
        self.assertNotIn("</s", partes[1])
        self.assertEqual(json.loads(partes[1]), ["</script>"])

    def test_every_data_block_of_the_page_goes_through_it(self):
        """A proteção só vale se nenhum bloco for montado à mão ao lado dela."""
        fonte = (RAIZ / "pipeline/montar.py").read_text(encoding="utf-8")
        corpo = fonte[fonte.index("def monta("):]
        self.assertNotIn('<script type="application/json"', corpo,
                         "bloco montado fora de bloco_json")


if __name__ == "__main__":
    unittest.main()
