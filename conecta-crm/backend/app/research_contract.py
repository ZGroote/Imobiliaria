"""Contrato de dados de pesquisa; não executa nem busca conteúdo de URLs."""
import ipaddress
import re
from datetime import date
from typing import Annotated, Literal
from urllib.parse import urlsplit, urlunsplit

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator

STATES = dict(zip('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(),
    ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming']))
State = Annotated[str,Field(pattern='^('+'|'.join(STATES)+')$')]
Name = Annotated[str,Field(min_length=1,max_length=240)]
ShortText = Annotated[str,Field(max_length=1000)]


def public_url(value):
    try:
        if any(ord(char)<33 for char in value) or '\\' in value:
            raise ValueError()
        url = urlsplit(value)
        host = (url.hostname or '').encode('idna').decode('ascii').lower().rstrip('.')
        if url.scheme!='https' or url.username or url.password or url.port not in (None,443) or '.' not in host:
            raise ValueError()
        if len(host)>253 or any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?',part) for part in host.split('.')):
            raise ValueError()
        if any(host==suffix or host.endswith('.'+suffix) for suffix in ('localhost','local','internal','test','invalid','example','example.com','example.org','example.net')):
            raise ValueError()
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            raise ValueError()
        if host.split('.')[-1].isdigit():
            raise ValueError()
        return urlunsplit(('https',host,url.path or '/',url.query,url.fragment))
    except (ValueError,UnicodeError):
        raise ValueError('Informe uma URL pública HTTPS, sem credenciais ou domínios de exemplo.') from None


PublicURL = Annotated[str,Field(min_length=8,max_length=2000,json_schema_extra={'format':'uri'}),AfterValidator(public_url)]


def company_domain(website):
    return urlsplit(website).hostname.removeprefix('www.')


class Data(BaseModel):
    model_config = ConfigDict(extra='forbid',str_strip_whitespace=True,allow_inf_nan=False)


class Source(Data):
    source_url: PublicURL
    source_title: Name
    observed_at: AwareDatetime
    confidence: float = Field(ge=0,le=1)


class Evidence(Source):
    claim: Annotated[str,Field(min_length=1,max_length=1000)]
    document_date: date | None = None


class Project(Source):
    name: Name
    address: ShortText = ''
    city: Name
    state: State
    building_type: Literal['apartments','multifamily','condominium','single_family','unknown']
    stage: Literal['under_review','approved','under_construction','completed_active_sales','unknown']
    stage_as_of: date | None = None


class Contact(Source):
    name: Name
    role: ShortText = ''
    email: Annotated[str,Field(max_length=254)]

    @field_validator('email')
    @classmethod
    def email_address(cls,value):
        from .classification import normalize_address
        normalized = normalize_address(value)
        if not normalized or not re.fullmatch(r'[^@\s<>,;]+@[^@\s<>,;]+',value):
            raise ValueError('Use um único endereço profissional publicado na fonte.')
        return normalized


class Company(Data):
    name: Name
    website: PublicURL
    company_type: Literal['developer','integrated_developer_builder','general_contractor','broker','unknown']
    size_tier: Literal['small_medium','large','unknown']
    states_active: list[State] = Field(min_length=1,max_length=50)
    projects: list[Project] = Field(max_length=20)
    contacts: list[Contact] = Field(max_length=20)
    evidence: list[Evidence] = Field(min_length=1,max_length=30)
    status: Literal['unverified'] = 'unverified'

    @field_validator('states_active')
    @classmethod
    def unique_states(cls,value):
        if len(value)!=len(set(value)):
            raise ValueError('Estados repetidos.')
        return value


class ResearchResult(Data):
    job_id: Annotated[str,Field(pattern=r'^[a-f0-9]{32}$')]
    market: Literal['US']
    state: State
    target_count: int = Field(ge=1,le=50,strict=True)
    generated_at: AwareDatetime
    companies: list[Company] = Field(max_length=50)
    warnings: list[Annotated[str,Field(max_length=500)]] = Field(max_length=20)

    @model_validator(mode='after')
    def scope(self):
        domains = [company_domain(company.website) for company in self.companies]
        if len(domains)!=len(set(domains)) or len(domains)>self.target_count:
            raise ValueError('Empresas repetidas ou acima da meta.')
        if any(self.state not in company.states_active for company in self.companies):
            raise ValueError('A atuação no estado pesquisado precisa estar declarada.')
        if any(project.state not in company.states_active for company in self.companies for project in company.projects):
            raise ValueError('O estado do projeto não consta na atuação da empresa.')
        return self
