---
title: "AWS CodeArtifact: publicando pacotes Python com uv e GitHub Actions"
description: "Aprenda a criar um repositório no AWS CodeArtifact, publicar
  pacotes Python com uv manualmente e automatizar todo o processo com
  GitHub Actions."
pubDatetime: 2026-09-08T12:00:00.000Z
tags: ["aws", "codeartifact", "python", "uv", "github-actions", "nivel-300"]
---

O **AWS CodeArtifact** é o serviço gerenciado de repositório de artefatos
da AWS. Com ele você hospeda pacotes Python (e de outras linguagens)
de forma privada dentro da sua conta, com controle de acesso via IAM
e integração nativa com o ecossistema AWS.

Este post cobre o ciclo completo: criar um domínio e um repositório no
CodeArtifact, publicar um pacote Python manualmente usando o **uv**, e
depois automatizar todo o processo com **GitHub Actions** via OIDC.

O post não cobre repositórios upstream (espelhar o PyPI público no
CodeArtifact), políticas de aprovação de pacotes ou acesso entre
contas AWS.

## Quanto custa manter isso no ar

O CodeArtifact cobra por armazenamento e por requisições, sem cobrança
por hora de execução:

| Recurso | Preço |
| --- | --- |
| Armazenamento | \$0,05 por GB/mês |
| Requisições | \$0,05 por 10.000 requisições |

Para pacotes internos de times pequenos, o custo mensal costuma ficar
na faixa de poucos centavos. Consulte a
[página de preços do CodeArtifact](https://aws.amazon.com/codeartifact/pricing/)
para os valores oficiais da AWS em setembro de 2026.

> [!TIP] Camada gratuita
> A AWS oferece 2 GB de armazenamento e 100.000 requisições por mês
> durante os primeiros 12 meses em novas contas.

## Pré-requisitos

- Conta AWS com permissões de administrador (ou política IAM específica
  para CodeArtifact)
- AWS CLI instalado e configurado com `aws configure`
- uv instalado (instruções em
  [docs.astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/))
- Um projeto Python com `pyproject.toml` configurado com `[build-system]`
  e os metadados do pacote em `[project]`

> [!NOTE] Região AWS
> Os exemplos usam `us-east-1`. Substitua pela região que você usa
> no seu projeto.

## Publicação manual

### Passo 1: criar o domínio e o repositório

O CodeArtifact organiza repositórios dentro de **domínios**. Um domínio
agrupa vários repositórios e centraliza o controle de acesso via IAM.
Crie o domínio primeiro:

```bash
aws codeartifact create-domain --domain meu-dominio
```

Agora crie o repositório dentro do domínio. O `--domain-owner` é
o ID numérico de 12 dígitos da sua conta AWS:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity \
  --query Account --output text)

aws codeartifact create-repository \
  --domain meu-dominio \
  --domain-owner "$ACCOUNT_ID" \
  --repository meu-repositorio \
  --description "Pacotes Python privados"
```

<!-- TODO: espaço reservado para print: console AWS mostrando o repositório recém-criado no CodeArtifact com status ativo -->

### Passo 2: obter o token de autenticação

O CodeArtifact não usa usuário e senha fixos. A autenticação é feita
com um token temporário gerado a partir das suas credenciais AWS. Por
padrão, o token é válido por 12 horas.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity \
  --query Account --output text)

CODEARTIFACT_TOKEN=$(aws codeartifact get-authorization-token \
  --domain meu-dominio \
  --domain-owner "$ACCOUNT_ID" \
  --query authorizationToken \
  --output text)
```

Configure as variáveis de ambiente que o uv usa na publicação:

```bash
export UV_PUBLISH_URL="https://meu-dominio-${ACCOUNT_ID}.d.codeartifact\
.us-east-1.amazonaws.com/pypi/meu-repositorio/"
export UV_PUBLISH_USERNAME="aws"
export UV_PUBLISH_PASSWORD="$CODEARTIFACT_TOKEN"
```

O nome de usuário é sempre `aws` ao autenticar no CodeArtifact via
protocolo PyPI.

### Passo 3: empacotar o projeto

Com o `pyproject.toml` configurado, execute:

```bash
uv build
```

O uv cria a pasta `dist/` com o arquivo `.whl` (wheel) e o `.tar.gz`
(sdist). O wheel é o formato preferido para instalação; o sdist é
exigido por alguns índices para publicação completa.

<!-- TODO: espaço reservado para print: saída do terminal após uv build listando os arquivos gerados em dist/ -->

