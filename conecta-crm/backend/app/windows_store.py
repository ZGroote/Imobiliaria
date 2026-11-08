"""Credenciais e backups vinculados ao usuário Windows; nunca usar arquivos .env."""
import ctypes
import os
import sqlite3
import tempfile
from contextlib import closing
from ctypes import wintypes
from pathlib import Path
from uuid import uuid4


class CredentialError(Exception):
    pass


class CREDENTIAL(ctypes.Structure):
    _fields_ = [("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
                ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
                ("LastWritten", wintypes.FILETIME), ("CredentialBlobSize", wintypes.DWORD),
                ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)), ("Persist", wintypes.DWORD),
                ("AttributeCount", wintypes.DWORD), ("Attributes", ctypes.c_void_p),
                ("TargetAlias", wintypes.LPWSTR), ("UserName", wintypes.LPWSTR)]


def credential_api():
    if os.name != "nt":
        raise CredentialError("O armazenamento seguro desta versão exige Windows.")
    api = ctypes.WinDLL("Advapi32.dll", use_last_error=True)
    api.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.POINTER(CREDENTIAL))]
    api.CredReadW.restype = wintypes.BOOL
    api.CredWriteW.argtypes = [ctypes.POINTER(CREDENTIAL), wintypes.DWORD]
    api.CredWriteW.restype = wintypes.BOOL
    api.CredFree.argtypes = [ctypes.c_void_p]
    return api


class WindowsCredentials:
    @staticmethod
    def target(account):
        if account not in ("contact", "team"):
            raise CredentialError("Caixa não habilitada para leitura.")
        return f"ConectaCRM/Resend/{account}"

    def get(self, account):
        api = credential_api()
        pointer = ctypes.POINTER(CREDENTIAL)()
        if not api.CredReadW(self.target(account), 1, 0, ctypes.byref(pointer)):
            if ctypes.get_last_error() == 1168:
                return None
            raise CredentialError("Não foi possível acessar o Gerenciador de Credenciais.")
        try:
            return ctypes.string_at(pointer.contents.CredentialBlob, pointer.contents.CredentialBlobSize).decode("utf-8")
        finally:
            api.CredFree(pointer)

    def put(self, account, secret):
        api = credential_api()
        blob = secret.encode("utf-8")
        buffer = (ctypes.c_ubyte * len(blob)).from_buffer_copy(blob)
        credential = CREDENTIAL(Type=1, TargetName=self.target(account), CredentialBlobSize=len(blob),
                                CredentialBlob=buffer, Persist=2, UserName=account)
        if not api.CredWriteW(ctypes.byref(credential), 0):
            raise CredentialError("Não foi possível salvar no Gerenciador de Credenciais.")


def default_cache():
    if os.name != "nt" or not os.environ.get("LOCALAPPDATA"):
        raise CredentialError("Configure o cache local em um usuário Windows.")
    return Path(os.environ["LOCALAPPDATA"]) / "ConectaCRM" / "cache.sqlite3"


class BLOB(ctypes.Structure):
    _fields_ = [("size",wintypes.DWORD),("data",ctypes.POINTER(ctypes.c_ubyte))]


def protect(data, decrypt=False):
    if os.name != "nt":
        raise CredentialError("A criptografia de backup exige Windows.")
    buffer = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    incoming, outgoing = BLOB(len(data),buffer), BLOB()
    crypt = ctypes.WinDLL("Crypt32.dll",use_last_error=True)
    kernel = ctypes.WinDLL("Kernel32.dll",use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if decrypt:
        function = crypt.CryptUnprotectData
        function.argtypes = [ctypes.POINTER(BLOB),ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(BLOB)]
    else:
        function = crypt.CryptProtectData
        function.argtypes = [ctypes.POINTER(BLOB),wintypes.LPCWSTR,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(BLOB)]
    function.restype = wintypes.BOOL
    if not function(ctypes.byref(incoming),None,None,None,None,1,ctypes.byref(outgoing)):
        raise CredentialError("O Windows não conseguiu processar o backup para este usuário.")
    try:
        return ctypes.string_at(outgoing.data,outgoing.size)
    finally:
        kernel.LocalFree(outgoing.data)


def encrypted_backup(database_path):
    directory = database_path.parent / "backups"
    directory.mkdir(parents=True,exist_ok=True)
    descriptor, name = tempfile.mkstemp(dir=directory,suffix=".sqlite3")
    os.close(descriptor)
    temporary = Path(name)
    try:
        with closing(sqlite3.connect(database_path)) as source, closing(sqlite3.connect(temporary)) as target:
            source.backup(target)
        encrypted = protect(temporary.read_bytes())
        output = directory / f"cache-{uuid4().hex}.dpapi"
        with output.open("xb") as stream:
            stream.write(encrypted)
        return output.name
    finally:
        temporary.unlink(missing_ok=True)


def restore_copy(database_path, filename):
    # Restaura lado a lado; nunca troca o banco de um servidor em execução.
    directory = (database_path.parent / "backups").resolve()
    source = (directory / filename).resolve()
    if source.parent != directory or source.suffix != ".dpapi" or source.stat().st_size > 256_000_000:
        raise CredentialError("Arquivo de backup inválido.")
    restored = protect(source.read_bytes(),decrypt=True)
    output = directory / f"restaurado-{uuid4().hex}.sqlite3"
    try:
        with output.open("xb") as stream:
            stream.write(restored)
        with closing(sqlite3.connect(output)) as connection:
            if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise CredentialError("O backup não passou na verificação de integridade.")
        return output
    except Exception:
        output.unlink(missing_ok=True)
        raise
