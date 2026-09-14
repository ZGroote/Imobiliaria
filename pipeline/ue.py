# -*- coding: utf-8 -*-
"""Cliente MCP do Unreal Engine: fala com o editor ABERTO, pela porta 8000.

O plugin de MCP do UE 5.8 sobe um servidor "streamable HTTP" em
`http://127.0.0.1:8000/mcp`. O aperto de mao tem tres passos, e pular qualquer um
devolve erro em vez de ferramenta:

  1. `initialize`  -> a resposta traz o cabecalho `Mcp-Session-Id`;
  2. `notifications/initialized` (sem id, e sem resposta);
  3. dai em diante toda chamada leva o `Mcp-Session-Id`.

A resposta pode vir como JSON puro ou como `text/event-stream` (linhas `data: ...`),
dependendo do que o servidor escolhe -- entao o leitor aceita os dois.

    python pipeline/ue.py                      # lista as ferramentas
    python pipeline/ue.py <ferramenta> '<json>'  # chama uma
"""
import io, json, sys, urllib.request, urllib.error

URL = "http://127.0.0.1:8000/mcp"


class UE(object):
    def __init__(self, url=URL):
        self.url = url
        self.sid = None
        self.n = 0

    def _post(self, corpo, espera=True):
        dados = json.dumps(corpo).encode("utf-8")
        req = urllib.request.Request(self.url, data=dados, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json, text/event-stream")
        if self.sid:
            req.add_header("Mcp-Session-Id", self.sid)
        with urllib.request.urlopen(req, timeout=600) as r:
            sid = r.headers.get("Mcp-Session-Id")
            if sid:
                self.sid = sid
            bruto = r.read().decode("utf-8", "replace")
        if not espera or not bruto.strip():
            return None
        # text/event-stream: o JSON vem depois de "data: "
        if bruto.lstrip().startswith("event:") or bruto.lstrip().startswith("data:"):
            for ln in bruto.splitlines():
                if ln.startswith("data:"):
                    return json.loads(ln[5:].strip())
            return None
        return json.loads(bruto)

    def _id(self):
        self.n += 1
        return self.n

    def conecta(self):
        r = self._post({"jsonrpc": "2.0", "id": self._id(), "method": "initialize",
                        "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                                   "clientInfo": {"name": "imobiliaria", "version": "1"}}})
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"}, espera=False)
        return r

    def ferramentas(self):
        r = self._post({"jsonrpc": "2.0", "id": self._id(), "method": "tools/list",
                        "params": {}})
        return (r or {}).get("result", {}).get("tools", [])

    def chama(self, nome, args=None):
        r = self._post({"jsonrpc": "2.0", "id": self._id(), "method": "tools/call",
                        "params": {"name": nome, "arguments": args or {}}})
        if r is None:
            return None
        if "error" in r:
            raise RuntimeError(json.dumps(r["error"], ensure_ascii=False))
        res = r.get("result", {})
        # o conteudo vem como lista de blocos {type:"text", text:"..."}
        partes = [c.get("text", "") for c in res.get("content", []) if c.get("type") == "text"]
        return "\n".join(partes) if partes else res


def main():
    ue = UE()
    ue.conecta()
    if len(sys.argv) < 2:
        for t in ue.ferramentas():
            d = (t.get("description") or "").strip().splitlines()
            print("%-34s %s" % (t["name"], d[0][:110] if d else ""))
        return 0
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    saida = ue.chama(sys.argv[1], args)
    print(saida if isinstance(saida, str) else json.dumps(saida, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
