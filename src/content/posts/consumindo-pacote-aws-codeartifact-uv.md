---
title: "AWS CodeArtifact: consumindo pacotes Python privados com uv"
description: "Aprenda a instalar pacotes Python privados do AWS
  CodeArtifact com uv em projetos locais, Docker e GitHub Actions
  usando OIDC."
pubDatetime: 2026-10-17T12:00:00.000Z
tags: ["aws", "codeartifact", "python", "uv", "github-actions", "nivel-300"]
---

No post anterior você viu como publicar um pacote Python privado no
**AWS CodeArtifact** usando o **uv** e automatizar o processo com
GitHub Actions. Se ainda não leu, confira o
[post sobre publicação de pacotes no CodeArtifact com uv e GitHub Actions](/posts/publicando-pacote-aws-codeartifact-uv).

Agora o foco é o outro lado: **consumir** o pacote já publicado. Este
post cobre três cenários de instalação: no projeto local durante o
desenvolvimento, dentro de uma imagem Docker, e em pipelines de
GitHub Actions usando autenticação via OIDC.

O post não cobre a criação do repositório, publicação, nem o uso de
repositórios upstream do PyPI público espelhados no CodeArtifact. O
pacote de exemplo é o `meu-pacote` publicado no domínio `meu-dominio`
e repositório `meu-repositorio` do post anterior.

## Pré-requisitos

- Um pacote já publicado no CodeArtifact. Para o passo a passo da
  publicação, veja o
  [post sobre publicação de pacotes no CodeArtifact com uv e GitHub Actions](/posts/publicando-pacote-aws-codeartifact-uv).
- Conta AWS com permissões de leitura no CodeArtifact (política
  detalhada na seção de GitHub Actions).
- AWS CLI instalado e configurado com `aws configure`.
- uv instalado (instruções em
  [docs.astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/)).
- Um projeto Python com `pyproject.toml` onde você quer instalar o
  pacote privado.

> [!NOTE] Região AWS
> Os exemplos usam `us-east-1`. Substitua pela região do seu
> repositório CodeArtifact.

## Passo 1: entender a URL do índice de instalação

A URL de instalação é diferente da URL de publicação. Essa é a
primeira pegadinha ao consumir pacotes do CodeArtifact. A URL de
publicação termina em `/pypi/meu-repositorio/`, enquanto a de
instalação termina em `/pypi/meu-repositorio/simple/`.

O sufixo `/simple/` segue a [PEP 503](https://peps.python.org/pep-0503/),
que define o formato de índice usado pelo pip, uv e outros instaladores
Python. Qualquer ferramenta compatível com o PyPI consome o
CodeArtifact a partir dessa URL.

O formato completo é:

```text
https://<dominio>-<account-id>.d.codeartifact.<regiao>.amazonaws.com/pypi/<repositorio>/simple/
```

Troque `<dominio>`, `<account-id>`, `<regiao>` e `<repositorio>`
pelos valores da sua conta. Essa URL ainda não contém credenciais,
é apenas o endereço do índice.

## Passo 2: obter o token de autenticação

A autenticação no CodeArtifact é feita com um **token temporário**
gerado a partir das suas credenciais AWS. O token vale por até 12
horas e serve tanto para publicar quanto para instalar pacotes.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity \
  --query Account --output text)

CODEARTIFACT_TOKEN=$(aws codeartifact get-authorization-token \
  --domain meu-dominio \
  --domain-owner "$ACCOUNT_ID" \
  --query authorizationToken \
  --output text)