> [!TIP] Validar antes de publicar
> Execute `uvx twine check dist/*` para validar os metadados do
> pacote antes de fazer o upload.

### Passo 4: publicar no repositório

Com as variáveis de ambiente definidas no passo anterior:

```bash
uv publish
```

O uv lê `UV_PUBLISH_URL`, `UV_PUBLISH_USERNAME` e `UV_PUBLISH_PASSWORD`
automaticamente e faz o upload dos arquivos em `dist/`.

<!-- TODO: espaço reservado para print: saída do terminal confirmando o upload bem-sucedido com o nome e versão do pacote -->

### Passo 5: instalar o pacote do repositório privado

Para instalar um pacote hospedado no repositório privado, o uv precisa
do token de autenticação embutido na URL do índice. A URL de instalação
usa o caminho `/simple/` (diferente da URL de publicação):

```bash
INDEX_URL="https://aws:${CODEARTIFACT_TOKEN}@meu-dominio-${ACCOUNT_ID}\
.d.codeartifact.us-east-1.amazonaws.com/pypi/meu-repositorio/simple/"

uv pip install meu-pacote --index-url "$INDEX_URL"
```

Para não precisar passar a URL manualmente em todo projeto, declare o
índice no `uv.toml` (ou em `pyproject.toml`, na seção `[tool.uv]`):

```toml
# uv.toml
[[index]]
name = "codeartifact"
url = "https://meu-dominio-ACCOUNT_ID.d.codeartifact.us-east-1.amazonaws.com/pypi/meu-repositorio/simple/"
```

Substitua `ACCOUNT_ID` pelo valor real. O token de autenticação ainda
precisa ser exportado via variável de ambiente:

```bash
export UV_INDEX_CODEARTIFACT_USERNAME="aws"
export UV_INDEX_CODEARTIFACT_PASSWORD="$CODEARTIFACT_TOKEN"
```

O uv mapeia as variáveis pelo nome do índice em maiúsculas
(`CODEARTIFACT` vem de `name = "codeartifact"`).

---

## Automatizando com GitHub Actions

A publicação manual funciona, mas exige renovar o token a cada 12 horas,
o que inviabiliza o uso em pipelines de CI/CD. A solução é usar o
**OpenID Connect (OIDC)** para que o GitHub Actions assuma uma **role
IAM** diretamente, sem credenciais de longa duração armazenadas como
secrets.

O fluxo é: o GitHub emite um token OIDC assinado para a execução do
workflow; a AWS valida esse token e concede credenciais temporárias
para a role configurada. Nenhuma chave de acesso AWS (access key)
é necessária.

### Passo 6: registrar o provedor de identidade do GitHub

Registre o provedor OIDC do GitHub na sua conta AWS (faça isso uma
vez por conta):

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

> [!NOTE] Verificar se o provedor já existe
> Acesse IAM > Identity providers no console AWS antes de criar.
> Se já existir, pule este passo. A AWS também aceita a criação via
> console com preenchimento automático do thumbprint.

### Passo 7: criar a role IAM

Crie o arquivo de política de confiança. Substitua `ORG` pelo seu
usuário ou organização do GitHub e `REPO` pelo nome do repositório:

```json
# trust-policy.json
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
            "repo:ORG/REPO:ref:refs/tags/*"
        }
      }
    }
  ]
}
```

A condição `ref:refs/tags/*` restringe o acesso à role a execuções
disparadas por uma tag Git. Isso evita que qualquer branch possa
publicar pacotes.

Crie a role:

```bash
aws iam create-role \
  --role-name GitHubActions-CodeArtifact \
  --assume-role-policy-document file://trust-policy.json
```

Agora crie e anexe a política de permissões:

```json
# codeartifact-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "codeartifact:GetAuthorizationToken",
        "codeartifact:GetRepositoryEndpoint",
        "codeartifact:PublishPackageVersion",
        "codeartifact:PutPackageMetadata",
        "sts:GetServiceBearerToken"
      ],
      "Resource": "*"
    }
  ]
}
```

```bash
aws iam put-role-policy \
  --role-name GitHubActions-CodeArtifact \
  --policy-name CodeArtifactPublish \
  --policy-document file://codeartifact-policy.json
```

> [!WARNING] sts:GetServiceBearerToken é obrigatória
> Sem essa permissão, o `aws codeartifact get-authorization-token`
> falha com erro de acesso negado, mesmo que todas as permissões
> de CodeArtifact estejam corretas. Ela não é óbvia nas mensagens
> de erro padrão.

