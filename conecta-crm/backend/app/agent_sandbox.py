"""Sonda MXC com dados fictícios; nunca lê uma credencial real do CRM."""
import ctypes
import json
import os
import shutil
import socket
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

from .windows_store import CREDENTIAL, credential_api


class AgentError(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def executable():
    path = Path(shutil.which('codex') or '')
    program_files = Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'WindowsApps'
    if (os.name != 'nt' or not path.is_file() or path.name.lower() != 'codex.exe'
            or not path.resolve().is_relative_to(program_files.resolve())
            or not any(p.startswith('OpenAI.Codex_') for p in path.parts)):
        raise AgentError('codex_installation_unavailable')
    return path.resolve()


def environment(work):
    # Authentication is handled by the trusted CLI; no provider key/proxy is inherited.
    allowed = ('SystemRoot', 'SystemDrive', 'WINDIR', 'COMSPEC', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA',
               'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData')
    result = {key: os.environ[key] for key in allowed if key in os.environ}
    result['PATH'] = os.path.join(result.get('SystemRoot', 'C:/Windows'), 'System32')
    temporary = work / 'tmp'
    temporary.mkdir(exist_ok=True)
    result.update(TEMP=str(temporary), TMP=str(temporary), PYTHONNOUSERSITE='1')
    return result


def permission_profile(runtime=None):
    filesystem = '":minimal"="read",":workspace_roots"="read"'
    if runtime:
        filesystem += ',' + json.dumps(Path(runtime).as_posix()) + '="read"'
    return 'permissions.crm_research={filesystem={' + filesystem + '},network={enabled=false}}'


PROBE = '''import sys,json,socket,ctypes
from pathlib import Path
def readable(path):
    try: Path(path).read_bytes(); return True
    except OSError: return False
try:
    s=socket.create_connection(('127.0.0.1',int(sys.argv[3])),timeout=2);s.close();network=True
except OSError: network=False
api=ctypes.WinDLL('Advapi32.dll',use_last_error=True);pointer=ctypes.c_void_p()
api.CredReadW.argtypes=[ctypes.c_wchar_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.POINTER(ctypes.c_void_p)]
credential=bool(api.CredReadW(sys.argv[4],1,0,ctypes.byref(pointer)))
if credential: api.CredFree(pointer)
print(json.dumps(dict(task_readable=readable(sys.argv[1]),outside_readable=readable(sys.argv[2]),local_network=network,credential_readable=credential)))
'''


def doctor(root):
    cli = executable()
    root.mkdir(parents=True, exist_ok=True)
    probe_root = root / ('probe-' + uuid4().hex)
    work = probe_root / 'task'
    work.mkdir(parents=True)
    (work / 'input.txt').write_text('FICTITIOUS_INPUT', encoding='utf-8')
    (work / 'probe.py').write_text(PROBE, encoding='utf-8')
    (probe_root / 'outside.txt').write_text('FICTITIOUS_CANARY', encoding='utf-8')
    target = 'ConectaCRM/IsolationProbe/' + uuid4().hex
    api = credential_api()
    blob = b'FICTITIOUS_CREDENTIAL'
    buffer = (ctypes.c_ubyte * len(blob)).from_buffer_copy(blob)
    credential = CREDENTIAL(Type=1, TargetName=target, CredentialBlobSize=len(blob),
                            CredentialBlob=buffer, Persist=1, UserName='isolation-probe')
    if not api.CredWriteW(ctypes.byref(credential), 0):
        raise AgentError('isolation_probe_unavailable')
    listener = socket.socket()
    try:
        listener.bind(('127.0.0.1', 0))
        listener.listen(1)
        runtime = Path(sys.base_prefix)
        args = [str(cli), '-c', 'windows.sandbox="mxc"', '-c', permission_profile(runtime),
                'sandbox', '--permission-profile', 'crm_research', '-C', str(work.resolve()), '--',
                str(runtime / 'python.exe'), '-I', str((work / 'probe.py').resolve()),
                str((work / 'input.txt').resolve()), str((probe_root / 'outside.txt').resolve()),
                str(listener.getsockname()[1]), target]
        result = subprocess.run(args, capture_output=True, timeout=30, env=environment(work),
                                creationflags=subprocess.CREATE_NO_WINDOW)
        expected = dict(task_readable=True, outside_readable=False, local_network=False, credential_readable=False)
        if result.returncode != 0 or len(result.stdout) > 4096 or json.loads(result.stdout) != expected:
            raise AgentError('isolation_not_verified')
        return dict(available=True, isolation='windows_mxc', checks=expected)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        raise AgentError('isolation_not_verified') from None
    finally:
        listener.close()
        api.CredDeleteW.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32]
        if not api.CredDeleteW(target, 1, 0):
            raise AgentError('isolation_probe_cleanup_failed')