```

> [!WARNING] Permissão sts:GetServiceBearerToken
> Para o comando acima funcionar, o IAM da sua conta precisa da
> permissão `sts:GetServiceBearerToken` junto com
> `codeartifact:GetAuthorizationToken`. Sem ela, o comando falha
> com erro de acesso negado que não é óbvio nas mensagens padrão.

O token é apenas uma string, mas tratá-lo como senha é essencial. Não
o commite em arquivos, não o imprima em logs públicos e prefira
sempre passá-lo via variável de ambiente.

## Passo 3: configurar o uv no projeto local

Com o token em mãos, declare o índice privado no `pyproject.toml` do
projeto que vai consumir o pacote:

```toml
# pyproject.toml
[[tool.uv.index]]
name = "codeartifact"
url = "https://meu-dominio-ACCOUNT_ID.d.codeartifact.us-east-1.amazonaws.com/pypi/meu-repositorio/simple/"
explicit = true
```

Substitua `ACCOUNT_ID` pelo ID real da sua conta. Cada campo:

- **`name`**: identificador do índice, usado para casar com variáveis
  de ambiente de autenticação.
- **`url`**: endereço `/simple/` do repositório privado.
- **`explicit = true`**: faz com que o uv consulte esse índice apenas
  para pacotes marcados explicitamente. Pacotes públicos continuam
  vindo do PyPI, o que acelera a resolução de dependências e evita
  requisições desnecessárias ao CodeArtifact.

Exporte o token nas variáveis de ambiente que o uv reconhece. O
nome das variáveis segue o padrão
`UV_INDEX_<NOME_EM_MAIUSCULAS>_USERNAME` e `_PASSWORD`:

```bash
export UV_INDEX_CODEARTIFACT_USERNAME="aws"
export UV_INDEX_CODEARTIFACT_PASSWORD="$CODEARTIFACT_TOKEN"
```

O nome de usuário é sempre `aws` ao autenticar no CodeArtifact via
protocolo PyPI. Agora adicione o pacote como qualquer outra dependência,
indicando o índice:

```bash
uv add meu-pacote --index codeartifact
```

O uv atualiza o `pyproject.toml` com a dependência vinculada ao índice:

```toml
# pyproject.toml
[project]
dependencies = [
  "meu-pacote",
]

[tool.uv.sources]
meu-pacote = { index = "codeartifact" }
```

<!-- TODO: espaço reservado para print: saída do terminal mostrando o uv add resolvendo o pacote privado a partir do índice codeartifact -->

> [!TIP] Script para renovar o token
> Como o token expira em 12 horas, salve o comando do passo 2 em um
> script shell (ex. `scripts/codeartifact-login.sh`) e rode com
> `source` sempre que começar a trabalhar no projeto. Isso evita
> repetir o passo a passo manual todo dia.

## Passo 4: consumir o pacote em Docker

Quando o `uv sync` ou `uv pip install` roda dentro de um `Dockerfile`,
o token precisa chegar ao build sem acabar persistido no histórico
da imagem. A forma correta é usar **BuildKit secrets**, não `ARG` ou
`ENV`.

Com `ARG`, o valor fica visível em `docker history` e em qualquer
camada que o referencie. Com `--secret`, o Docker expõe o valor como
arquivo apenas durante o passo que o requisita, sem gravar em
nenhuma camada.

```dockerfile
# Dockerfile
# syntax=docker/dockerfile:1.7

FROM python:3.12-slim

RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock ./

RUN --mount=type=secret,id=codeartifact_token,env=UV_INDEX_CODEARTIFACT_PASSWORD \
    UV_INDEX_CODEARTIFACT_USERNAME=aws \
    uv sync --frozen --no-dev

COPY . .

CMD ["uv", "run", "python", "-m", "meu_app"]
```

A opção `--mount=type=secret,id=codeartifact_token,env=...` monta o
valor do secret diretamente na variável de ambiente só pela duração
do `RUN`. O token nunca entra em uma camada da imagem.

Para construir, exporte o token antes e passe para o build:

```bash
export CODEARTIFACT_TOKEN=$(aws codeartifact get-authorization-token \
  --domain meu-dominio \
  --domain-owner "$ACCOUNT_ID" \
  --query authorizationToken \
  --output text)

CODEARTIFACT_TOKEN="$CODEARTIFACT_TOKEN" docker build \
  --secret id=codeartifact_token,env=CODEARTIFACT_TOKEN \
  -t meu-app .
```

<!-- TODO: espaço reservado para print: terminal mostrando o docker build concluído com sucesso usando o secret do CodeArtifact -->

> [!WARNING] Nunca use ARG para o token
> Um `ARG CODEARTIFACT_TOKEN` seguido de `ENV` ou de uso direto grava
> o valor nas camadas da imagem. Qualquer pessoa com acesso ao
> registro (ex. ECR, Docker Hub) extrai o token com
> `docker history --no-trunc`.

## Passo 5: consumir em GitHub Actions com OIDC

Em CI/CD, o fluxo é o mesmo do post de publicação: GitHub emite um
token OIDC, a AWS valida e concede credenciais temporárias para uma
role IAM. A diferença é que a role de consumo precisa apenas de
permissões de leitura, não de escrita, e a condição de confiança
geralmente permite execução em pushes ou pull requests, não só em
tags.

### Role IAM com permissões de leitura

Crie uma política específica para consumo:

```json
# codeartifact-read-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "codeartifact:GetAuthorizationToken",
        "codeartifact:GetRepositoryEndpoint",
        "codeartifact:ReadFromRepository",
        "sts:GetServiceBearerToken"
      ],
      "Resource": "*"
    }
  ]
}
```

A permissão `codeartifact:ReadFromRepository` é a que autoriza o
download dos pacotes. A role de publicação do post anterior usava
`PublishPackageVersion` e `PutPackageMetadata`, que não aparecem aqui.

A política de confiança da role segue o mesmo modelo do post anterior,
mas sem restringir a execução a tags. Para permitir qualquer branch
do repositório:

```json
# trust-policy-read.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub":
            "repo:ORG/REPO:*"
        }
      }
    }
  ]
}
```

Crie a role e anexe a política:

```bash
aws iam create-role \
  --role-name GitHubActions-CodeArtifact-Read \
  --assume-role-policy-document file://trust-policy-read.json