### Passo 8: configurar os secrets no GitHub

Acesse **Settings > Secrets and variables > Actions** no repositório
e crie dois secrets:

| Secret | Valor |
| --- | --- |
| `AWS_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/GitHubActions-CodeArtifact` |
| `AWS_ACCOUNT_ID` | ID de 12 dígitos da sua conta AWS |

<!-- TODO: espaço reservado para print: tela de Secrets do GitHub com os dois secrets configurados -->

### Passo 9: criar o workflow

Crie o arquivo `.github/workflows/publish.yml` no repositório:

```yaml
# .github/workflows/publish.yml
name: Publish to CodeArtifact

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
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
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Get CodeArtifact token
        run: |
          TOKEN=$(aws codeartifact get-authorization-token \
            --domain meu-dominio \
            --domain-owner ${{ secrets.AWS_ACCOUNT_ID }} \
            --query authorizationToken \
            --output text)
          echo "CODEARTIFACT_TOKEN=$TOKEN" >> "$GITHUB_ENV"

      - name: Build and publish
        env:
          UV_PUBLISH_URL: >-
            https://meu-dominio-${{ secrets.AWS_ACCOUNT_ID }}.d.codeartifact.us-east-1.amazonaws.com/pypi/meu-repositorio/
          UV_PUBLISH_USERNAME: aws
          UV_PUBLISH_PASSWORD: ${{ env.CODEARTIFACT_TOKEN }}
        run: |
          uv build
          uv publish
```

Cada parte do workflow:

- **`on: push: tags: - "v*"`**: o workflow só dispara ao criar uma tag
  com prefixo `v` (ex. `v1.0.0`, `v2.1.3`).
- **`permissions: id-token: write`**: obrigatório para o OIDC funcionar.
  Sem essa permissão, o passo de configuração das credenciais AWS falha.
- **`astral-sh/setup-uv@v4`**: instala o uv no runner do GitHub Actions.
- **`aws-actions/configure-aws-credentials@v4`**: assume a role IAM via
  OIDC e configura as credenciais temporárias no ambiente da execução.
- **Get CodeArtifact token**: obtém o token de autenticação e o expõe
  como variável de ambiente para o passo seguinte via `$GITHUB_ENV`.
- **`uv build && uv publish`**: empacota e publica. O uv lê as
  variáveis `UV_PUBLISH_*` configuradas no bloco `env`.

<!-- TODO: espaço reservado para print: execução bem-sucedida do workflow no GitHub Actions com todos os steps em verde -->

Para publicar uma nova versão, crie e envie a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Observações importantes

- **Token expira em 12 horas**: o token manual vale por 12 horas. Para
  uso local contínuo você precisa renovar com o comando do passo 2.
  O workflow do GitHub Actions obtém um token novo a cada execução,
  então não há esse problema em CI/CD.
- **URLs diferentes para publicar e instalar**: a URL de publicação
  termina em `/pypi/meu-repositorio/` (sem `/simple/`). A URL de
  instalação precisa de `/simple/` no final. Confundir as duas gera
  erros de autenticação ou de "pacote não encontrado".
- **`sts:GetServiceBearerToken` esquecida**: é a permissão IAM que
  mais causa confusão. O CodeArtifact precisa dela internamente para
  emitir o token, e ela não aparece de forma clara nas mensagens de
  erro. Inclua sempre na política.
- **Limpeza de recursos de teste**: o CodeArtifact cobra por
  armazenamento. Se criar domínio ou repositório apenas para testes,
  delete depois:
  ```bash
  aws codeartifact delete-repository \
    --domain meu-dominio \
    --domain-owner "$ACCOUNT_ID" \
    --repository meu-repositorio

  aws codeartifact delete-domain \
    --domain meu-dominio \
    --domain-owner "$ACCOUNT_ID"
  ```

## Recapitulando

Neste post você criou um domínio e um repositório no AWS CodeArtifact,
publicou um pacote Python com o uv usando autenticação via token
temporário, e automatizou o ciclo completo com GitHub Actions usando
OIDC para assumir uma role IAM sem credenciais de longa duração. O
próximo passo natural é consumir o pacote privado em outros projetos
da sua conta. Para funções serverless, veja o
[post sobre AWS Lambda: introdução ao serverless na prática](/posts/aws-lambda-introducao),
que cobre como estruturar e fazer deploy de uma função Lambda.
