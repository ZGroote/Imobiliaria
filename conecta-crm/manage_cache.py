"""Backup criptografado e restauração lado a lado; não substitui o cache ativo."""
import argparse

from backend.app.windows_store import CredentialError, default_cache, encrypted_backup, restore_copy

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action",choices=["backup","restore-copy"])
    parser.add_argument("filename",nargs="?")
    args = parser.parse_args()
    try:
        if args.action == "backup":
            print("Backup salvo:",encrypted_backup(default_cache()))
        elif not args.filename:
            parser.error("Informe o nome do arquivo .dpapi na pasta de backups.")
        else:
            print("Cópia restaurada e verificada:",restore_copy(default_cache(),args.filename))
    except (CredentialError,OSError):
        parser.exit(1,"Não foi possível processar o backup. Confira arquivo, usuário Windows e permissões.\n")
