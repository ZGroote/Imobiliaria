"""Inspetor do pipeline de Gaussian Splatting do Liv.

  medir     splat x Cycles nas vistas de teste do `ns-eval --render-output-path` (cada PNG é Cycles | splat
            lado a lado), agregado POR CÔMODO, com os piores pontos e a recaptura sugerida.
  visao     monta o pedido de checagem visual (lista fixa) para um modelo com visão. Não chama nada pago:
            só envia com --executar e ANTHROPIC_API_KEY no ambiente.
  veredito  registra aprovado/reprovado + motivo + imagem em JSONL (base para um classificador próprio).

Exemplos (na pasta piloto-render):
  python inspetor.py medir --eval nuvem/eval --captura nuvem/captura --unidade ../interiores/meio/unidade.json --saida nuvem/inspecao
  python inspetor.py visao --imagem teste/suite.png --referencia v2/suite.png --saida pedido.json
  python inspetor.py veredito --imagem teste/suite.png --veredito reprovado --motivo "teto escuro"
"""
import argparse, base64, datetime, hashlib, json, math, os, shutil, sys
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import planta as P

# ---------------------------------------------------------------- medição
def psnr(a, b):
    mse = float(np.mean((a - b) ** 2))
    return 99.0 if mse == 0 else 10 * math.log10(1.0 / mse)

def escuro_incorreto(a, b):
    """Percentual da imagem quase preto no splat onde a referência tem superfície clara."""
    return float(np.mean((b.mean(axis=2) < .025) & (a.mean(axis=2) > .15)) * 100)

def ssim(a, b):
    from skimage.metrics import structural_similarity
    return float(structural_similarity(a, b, channel_axis=2, data_range=1.0))

def lpips_fn():
    """LPIPS só se torch + lpips estiverem instalados (na nuvem estão; aqui, em geral, não)."""
    try:
        import torch, lpips
    except ImportError:
        return None
    rede = lpips.LPIPS(net="alex", verbose=False)
    def f(a, b):
        t = lambda x: torch.from_numpy(x).permute(2, 0, 1)[None].float() * 2 - 1
        with torch.no_grad(): return float(rede(t(a), t(b)))
    return f

def separar_avaliacao(n, fracao=0.9):
    """Índices de teste do nerfstudio (eval_mode=fraction): o que sobra do linspace de treino."""
    treino = np.linspace(0, n - 1, math.ceil(n * fracao), dtype=int)
    return [int(i) for i in np.setdiff1d(np.arange(n), treino)]

def quadros_avaliacao(tr, fracao=0.9):
    quadros = sorted(tr["frames"], key=lambda f: f["file_path"])
    if "val_filenames" not in tr: return quadros, separar_avaliacao(len(quadros), fracao)
    nomes = set(tr["val_filenames"])
    if not nomes or not nomes <= {f["file_path"] for f in quadros}:
        raise ValueError("Divisão explícita de avaliação vazia ou com imagens desconhecidas")
    return quadros, [i for i, f in enumerate(quadros) if f["file_path"] in nomes]

