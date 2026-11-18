"""Contrato de leitura. O mock nunca acessa a rede e não implementa envio."""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Protocol


@dataclass(frozen=True)
class Mail:
    key: str
    uid: int
    message_id: str
    sender: str
    recipient: str
    subject: str
    body: str
    received_at: str
    references: tuple[str, ...] = ()
    in_reply_to: str = ""
    attachments: list[dict] = field(default_factory=list)
    thread_key: str = ""
    is_read: bool = False
    direction: str = "inbound"
    headers: dict[str,str] = field(default_factory=dict)


class ReadProvider(Protocol):
    def folders(self) -> list[tuple[str, str]]: ...
    def messages(self, folder: str, cursor: int) -> list[Mail]: ...


class MockProvider:
    validity = "demo-1"

    def folders(self):
        return [(name, self.validity) for name in ("Entrada", "Enviados", "Arquivados", "Spam")]

    def messages(self, folder, cursor):
        result = []
        subjects = ["Valores para apresentação de empreendimento", "Demonstração da planta interativa",
                    "Dúvida sobre acesso pelo navegador", "Planejamento da apresentação comercial"]
        bodies = ["Olá, João. Poderia compartilhar os valores e o escopo da visualização 3D?",
                  "Gostaríamos de agendar uma demonstração. Qual sua disponibilidade?",
                  "A apresentação pode ser acessada pelo navegador do celular?",
                  "Obrigado pelas informações. Vamos avaliar a apresentação com a equipe."]
        for i in range(100):
            target = ("Entrada", "Enviados", "Arquivados", "Spam")[i % 4]
            if target != folder or i + 1 <= cursor:
                continue
            group = i // 4
            parent = f"<demo-{group * 4}@example.invalid>"
            result.append(Mail(
                key=f"demo-{i}", uid=i + 1, message_id=f"<demo-{i}@example.invalid>",
                sender="contact@conectaimoveis3d.com" if target == "Enviados" else f"contato{group}@example.invalid",
                recipient=f"contato{group}@example.invalid" if target == "Enviados" else "contact@conectaimoveis3d.com",
                subject=("Re: " if i % 4 else "") + subjects[group % 4] + f" · Exemplo {group + 1}",
                body="MENSAGEM FICTÍCIA PARA TESTE\n\n" + bodies[group % 4],
                received_at=(datetime(2026, 11, 8, 12, tzinfo=timezone.utc) - timedelta(hours=100-i)).isoformat(),
                references=(parent,) if i % 4 else (), in_reply_to=parent if i % 4 else "",
                attachments=[{"name": "planta-exemplo.pdf", "size": 12345, "available": False}] if i == 0 else [],
                direction="outbound" if target == "Enviados" else "inbound",
            ))
        return result
