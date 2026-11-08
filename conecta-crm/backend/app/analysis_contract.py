"""Dados do operador e saída de agente são entradas não confiáveis."""
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Hash = Annotated[str, Field(pattern=r'^[a-f0-9]{64}$')]
LocalID = Annotated[str, Field(pattern=r'^[a-f0-9]{32}$')]
Agent = Literal['codex_assisted', 'claude_assisted']


class Data(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, allow_inf_nan=False)

    @field_validator('*')
    @classmethod
    def valid_unicode(cls, value):
        for item in value if isinstance(value, list) else [value]:
            if isinstance(item, str):
                try:
                    item.encode('utf-8')
                except UnicodeError:
                    raise ValueError('Texto contém caracteres Unicode inválidos.') from None
        return value


class Excerpt(Data):
    message_id: LocalID
    text: str = Field(min_length=1, max_length=4000)


class PrepareAnalysis(Data):
    account_id: Literal['demo', 'contact', 'team']
    thread_id: LocalID
    request_id: UUID
    source_hash: Hash
    agent: Agent
    excerpts: list[Excerpt] = Field(min_length=1, max_length=5)
    excerpts_reviewed: Literal[True]

    @model_validator(mode='after')
    def unique(self):
        if len({e.message_id for e in self.excerpts}) != len(self.excerpts):
            raise ValueError('Selecione cada mensagem uma única vez.')
        return self


class Evidence(Data):
    message: str = Field(pattern=r'^m[1-5]$')
    quote: str = Field(min_length=1, max_length=500)


class Claim(Data):
    text: str = Field(min_length=1, max_length=600)
    evidence: list[Evidence] = Field(min_length=1, max_length=5)


class Suggestion(Data):
    category: Literal['pricing_request', 'demo_request', 'technical_question', 'positive_interest',
                      'not_interested', 'unsubscribe', 'automatic_reply', 'other']
    confidence: float = Field(ge=0, le=1, strict=True)
    reason: str = Field(min_length=1, max_length=600)
    evidence: list[Evidence] = Field(min_length=1, max_length=5)


class AnalysisResult(Data):
    analysis_id: UUID
    input_hash: Hash
    agent: Agent
    model: str = Field(min_length=1, max_length=120)
    summary: list[Claim] = Field(max_length=6)
    suggestion: Suggestion
    warnings: list[Annotated[str, Field(min_length=1, max_length=500)]] = Field(max_length=8)
    auto_send_allowed: Literal[False]


class ImportAnalysis(Data):
    account_id: Literal['demo', 'contact', 'team']
    result: AnalysisResult