def miniatura(img, w=96):
    return np.asarray(Image.fromarray((img * 255).astype(np.uint8)).resize((w, w * img.shape[0] // img.shape[1])), np.float32) / 255

def ler(caminho):
    return np.asarray(Image.open(caminho).convert("RGB"), np.float32) / 255

def mapa_erro(a, b):
    import cv2
    e = np.abs(a - b).mean(axis=2)
    e8 = np.clip(e / 0.15, 0, 1) * 255                 # 0,15 de erro médio já é vermelho
    return cv2.applyColorMap(e8.astype(np.uint8), cv2.COLORMAP_INFERNO)[..., ::-1]

AMBIENTES = {"sofa": "estar", "rack": "estar", "mesa": "jantar", "pia": "cozinha", "fogao": "cozinha", "geladeira": "cozinha"}

def ambiente(pl, pos, comodo):
    """Sala integrada é um cômodo só no cadastro: separa estar/jantar/cozinha pelo móvel-âncora mais perto.
    ponytail: posição da câmera, não para onde ela olha; trocar por frustum se a nota por ambiente enganar."""
    ancoras = [(m, AMBIENTES[m["tipo"]]) for m in pl.moveis() if m["comodo"] == comodo and m["tipo"] in AMBIENTES]
    if not ancoras or (pl.comodo(pos) or {}).get("tipo") != "sala": return comodo
    m, amb = min(ancoras, key=lambda t: (t[0]["centro"][0] - pos[0]) ** 2 + (t[0]["centro"][1] - pos[1]) ** 2)
    return f"{comodo} · {amb}"

def medir(a):
    tr = json.load(open(os.path.join(a.captura, "transforms.json"), encoding="utf-8"))
    quadros, teste = quadros_avaliacao(tr, a.fracao)
    arquivos = sorted(f for f in os.listdir(a.eval) if f.endswith(".png"))
    if len(arquivos) != len(teste):
        sys.exit(f"{len(arquivos)} imagens em {a.eval}, mas o split de {len(quadros)} quadros dá {len(teste)} de teste")
    pl = P.carregar(a.unidade)
    lp = lpips_fn()
    os.makedirs(os.path.join(a.saida, "piores"), exist_ok=True)
    linhas = []
    for arq, iq in zip(arquivos, teste):
        par = ler(os.path.join(a.eval, arq)); w = par.shape[1] // 2
        gt, pred = par[:, :w], par[:, w:]
        q = quadros[iq]
        # confere o casamento quadro <-> imagem de teste contra a imagem da captura
        orig = os.path.join(a.captura, q["file_path"])
        casou = None
        if os.path.exists(orig):
            casou = float(np.abs(miniatura(ler(orig)) - miniatura(gt)).mean()) < 0.02
        m = np.array(q["transform_matrix"]); pos = (float(m[0][3]), float(m[1][3]), float(m[2][3]))
        com = q.get("comodo") or (pl.comodo(pos[:2]) or {}).get("nome") or "fora dos cômodos"
        com = ambiente(pl, pos[:2], com)
        linhas.append({"imagem": arq, "quadro": q["file_path"], "casou": casou, "comodo": com,
                       "pos": [round(v, 2) for v in pos], "psnr": psnr(gt, pred), "ssim": ssim(gt, pred),
                       "pitch": q.get("pitch"), "escuro_incorreto_pct": escuro_incorreto(gt, pred),
                       "lpips": lp(gt, pred) if lp else None})
        print(f"{arq} {q['file_path']} {com:<20} PSNR {linhas[-1]['psnr']:.2f} SSIM {linhas[-1]['ssim']:.4f}", flush=True)
    if any(l["casou"] is False for l in linhas):
        print("AVISO: imagens de teste que não batem com o quadro da captura:", [l["imagem"] for l in linhas if l["casou"] is False])

    abaixo = lambda l: l["psnr"] < a.meta_psnr or l["ssim"] < a.meta_ssim
    por = {}
    for l in linhas: por.setdefault(l["comodo"], []).append(l)
    comodos = []
    for nome, ls in sorted(por.items(), key=lambda kv: np.mean([l["psnr"] for l in kv[1]])):
        media = lambda k: None if ls[0][k] is None else float(np.mean([l[k] for l in ls]))
        r = {"comodo": nome, "vistas": len(ls), "psnr": media("psnr"), "psnr_min": min(l["psnr"] for l in ls),
             "ssim": media("ssim"), "lpips": media("lpips"), "abaixo_da_meta": sum(map(abaixo, ls))}
        r["ok"] = r["psnr"] >= a.meta_psnr and r["ssim"] >= a.meta_ssim and r["abaixo_da_meta"] == 0
        if not r["ok"] and nome != "fora dos cômodos":
            nome = nome.split(" · ")[0]                    # a captura recorta por cômodo do cadastro
            # ponytail: recaptura = grade mais densa no cômodo inteiro; mirar só nos piores pontos se isso não bastar
            r["recaptura"] = (f'blender -b apartamento.blend --python capturar_splat.py -- --saida captura-extra '
                              f'--zona "{nome}" --passo 0.25 --prefixo {"".join(c for c in nome.lower() if c.isalnum())[:8]}_')
            r["piores_pontos"] = [l["pos"] for l in sorted(ls, key=lambda l: l["psnr"])[:3]]
        comodos.append(r)

    piores = sorted(linhas, key=lambda l: l["psnr"])[:a.piores]
    for l in piores:
        par = ler(os.path.join(a.eval, l["imagem"])); w = par.shape[1] // 2
        tri = np.concatenate([(par[:, :w] * 255).astype(np.uint8), (par[:, w:] * 255).astype(np.uint8), mapa_erro(par[:, :w], par[:, w:])], axis=1)
        l["folha"] = os.path.join("piores", l["imagem"].replace(".png", "-cycles-splat-erro.jpg"))
        Image.fromarray(tri).resize((tri.shape[1] // 2, tri.shape[0] // 2)).save(os.path.join(a.saida, l["folha"]), quality=88)

    geral = {k: float(np.mean([l[k] for l in linhas])) if linhas[0][k] is not None else None for k in ("psnr", "ssim", "lpips")}
    ref = None
    if a.eval_json and os.path.exists(a.eval_json):
        ref = json.load(open(a.eval_json))["results"]
    rel = {"meta": {"psnr": a.meta_psnr, "ssim": a.meta_ssim}, "geral": geral, "ns_eval": ref,
           "comodos": comodos, "piores": piores, "vistas": linhas}
    json.dump(rel, open(os.path.join(a.saida, "relatorio.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    f = lambda v, d=2: "—" if v is None else f"{v:.{d}f}"
    md = [f"# Inspeção do splat — {len(linhas)} vistas de teste", "",
          f"Meta por vista: PSNR ≥ {a.meta_psnr} dB e SSIM ≥ {a.meta_ssim}. "
          f"Média: PSNR {f(geral['psnr'])} dB, SSIM {f(geral['ssim'], 4)}, LPIPS {f(geral['lpips'], 4)}"
          + (f" (ns-eval: PSNR {ref['psnr']:.2f}, SSIM {ref['ssim']:.4f}, LPIPS {ref['lpips']:.4f})" if ref else "")
          + ("" if geral["lpips"] is not None else ". LPIPS por vista precisa de torch + lpips (não instalados aqui)."),
          "", "| Cômodo | Vistas | PSNR médio | PSNR mín. | SSIM | LPIPS | Abaixo da meta | Situação |",
          "|---|---:|---:|---:|---:|---:|---:|---|"]
    for r in comodos:
        md.append(f"| {r['comodo']} | {r['vistas']} | {f(r['psnr'])} | {f(r['psnr_min'])} | {f(r['ssim'], 4)} | {f(r['lpips'], 4)} | "
                  f"{r['abaixo_da_meta']} | {'ok' if r['ok'] else '**abaixo**'} |")
    sugest = [r for r in comodos if r.get("recaptura")]
    md += ["", "## Mais vistas sugeridas", ""] + ([f"- **{r['comodo']}**: piores câmeras em {r['piores_pontos']}.\n  `{r['recaptura']}`"
                                                  for r in sugest] or ["Nenhum cômodo abaixo da meta."])
    md += ["", f"## {len(piores)} piores vistas (Cycles | splat | erro)", ""]
    for l in piores:
        md += [f"- {l['imagem']} ({l['quadro']}, {l['comodo']}, câmera {l['pos']}): PSNR {l['psnr']:.2f}, SSIM {l['ssim']:.4f}",
               f"  ![{l['imagem']}]({l['folha'].replace(os.sep, '/')})"]
    open(os.path.join(a.saida, "relatorio.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
    print("RELATORIO", os.path.join(a.saida, "relatorio.md"))
    return rel

# ---------------------------------------------------------------- visão
CHECAGENS = [
    ("escuro", "Parede ou teto escuro demais (cinza sujo ou preto onde deveria ser off-white iluminado)."),
    ("flutuando", "Objeto flutuando: móvel, almofada, planta ou objeto decorativo sem apoio, ou afundado em outro."),
    ("xadrez", "Textura repetida ou xadrez: padrão de ladrilho visível, tecido quadriculado, repetição óbvia."),
    ("mancha", "Mancha: borrão, ruído, vazamento de luz, faixa clara/escura sem causa, artefato de splat (névoa, bolhas)."),
    ("dentro", "Câmera dentro de objeto: a imagem mostra o interior de uma parede/móvel ou um plano cobrindo o quadro."),
    ("distorcao", "Distorção: linhas retas tortas, proporção errada, perspectiva esticada, objeto deformado."),
]

def pedido_visao(imagem, referencia=None, modelo="claude-sonnet-5-5"):
    """Corpo de uma chamada à Messages API: referência aprovada (opcional) + imagem + lista fixa, resposta em JSON."""
    def img(caminho):
        tipo = "image/png" if caminho.lower().endswith(".png") else "image/jpeg"
        return {"type": "image", "source": {"type": "base64", "media_type": tipo,
                                            "data": base64.b64encode(open(caminho, "rb").read()).decode()}}
    lista = "\n".join(f'- "{k}": {d}' for k, d in CHECAGENS)
    conteudo = []
    if referencia:
        conteudo += [{"type": "text", "text": "Referência aprovada (mesmo cômodo, o nível que se espera):"}, img(referencia)]
    conteudo += [{"type": "text", "text": "Render a inspecionar:"}, img(imagem), {"type": "text", "text":
        "Você é o inspetor de qualidade de renders de interiores para venda de apartamentos. Avalie o render "
        "contra cada item abaixo" + (", comparando com a referência aprovada" if referencia else "") + ".\n" + lista +
        '\nResponda só com JSON: {"itens": {"<id>": {"falha": true|false, "certeza": 0-1, "onde": "<região>"}}, '
        '"aprovado": true|false, "resumo": "<uma frase>"}'}]
    return {"model": modelo, "max_tokens": 800, "messages": [{"role": "user", "content": conteudo}]}

def visao(a):
    corpo = pedido_visao(a.imagem, a.referencia, a.modelo)
    json.dump(corpo, open(a.saida, "w", encoding="utf-8"), indent=1)
    if not a.executar:
        print("PEDIDO", a.saida, "(não enviado: a chamada é paga; repita com --executar e ANTHROPIC_API_KEY)")
        return None
    chave = os.environ.get("ANTHROPIC_API_KEY")
    if not chave: sys.exit("--executar precisa de ANTHROPIC_API_KEY no ambiente")
    import urllib.request
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=json.dumps(corpo).encode(),
                                 headers={"x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    resp = json.load(urllib.request.urlopen(req, timeout=120))
    texto = "".join(b.get("text", "") for b in resp["content"])
    resultado = json.loads(texto[texto.index("{"): texto.rindex("}") + 1])
    destino = os.path.splitext(a.saida)[0] + "-resposta.json"
    json.dump({"imagem": a.imagem, "referencia": a.referencia, "modelo": a.modelo, "resultado": resultado},
              open(destino, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("RESPOSTA", destino, json.dumps(resultado, ensure_ascii=False))
    return resultado

# ---------------------------------------------------------------- vereditos
def veredito(a):
    """Uma linha por veredito; a imagem é copiada por hash, para o conjunto não depender de pastas que mudam."""
    dados = open(a.imagem, "rb").read(); sha = hashlib.sha256(dados).hexdigest()
    pasta = os.path.join(os.path.dirname(os.path.abspath(a.arquivo)), "vereditos-imagens"); os.makedirs(pasta, exist_ok=True)
    copia = os.path.join(pasta, sha[:16] + os.path.splitext(a.imagem)[1])
    if not os.path.exists(copia): shutil.copyfile(a.imagem, copia)
    linha = {"quando": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "imagem": os.path.relpath(copia, os.path.dirname(os.path.abspath(a.arquivo))).replace(os.sep, "/"),
             "origem": a.imagem, "sha256": sha, "veredito": a.veredito, "motivo": a.motivo, "itens": a.itens or [],
             "comodo": a.comodo, "referencia": a.referencia,
             "visao": json.load(open(a.visao, encoding="utf-8")) if a.visao else None}
    with open(a.arquivo, "a", encoding="utf-8") as f:
        f.write(json.dumps(linha, ensure_ascii=False) + "\n")
    print("VEREDITO", a.arquivo, a.veredito, sha[:16])
    return linha

# ---------------------------------------------------------------- linha de comando
def principal(args=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("medir")
    m.add_argument("--eval", required=True, help="pasta do ns-eval --render-output-path")
    m.add_argument("--captura", required=True, help="pasta com transforms.json e images/")
    m.add_argument("--unidade", required=True, help="interiores/<tipologia>/unidade.json")
    m.add_argument("--saida", required=True)
    m.add_argument("--eval-json", help="eval.json do ns-eval, para conferir a média")
    m.add_argument("--fracao", type=float, default=0.9, help="train_split_fraction do treino")
    m.add_argument("--meta-psnr", type=float, default=33.0)
    m.add_argument("--meta-ssim", type=float, default=0.96)
    m.add_argument("--piores", type=int, default=6)
    v = sub.add_parser("visao")
    v.add_argument("--imagem", required=True); v.add_argument("--referencia"); v.add_argument("--saida", required=True)
    v.add_argument("--modelo", default="claude-sonnet-5-5"); v.add_argument("--executar", action="store_true")
    r = sub.add_parser("veredito")
    r.add_argument("--imagem", required=True); r.add_argument("--veredito", required=True, choices=("aprovado", "reprovado"))
    r.add_argument("--motivo", default=""); r.add_argument("--itens", nargs="*", choices=[k for k, _ in CHECAGENS])
    r.add_argument("--comodo"); r.add_argument("--referencia"); r.add_argument("--visao", help="resposta do comando visao")
    r.add_argument("--arquivo", default=os.path.join(AQUI, "vereditos.jsonl"))
    a = ap.parse_args(args)
    return {"medir": medir, "visao": visao, "veredito": veredito}[a.cmd](a)

if __name__ == "__main__":
    principal()
