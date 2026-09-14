# -*- coding: utf-8 -*-
"""Roda um script Python DENTRO do editor do Unreal, e devolve o log.

    python pipeline/unreal_roda.py unreal/render_beleza.py --marca BELEZA
    python pipeline/unreal_roda.py unreal/render_beleza.py --rt --limite 1700

Existe porque nada mais funciona: `-run=pythonscript` (commandlet) renderiza sem
iluminar, e `-ExecCmds="py ..."` nao roda o script nem deixa trace. O unico caminho e
`+StartupScripts=` no `DefaultEngine.ini` do projeto, com o editor CHEIO -- ver
`unreal/assar.py` e PIPELINE secao 24.

**So mexe no AssarLuz.** O projeto `Imobiliária` e a sessao ABERTA do usuario; alterar
o ini dele ou matar o processo dele seria destruir trabalho em curso. O AssarLuz e o
clone descartavel feito pra isso. Pelo mesmo motivo o encerramento filtra por linha de
comando, e nao por nome de processo.

O ini e restaurado no `finally`: sem isso a proxima abertura do AssarLuz voltaria a
rodar o ultimo script sozinha.

`--rt` liga ray tracing por hardware. Nao basta `r.RayTracing=True`: sem SM6 o log diz
"Ray tracing is disabled. Reason: not supported by current RHI", e `r.PathTracing 1`
por console responde "is read only" -- as duas fotos saem IDENTICAS e nada acusa.
Por isso `--rt` mexe em TRES coisas ao mesmo tempo: SM6 na lista de formatos, DX12 como
RHI padrao, e `r.PathTracing=True` no ini (o cvar so aceita valor na inicializacao).
Trocar pra SM6 custa uma recompilacao completa de shader na primeira vez.
"""
import io, os, re, shutil, subprocess, sys, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJ = r"C:\Users\respawn\Documents\Unreal Projects\AssarLuz"
UPROJECT = os.path.join(PROJ, "AssarLuz.uproject")
INI = os.path.join(PROJ, "Config", "DefaultEngine.ini")
EDITOR = r"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
SECAO = "[/Script/PythonScriptPlugin.PythonScriptPluginSettings]"
RS = "[/Script/Engine.RendererSettings]"
WS = "[/Script/WindowsTargetPlatform.WindowsTargetSettings]"

RT_LINHAS = [
    (RS, ["r.RayTracing=True", "r.PathTracing=True", "r.SkinCache.CompileShaders=True"]),
    (WS, ["DefaultGraphicsRHI=DefaultGraphicsRHI_DX12",
          "-D3D12TargetedShaderFormats=PCD3D_SM5",
          "+D3D12TargetedShaderFormats=PCD3D_SM6"]),
]
RT_LIMPA = re.compile(
    r"(?m)^(r\.RayTracing|r\.PathTracing|r\.SkinCache\.CompileShaders"
    r"|DefaultGraphicsRHI|[+-]D3D12TargetedShaderFormats)=.*\r?\n?")


def arg(nome, padrao=None):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else padrao


def mata_minha_instancia():
    """Mata SO o editor do AssarLuz. A sessao do usuario roda outro projeto e a linha
    de comando e o unico jeito de distinguir as duas."""
    subprocess.run(["powershell", "-NoProfile", "-Command",
                    "Get-CimInstance Win32_Process -Filter \"Name='UnrealEditor.exe'\" | "
                    "Where-Object { $_.CommandLine -like '*AssarLuz*' } | "
                    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"],
                   capture_output=True, text=True)


def main():
    script = ([a for a in sys.argv[1:] if not a.startswith("--")] or
              ["unreal/render_beleza.py"])[0]
    script = os.path.abspath(os.path.join(RAIZ, script)).replace("\\", "/")
    marca = arg("--marca", "BELEZA")
    limite = int(arg("--limite", "900"))
    rt = "--rt" in sys.argv
    if not os.path.exists(script):
        print("falta %s" % script); return 1
    if not os.path.exists(EDITOR):
        print("falta o editor: %s" % EDITOR); return 1

    bak = INI + ".bak"
    shutil.copy2(INI, bak)
    try:
        s = io.open(INI, encoding="utf-8-sig", newline="").read()
        s = re.sub(r"(?m)^\+StartupScripts=.*\r?\n?", "", s)
        if SECAO not in s:
            s += "\n" + SECAO + "\n"
        s = s.replace(SECAO, SECAO + "\n+StartupScripts=" + script, 1)
        if rt:
            s = RT_LIMPA.sub("", s)
            for sec, linhas in RT_LINHAS:
                if sec not in s:
                    s += "\n" + sec + "\n"
                s = s.replace(sec, sec + "\n" + "\n".join(linhas), 1)
        io.open(INI, "w", encoding="utf-8-sig", newline="").write(s)

        mata_minha_instancia()
        log = os.path.join(PROJ, "Saved", "Logs", "AssarLuz.log")
        try:
            os.remove(log)
        except OSError:
            pass

        t0 = time.time()
        p = subprocess.Popen([EDITOR, UPROJECT, "-unattended", "-nosplash",
                              "-nopause", "-NoLiveCoding"] + (["-dx12"] if rt else []),
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        while p.poll() is None and time.time() - t0 < limite:
            time.sleep(5)
        if p.poll() is None:
            print("estourou %ds -- encerrando" % limite)
            mata_minha_instancia()
        print("editor rodou %.0fs, saida %s" % (time.time() - t0, p.poll()))

        if os.path.exists(log):
            txt = io.open(log, encoding="utf-8", errors="replace").read()
            # Se `--rt` nao pegar, a falha e MUDA: as fotos saem iguais e o log so diz
            # isso numa linha. Por isso ela sobe pro topo da saida.
            for l in txt.splitlines():
                if "Ray tracing is" in l or "RayTracing is" in l:
                    print("  [RHI] " + l.split("]")[-1].strip())
            linhas = [l for l in txt.splitlines() if marca in l]
            print("--- %s (%d linhas) ---" % (marca, len(linhas)))
            for l in linhas[-60:]:
                print("  " + l.split(marca, 1)[-1].strip())
            if not linhas:
                erros = [l for l in txt.splitlines()
                         if "Error:" in l or "Traceback" in l or "LogPython" in l]
                print("(sem marca) ultimas pistas:")
                for l in erros[-25:]:
                    print("  " + l[-220:])
        else:
            print("sem log em %s" % log)
        return 0
    finally:
        shutil.move(bak, INI)


if __name__ == "__main__":
    sys.exit(main())