aws iam put-role-policy \
  --role-name GitHubActions-CodeArtifact-Read \
  --policy-name CodeArtifactRead \
  --policy-document file://codeartifact-read-policy.json
```

Adicione o ARN da nova role como secret `AWS_READ_ROLE_ARN` no
repositório (`Settings > Secrets and variables > Actions`).

### Workflow de instalação

Crie `.github/workflows/ci.yml`:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_READ_ROLE_ARN }}
          aws-region: us-east-1

      - name: Get CodeArtifact token
        run: |
          TOKEN=$(aws codeartifact get-authorization-token \
            --domain meu-dominio \
            --domain-owner ${{ secrets.AWS_ACCOUNT_ID }} \
            --query authorizationToken \
            --output text)
          echo "::add-mask::$TOKEN"
          echo "UV_INDEX_CODEARTIFACT_PASSWORD=$TOKEN" >> "$GITHUB_ENV"
          echo "UV_INDEX_CODEARTIFACT_USERNAME=aws" >> "$GITHUB_ENV"

      - name: Install dependencies
        run: uv sync --frozen

      - name: Run tests
        run: uv run pytest
```

Cada parte relevante:

- **`permissions: id-token: write`**: obrigatório para o OIDC. Sem
  essa linha, o `configure-aws-credentials` falha ao tentar assumir
  a role.
- **`::add-mask::$TOKEN`**: instrui o GitHub Actions a mascarar o
  valor em logs, mesmo que algum comando o imprima acidentalmente.
- **`UV_INDEX_CODEARTIFACT_*`**: alimenta o uv com as credenciais do
  índice `codeartifact` declarado no `pyproject.toml`.
- **`uv sync --frozen`**: instala exatamente as versões do `uv.lock`
  sem resolver novamente. Em CI isso garante reprodutibilidade e
  evita surpresas de versão.

<!-- TODO: espaço reservado para print: execução do workflow CI no GitHub Actions com o passo de install dependencies em verde consumindo o pacote privado -->

## Observações importantes

- **Token de 12 horas**: cada execução de workflow pega um token novo,
  então o CI nunca encosta no limite. No desenvolvimento local, use
  o script de login citado no passo 3.
- **Cache do uv em CI**: o `astral-sh/setup-uv@v4` oferece cache
  automático baseado no `uv.lock`. Ao usar índice privado, o cache
  continua funcionando normalmente porque armazena os arquivos
  `.whl` já baixados, não o token.
- **`explicit = true` no índice**: sem essa opção, o uv consulta o
  CodeArtifact para todo pacote, inclusive os do PyPI público. Isso
  deixa a resolução lenta e aumenta o custo de requisições. Mantenha
  o índice privado como `explicit` e vincule apenas os pacotes
  internos via `[tool.uv.sources]`.
- **Resolução de versões específicas**: ao fixar uma versão em
  `dependencies` (ex. `meu-pacote==1.2.3`), o uv consulta o
  CodeArtifact apenas pela versão exigida. Pacotes privados costumam
  ter poucas versões, então vale fixar para evitar listagens
  desnecessárias do índice.
- **Erros 401 e 403 silenciosos**: se o token expirou ou a política
  IAM está incompleta, o uv devolve mensagens genéricas como "package
  not found". Antes de desconfiar da configuração do `pyproject.toml`,
  renove o token e cheque as permissões.

## Recapitulando

Neste post você configurou o uv para instalar um pacote privado
hospedado no AWS CodeArtifact em três cenários: no desenvolvimento
local, dentro de uma imagem Docker usando BuildKit secrets para não
vazar o token, e em pipelines do GitHub Actions com OIDC e uma role
IAM de somente leitura. Agora o ciclo está completo: você publica
com uma role de escrita restrita a tags Git e consome com uma role
de leitura em qualquer branch, sempre com credenciais temporárias e
sem chaves de acesso de longa duração armazenadas como secret.
