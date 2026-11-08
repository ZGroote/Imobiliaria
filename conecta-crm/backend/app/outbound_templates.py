import re

from fastapi import HTTPException

from .branding_api import TEMPLATES, catalog


def templates():
    result = []
    for profile,template in TEMPLATES.items():
        result.append(dict(id="cold_intro_minimal",profile_id=profile,purpose="outreach",title="Primeiro contato",**template))
        result.append(dict(id="reply",profile_id=profile,purpose="reply",title="Resposta à conversa",locale=template["locale"],website=template["website"],
            subject="Re: {{original_subject}}",body=("Olá,\n\n{{reply_text}}\n\n{{sender_name}}\nConecta Imóveis 3D\n" if profile=="BR" else "Hello,\n\n{{reply_text}}\n\n{{sender_name}}\nConecta Imóveis 3D\n")+template["website"]))
    originals = {e["commercial_stage"]:e["id"] for e in catalog()}
    result.extend([
        dict(id="final_delivery",profile_id="BR",purpose="delivery",title="Entrega final do projeto",locale="pt-BR",website=TEMPLATES["BR"]["website"],source_asset_id=originals["delivery"],
             subject="Entrega do Projeto | {{project_name}} — Conecta Imóveis 3D",
             body="Olá, {{contact_name}}!\n\nConcluímos o desenvolvimento da solução contratada para {{project_name}}. Seguem as informações de acesso:\n\nProjeto: {{project_name}}\nSolução: {{solution_name}}\nAcesso: {{project_url}}\n\nPeço que confira o material e confirme o recebimento.\n\nObrigado pela confiança e pela parceria durante o desenvolvimento.\n\nAtenciosamente,\n{{sender_name}}\nConecta Imóveis 3D\nhttps://conectaimoveis3d.com.br"),
        dict(id="after_sale",profile_id="BR",purpose="after_sale",title="Pós-venda e feedback",locale="pt-BR",website=TEMPLATES["BR"]["website"],source_asset_id=originals["after_sale"],
             subject="Como está sendo sua experiência? | Conecta Imóveis 3D",
             body="Olá, {{contact_name}}!\n\nEstou entrando em contato para acompanhar a experiência de vocês com {{project_name}}, desenvolvido pela Conecta Imóveis 3D.\n\nA solução está atendendo às expectativas? Existe alguma observação ou sugestão de melhoria que gostariam de compartilhar?\n\nAgradeço novamente pela confiança e pela parceria.\n\nAtenciosamente,\n{{sender_name}}\nConecta Imóveis 3D\nhttps://conectaimoveis3d.com.br"),
    ])
    for template in result:
        template["required_fields"] = sorted(set(re.findall(r"\{\{(\w+)\}\}",template["subject"]+template["body"])))
        template["status"] = "pending_review"
        template["send_enabled"] = False
    return result


def render(template_id, profile_id, values):
    template = next((t for t in templates() if t["id"]==template_id and t["profile_id"]==profile_id),None)
    if not template:
        raise HTTPException(404,"Modelo não disponível para este perfil.")
    if set(values)-set(template["required_fields"]) or any(len(v)>3000 for v in values.values()):
        raise HTTPException(422,"Campos de modelo inválidos.")
    def replace(match):
        return values.get(match.group(1),"").strip() or match.group(0)
    return dict(subject=re.sub(r"\{\{(\w+)\}\}",replace,template["subject"]),body_text=re.sub(r"\{\{(\w+)\}\}",replace,template["body"]),
                purpose=template["purpose"],profile_id=profile_id,metadata=dict(postal_address=values.get("postal_address",""),project_completed=False,delivery_confirmed=False),send_enabled=False)
