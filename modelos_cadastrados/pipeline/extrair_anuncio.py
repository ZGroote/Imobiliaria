"""Importa referências públicas de um anúncio, sem executar JavaScript.

API: extrair(url, destino, max_images=30) -> manifesto também salvo em anuncio.json.
Roca tem adapter de dados estruturados; outros sites usam JSON-LD/galeria principal.
Não resolve CAPTCHA, login ou bloqueios. Requer Pillow para validar as imagens.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import http.client
import io
import ipaddress
import json
from pathlib import Path
import re
import socket
import ssl
from urllib.parse import urljoin, urlsplit, urlunsplit
import warnings

from PIL import Image

TIMEOUT = 20
MAX_HTML = 8 * 1024 * 1024
MAX_IMAGE = 20 * 1024 * 1024
MAX_TOTAL = 250 * 1024 * 1024
USER_AGENT = "Imobiliaria3D/1.0 (public listing photo reference importer)"


class ExtractionError(ValueError):
    pass


def _validate_url(url: str) -> tuple[str, str, int]:
    if not isinstance(url, str) or any(ord(c) < 32 for c in url) or len(url) > 8192:
        raise ExtractionError("URL inválida.")
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in ("https", "http") or not parsed.hostname:
            raise ExtractionError("Somente URLs HTTP/HTTPS públicas são aceitas.")
        if parsed.username is not None or parsed.password is not None:
            raise ExtractionError("URL com credenciais não é aceita.")
        host = parsed.hostname.encode("idna").decode("ascii")
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if port not in (80, 443):
            raise ExtractionError("Somente portas HTTP/HTTPS padrão são aceitas.")
        if host.lower() == "localhost" or host.lower().endswith((".localhost", ".local")):
            raise ExtractionError("Endereço local não é permitido.")
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if address is not None and not address.is_global:
            raise ExtractionError("Endereço privado ou reservado não é permitido.")
    except (UnicodeError, ValueError) as exc:
        raise ExtractionError(str(exc)) from exc
    return parsed.scheme, host, port


def _public_address(host: str, port: int) -> str:
    answers = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    addresses = list(dict.fromkeys(answer[4][0] for answer in answers))
    if not addresses or any(not ipaddress.ip_address(a).is_global for a in addresses):
        raise ExtractionError("DNS aponta para endereço privado ou reservado.")
    return addresses[0]


def _fetch(url: str, limit: int, *, referer: str | None = None) -> dict:
    """Valida cada redirecionamento e conecta ao IP público validado (sem rebinding)."""
    current = url
    for _ in range(6):
        scheme, host, port = _validate_url(current)
        address = _public_address(host, port)
        parsed = urlsplit(current)
        connection = http.client.HTTPConnection(host, port, timeout=TIMEOUT)
        raw = socket.create_connection((address, port), timeout=TIMEOUT)
        try:
            connection.sock = ssl.create_default_context().wrap_socket(raw, server_hostname=host) if scheme == "https" else raw
            headers = {"User-Agent": USER_AGENT, "Accept": "*/*", "Accept-Encoding": "identity"}
            if referer:
                headers["Referer"] = referer
            target = urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
            connection.request("GET", target, headers=headers)
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise ExtractionError("Redirecionamento sem destino.")
                current = urljoin(current, location)
                continue
            length = response.getheader("Content-Length")
            if length and length.isdigit() and int(length) > limit:
                raise ExtractionError("Resposta excede o limite de tamanho.")
            if response.getheader("Content-Encoding", "identity") not in ("", "identity"):
                raise ExtractionError("Servidor enviou compressão não solicitada.")
            body = response.read(limit + 1)
            if len(body) > limit:
                raise ExtractionError("Resposta excede o limite de tamanho.")
            return {"url": current, "status": response.status, "content_type": response.getheader("Content-Type", ""), "data": body}
        finally:
            connection.close()
            raw.close()
    raise ExtractionError("Muitos redirecionamentos.")


class _Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta, self.scripts, self.gallery, self.text = {}, [], [], []
        self.canonical, self.title = "", ""
        self.stack, self.script = [], None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        markers = " ".join(str(values.get(k, "")) for k in ("class", "id", "itemprop", "aria-label")).lower()
        excluded = bool(re.search(r"related|similar|recommend|recomend|sugest|banner|logo|footer|header|avatar", markers))
        parent = self.stack[-1] if self.stack else ("", False, False, False)
        in_main = parent[3] or tag == "main" or values.get("role") == "main" or "property-detail" in markers
        gallery = parent[1] or bool(re.search(r"gallery|galeria|property-photos|imovel-fotos", markers))
        blocked = parent[2] or excluded
        if tag not in ("img", "meta", "link", "br", "hr", "input", "source", "area", "embed", "wbr", "base", "param", "track", "col"):
            self.stack.append((tag, gallery, blocked, in_main))
        if tag == "meta":
            key = values.get("property", values.get("name", ""))
            self.meta[key.lower()] = values.get("content", "")
        elif tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href", "")
        elif tag == "script":
            self.script = {"id": values.get("id", ""), "type": values.get("type", ""), "src": values.get("src", ""), "data": ""}
        elif tag in ("img", "a") and gallery and in_main and not blocked:
            for name in (("data-original", "data-src", "src") if tag == "img" else ("href",)):
                candidate = values.get(name, "")
                if candidate and (tag == "img" or re.search(r"\.(jpg|jpeg|png|webp)(?:[?#]|$)", candidate, re.I)):
                    self.gallery.append(candidate)
                    break

    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            self.scripts.append(self.script)
            self.script = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.script is not None:
            self.script["data"] += data
        else:
            self.text.append(data)
            if self.stack and self.stack[-1][0] == "title":
                self.title += data


def _objects(value):
    if isinstance(value, list):
        for item in value:
            yield from _objects(item)
    elif isinstance(value, dict):
        yield value
        if "@graph" in value:
            yield from _objects(value["@graph"])


def _image_urls(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [url for item in value for url in _image_urls(item)]
    if isinstance(value, dict):
        return _image_urls(value.get("contentUrl") or value.get("url") or [])
    return []


def _photo_url(photo: dict) -> str:
    """Prefere o original explicitamente fornecido; não altera nomes de arquivos."""
    for key in ("urlPhotoOriginal", "urlOriginal", "original", "urlFull", "contentUrl", "urlPhoto", "url", "thumbnailUrl"):
        urls = _image_urls(photo.get(key))
        if urls:
            return urls[0]
    return ""


def _roca_originals(html: str, url: str, candidates: list[str]) -> tuple[list[str], dict | None]:
    """Reproduz a regra da galeria SOMENTE se ela ainda constar no chunk referenciado.

    O HTML da Roca fornece miniaturas AT.jpg, mas o componente da própria galeria
    publica a regra urlPhoto.replace("AT.", "."). Não se executa código baixado.
    A versão do script não é adivinhada: apenas o chunk 128 presente na página é lido.
    """
    if not any(re.search(r"AT\.(?:jpe?g|png|webp)(?:[?#]|$)", candidate, re.I) for candidate in candidates):
        return candidates, None
    page = _Page()
    page.feed(html)
    scripts = [urljoin(url, script["src"]) for script in page.scripts if re.fullmatch(r"/_next/static/chunks/128\.[\w-]+\.js", script["src"])]
    pattern = r'\b\w+\.urlPhoto\.replace\(\s*[\"\']AT\.[\"\']\s*,\s*[\"\']\.[\"\']\s*\)'
    for source in scripts[:1]:
        try:
            payload = _fetch(source, 2 * 1024 * 1024, referer=url)
            if payload["status"] != 200:
                continue
            code = payload["data"].decode("utf-8")
            rule = re.search(pattern, code)
            if rule:
                converted = [candidate.replace("AT.", ".", 1) for candidate in candidates]
                return converted, {"script": source, "script_url_final": payload["url"], "sha256": hashlib.sha256(payload["data"]).hexdigest(), "expressao_observada": rule[0], "metodo": "regra_explicita_da_galeria", "mapeamento": [{"thumbnail": before, "original": after} for before, after in zip(candidates, converted) if before != after]}
        except (OSError, ValueError, UnicodeError, http.client.HTTPException):
            continue
    return candidates, None


def _parse_page(html: str, url: str) -> dict:
    page = _Page()
    page.feed(html)
    result = {"id": None, "titulo": page.meta.get("og:title") or page.title.strip(), "descricao": page.meta.get("description", ""), "metadados": {}, "candidatas": [], "adapter": "generico", "avisos": []}
    host = urlsplit(url).hostname or ""
    if host == "roca.com.br" or host.endswith(".roca.com.br"):
        result["adapter"] = "roca-next-data"
        for script in page.scripts:
            if script["id"] != "__NEXT_DATA__":
                continue
            try:
                value = json.loads(script["data"])["props"]["initialProps"]["pageProps"]["template"]["data"]["property"]
                listing_id = str(value["idtProperty"])
                expected = urlsplit(url).path.rstrip("/").split("/")[-1]
                if listing_id != expected:
                    raise ExtractionError("Identificador dos dados difere do anúncio solicitado.")
                photos = json.loads(value.get("jsonPhotos") or "[]")
                result.update(id=listing_id, titulo=value.get("desTitleSite") or result["titulo"], descricao=value.get("desInformationSite") or result["descricao"])
                keep = {"namCategory": "categoria", "namSubCategory": "tipo", "namDistrict": "bairro", "namCity": "cidade", "namState": "estado", "totalRooms": "dormitorios", "totalGarages": "garagens", "prop_char_1": "area_construida_m2", "prop_char_2": "area_terreno_m2", "prop_char_7": "banheiros", "latitude": "latitude", "longitude": "longitude", "valLocation": "aluguel_brl", "valSale": "venda_brl"}
                result["metadados"] = {out: value[key] for key, out in keep.items() if key in value}
                result["candidatas"] = [_photo_url(p) for p in photos if isinstance(p, dict) and p.get("flgNotShowSite") in (None, 0, False, "0") and f"/imovel/fotos/{listing_id}/" in _photo_url(p)]
                return result
            except (KeyError, TypeError, json.JSONDecodeError):
                continue
        # Neste domínio nunca use as fotos de imóveis semelhantes como fallback.
        result["avisos"].append("Os dados do imóvel principal não foram encontrados; nenhuma galeria de recomendados foi importada.")
        return result
    candidates = []
    for script in page.scripts:
        if script["type"].split(";")[0] != "application/ld+json":
            continue
        try:
            for obj in _objects(json.loads(script["data"])):
                kinds = obj.get("@type", [])
                kinds = [kinds] if isinstance(kinds, str) else kinds
                if any(kind in ("RealEstateListing", "House", "Residence", "Apartment", "SingleFamilyResidence", "Accommodation") for kind in kinds):
                    candidates.append(obj)
        except (json.JSONDecodeError, TypeError):
            continue
    normalized = url.split("#")[0].rstrip("/")
    matches = [c for c in candidates if isinstance(c.get("url"), str) and urljoin(url, c["url"]).split("#")[0].rstrip("/") == normalized]
    selected = matches[0] if matches else candidates[0] if len(candidates) == 1 and not candidates[0].get("url") else None
    if selected:
        result["adapter"] = "jsonld"
        result["titulo"] = selected.get("name") or result["titulo"]
        result["descricao"] = selected.get("description") or result["descricao"]
        result["metadados"] = {k: selected[k] for k in ("address", "floorSize", "numberOfRooms", "offers") if k in selected}
        result["candidatas"] = _image_urls(selected.get("image"))
    if page.gallery:
        result["candidatas"].extend(page.gallery)
        result["adapter"] += "+galeria-principal"
    if not result["candidatas"] and page.meta.get("og:image") and not candidates:
        result["candidatas"] = [page.meta["og:image"]]
        result["adapter"] = "opengraph-capa"
        result["avisos"].append("Somente a imagem de capa foi identificada; a galeria pode exigir um adapter específico.")
    return result


def _decode_html(payload: dict) -> str:
    mime = payload["content_type"].lower()
    if "html" not in mime:
        raise ExtractionError("A URL não retornou uma página HTML.")
    charset = re.search(r"charset\s*=\s*[\"']?([\w-]+)", mime)
    encoding = charset[1] if charset else "utf-8"
    try:
        return payload["data"].decode(encoding)
    except (UnicodeDecodeError, LookupError):
        return payload["data"].decode("utf-8", errors="replace")


def _image_info(body: bytes) -> tuple[str, int, int]:
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(body)) as picture:
            extension = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(picture.format)
            width, height = picture.size
            if not extension or min(width, height) < 96 or width * height < 30000 or width * height > 40_000_000:
                raise ExtractionError("Imagem muito pequena, excessiva ou formato não suportado.")
            picture.verify()
    return extension, width, height


def extrair(url: str, destino: Path, max_images: int = 30) -> dict:
    """Salva referências verificadas e um manifesto, inclusive em falhas de acesso.

    status: ok, parcial, sem_imagens, indisponivel, bloqueado ou erro.
    Os caminhos de fotos são relativos ao diretório destino; nunca são derivados de URL.
    """
    if not isinstance(max_images, int) or isinstance(max_images, bool) or not 1 <= max_images <= 50:
        raise ValueError("max_images deve estar entre 1 e 50.")
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    manifest = {"versao": 1, "url": url, "url_final": None, "extraido_em": datetime.now(timezone.utc).isoformat(), "status": "erro", "id": None, "titulo": "", "descricao": "", "metadados": {}, "fotos": [], "erros": [], "avisos": []}
    try:
        page = _fetch(url, MAX_HTML)
        manifest["url_final"] = page["url"]
        manifest["http_status"] = page["status"]
        if page["status"] in (401, 403, 429):
            manifest["status"] = "bloqueado"
            raise ExtractionError(f"Servidor recusou acesso (HTTP {page['status']}); não foi tentado contornar o bloqueio.")
        if page["status"] in (404, 410) or re.search(r"imovel-nao-encontrado|imovel-indisponivel", urlsplit(page["url"]).path):
            manifest["status"] = "indisponivel"
            raise ExtractionError("O anúncio está indisponível.")
        if page["status"] != 200:
            raise ExtractionError(f"Resposta HTTP {page['status']}.")
        html = _decode_html(page)
        parsed = _parse_page(html, page["url"])
        requested_host = urlsplit(url).hostname or ""
        requested_id = urlsplit(url).path.rstrip("/").split("/")[-1]
        if (requested_host == "roca.com.br" or requested_host.endswith(".roca.com.br")) and requested_id.isdigit() and parsed["id"] and parsed["id"] != requested_id:
            raise ExtractionError("O redirecionamento levou a outro imóvel; as fotos não foram importadas.")
        candidates = parsed.pop("candidatas")
        if parsed["adapter"] == "roca-next-data" and candidates:
            candidates, evidence = _roca_originals(html, page["url"], candidates)
            if evidence:
                parsed["evidencia_galeria"] = evidence
            elif any(re.search(r"AT\.(?:jpe?g|png|webp)(?:[?#]|$)", candidate, re.I) for candidate in candidates):
                parsed["avisos"].append("A página fornece miniaturas; a regra de acesso aos originais não pôde ser confirmada. Nenhuma URL foi adivinhada.")
        manifest.update(parsed)
        if not candidates and re.search(r"captcha|cf-chl-|verify you are human|verifique que voc[eê] [eé] humano", html, re.I):
            manifest["status"] = "bloqueado"
            raise ExtractionError("A página exige verificação humana; extração interrompida.")
        urls = list(dict.fromkeys(urljoin(page["url"], value) for value in candidates if isinstance(value, str)))
        manifest["imagens_identificadas"] = len(urls)
        if len(urls) > max_images:
            manifest["avisos"].append(f"Limite solicitado: {max_images} das {len(urls)} imagens identificadas.")
        seen, total = {}, 0
        for image_url in urls[:max_images]:
            try:
                payload = _fetch(image_url, min(MAX_IMAGE, MAX_TOTAL - total), referer=page["url"])
                total += len(payload["data"])
                if payload["status"] != 200:
                    raise ExtractionError(f"Imagem retornou HTTP {payload['status']}.")
                extension, width, height = _image_info(payload["data"])
                digest = hashlib.sha256(payload["data"]).hexdigest()
                if digest in seen:
                    seen[digest].setdefault("origens_duplicadas", []).append(image_url)
                    continue
                relative = f"fotos/{digest[:20]}.{extension}"
                target = destino / relative
                target.parent.mkdir(exist_ok=True)
                target.write_bytes(payload["data"])
                record = {"arquivo": relative, "url": image_url, "url_final": payload["url"], "sha256": digest, "largura": width, "altura": height, "bytes": len(payload["data"])}
                if min(width, height) < 480:
                    record["limitacao"] = "baixa_resolucao"
                manifest["fotos"].append(record)
                seen[digest] = record
            except (OSError, ValueError, http.client.HTTPException, Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
                manifest["erros"].append({"url": image_url, "mensagem": str(exc)})
            if total >= MAX_TOTAL:
                manifest["avisos"].append("Limite total de download atingido.")
                break
        low_resolution = sum(1 for picture in manifest["fotos"] if picture.get("limitacao") == "baixa_resolucao")
        if low_resolution:
            manifest["avisos"].append(f"{low_resolution} foto(s) com lado menor abaixo de 480 px: detalhes finos podem não ser recuperáveis.")
        manifest["status"] = "parcial" if manifest["fotos"] and (manifest["erros"] or manifest["avisos"]) else "ok" if manifest["fotos"] else "sem_imagens"
    except (OSError, ValueError, http.client.HTTPException) as exc:
        manifest["erros"].append({"url": url, "mensagem": str(exc)})
    (destino / "anuncio.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("destino", type=Path)
    parser.add_argument("--max-images", type=int, default=30)
    args = parser.parse_args()
    result = extrair(args.url, args.destino, args.max_images)
    print(json.dumps({"status": result["status"], "fotos": len(result["fotos"]), "manifesto": str(args.destino / "anuncio.json"), "erros": result["erros"]}, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["fotos"] else 1)
