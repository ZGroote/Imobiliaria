import io
from email.message import Message
from urllib.error import HTTPError

import pytest

from backend.app.attachment_files import MAX_ATTACHMENT, NoRedirect, read_attachment, safe_filename
from backend.app.resend_client import ResendError

EMAIL = '00000000-0000-4000-8000-000000000001'
ATTACHMENT = '00000000-0000-4000-8000-000000000002'
URL = f'https://inbound-cdn.resend.com/{EMAIL}/attachments/{ATTACHMENT}?signature=private'


class Opener:
    def __init__(self, content=b'fixture', **headers):
        self.content, self.headers, self.calls = content, headers, []

    def open(self, request, timeout):
        self.calls.append(request)
        assert timeout == 15 and request.get_method() == 'GET'
        assert request.get_header('Authorization') is None
        assert request.get_header('X-crm-token') is None
        response = io.BytesIO(self.content)
        response.status = 200
        response.headers = Message()
        for key, value in self.headers.items():
            response.headers[key.replace('_', '-')] = value
        return response


def test_exact_bytes_and_no_credentials_in_file_request():
    opener = Opener(Content_Length='7')
    assert read_attachment(URL, EMAIL, ATTACHMENT, 7, opener=opener) == b'fixture'
    assert len(opener.calls) == 1


@pytest.mark.parametrize('url', [
    URL.replace('https:', 'http:'), URL.replace('inbound-cdn.resend.com', '127.0.0.1'),
    URL.replace('inbound-cdn.resend.com', 'inbound-cdn.resend.com.evil.invalid'),
    URL.replace('inbound-cdn.resend.com', 'inbound-cdn.resend.com:443'),
    URL.replace('https://', 'https://user:password@'), URL+'#fragment',
    URL.replace(EMAIL, ATTACHMENT, 1), URL.replace('/attachments/', '/raw/'),
    URL.replace('signature=private', ''), URL+'\n', URL.replace('https:', 'file:'),
    '//inbound-cdn.resend.com/file', 'not a url', None,
])
def test_rejects_unbound_or_unsafe_url_before_network(url):
    opener = Opener()
    with pytest.raises(ResendError):
        read_attachment(url, EMAIL, ATTACHMENT, 7, opener=opener)
    assert opener.calls == []


@pytest.mark.parametrize('content,size,headers', [
    (b'fixture', 7, {'Content_Length': '8'}), (b'fixture', 7, {'Content_Length': '-1'}),
    (b'fixture', 7, {'Content_Length': 'x'}), (b'fixture', 7, {'Content_Encoding': 'gzip'}),
    (b'fixture', 6, {}), (b'fixture', 8, {}),
])
def test_rejects_inconsistent_or_incomplete_file(content, size, headers):
    with pytest.raises(ResendError):
        read_attachment(URL, EMAIL, ATTACHMENT, size, opener=Opener(content, **headers))


@pytest.mark.parametrize('size', [-1, MAX_ATTACHMENT+1, True, None, '7'])
def test_size_limit_before_network(size):
    opener = Opener()
    with pytest.raises(ResendError):
        read_attachment(URL, EMAIL, ATTACHMENT, size, opener=opener)
    assert not opener.calls


def test_actual_content_over_limit_and_empty_file():
    with pytest.raises(ResendError):
        read_attachment(URL, EMAIL, ATTACHMENT, MAX_ATTACHMENT, opener=Opener(b'x'*(MAX_ATTACHMENT+1)))
    assert read_attachment(URL, EMAIL, ATTACHMENT, 0, opener=Opener(b'')) == b''


def test_redirect_is_never_followed_and_error_does_not_echo_signed_url():
    assert NoRedirect().redirect_request(None, None, 302, 'redirect', {}, 'https://evil.invalid') is None

    class Redirect:
        def open(self, *args, **kwargs):
            raise HTTPError(URL, 302, 'private signature', {}, None)

    with pytest.raises(ResendError) as result:
        read_attachment(URL, EMAIL, ATTACHMENT, 7, opener=Redirect())
    assert 'signature' not in str(result.value) and URL not in str(result.value)


def test_deadline_limits_slow_transfer(monkeypatch):
    now = [0]
    from backend.app import attachment_files
    monkeypatch.setattr(attachment_files.time, 'monotonic', lambda: now[0])

    class Slow(Opener):
        def open(self, *args, **kwargs):
            response = super().open(*args, **kwargs)
            original = response.read

            def read(n):
                now[0] += 61
                return original(n)

            response.read = read
            return response

    with pytest.raises(ResendError, match='tempo'):
        read_attachment(URL, EMAIL, ATTACHMENT, 7, opener=Slow())


@pytest.mark.parametrize('name,expected', [
    ('../../planta.pdf', 'planta.pdf'), ('C:\\Users\\x\\planta.pdf', 'planta.pdf'),
    ('CON.txt', 'anexo-CON.txt'), ('LPT1', 'anexo-LPT1'), ('../...', 'anexo'),
    ('COM¹.txt', 'anexo-COM¹.txt'), ('CON .txt', 'anexo-CON .txt'),
    ('nota.txt:script.exe', 'nota.txtscript.exe'), ('a\r\n"b.pdf', 'ab.pdf'),
    ('planta\u202eexe.pdf', 'plantaexe.pdf'), ('área útil.pdf', 'área útil.pdf'), (None, 'anexo'),
])
def test_portable_filename(name, expected):
    assert safe_filename(name) == expected
