import gzip
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from servidor_medido import MeasuredServer, accepts_gzip


class TransportTest(unittest.TestCase):
    def test_quality_and_unsupported_encodings(self):
        self.assertTrue(accepts_gzip('br, gzip, deflate'))
        self.assertFalse(accepts_gzip('gzip;q=0, identity'))
        self.assertFalse(accepts_gzip('gzip;q=invalid'))
        self.assertFalse(accepts_gzip('gzip;q=0, *;q=1'))

    def test_gzip_roundtrip_revalidation_binary_and_directory_escape(self):
        with tempfile.TemporaryDirectory(prefix='liv-http-test-') as folder:
            root = Path(folder).resolve(); self.assertTrue(root.is_relative_to(Path(tempfile.gettempdir()).resolve()))
            self.assertTrue(root.name.startswith('liv-http-test-')); source = ('console.log("LIV");\n' * 300).encode()
            (root / 'runtime.js').write_bytes(source); (root / 'atlas.gz').write_bytes(b'GZIP-ASSET')
            server = MeasuredServer(root).start()
            try:
                request = urllib.request.Request(server.url + 'runtime.js', headers={'Accept-Encoding': 'gzip'})
                with urllib.request.urlopen(request) as response:
                    body = response.read(); etag = response.headers['ETag']
                    self.assertEqual(gzip.decompress(body), source); self.assertEqual(response.headers['Content-Encoding'], 'gzip')
                    self.assertLess(len(body), len(source))
                request.add_header('If-None-Match', etag)
                with self.assertRaises(urllib.error.HTTPError) as error: urllib.request.urlopen(request)
                self.assertEqual(error.exception.code, 304)
                error.exception.close()
                with urllib.request.urlopen(urllib.request.Request(server.url + 'atlas.gz', headers={'Accept-Encoding': 'gzip'})) as response:
                    self.assertIsNone(response.headers['Content-Encoding']); self.assertEqual(response.read(), b'GZIP-ASSET')
                with self.assertRaises(urllib.error.HTTPError) as error: urllib.request.urlopen(server.url + '%2e%2e/secret')
                self.assertEqual(error.exception.code, 404)
                error.exception.close()
            finally: server.close()


if __name__ == '__main__': unittest.main()
