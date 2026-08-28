---
title: "LocalStack: teste serviços AWS no seu computador sem gastar nada"
description: "Aprenda a usar o LocalStack para simular serviços AWS
localmente com Docker, economizando em testes e acelerando o ciclo de
desenvolvimento."
pubDatetime: 2026-08-28T12:00:00.000Z
tags: ["localstack", "aws", "docker", "s3", "lambda", "dynamodb", "nivel-200"]
---

O **LocalStack** é uma ferramenta de código aberto que emula os
principais serviços da AWS diretamente no seu computador. Com ele,
você pode criar buckets S3, funções Lambda, tabelas DynamoDB e muito
mais, sem criar nada na AWS de verdade e, consequentemente, sem gastar
nenhum centavo.

Este post mostra como instalar o LocalStack via Docker, configurar o
AWS CLI para apontar para ele e executar comandos reais nos serviços
mais comuns. O foco é o ciclo de desenvolvimento local: você vai sair
daqui sabendo como testar código que usa a AWS sem depender de
credenciais de produção.

> [!NOTE] O que o LocalStack não faz
> O LocalStack simula o comportamento dos serviços, mas não é 100%
> fiel em todos os casos. Recursos avançados como IAM granular, VPC
> complexa e serviços de ML têm suporte parcial ou estão disponíveis
> apenas na versão Pro paga.

## Pré-requisitos

- Docker instalado e em execução na sua máquina
- AWS CLI instalado e disponível no terminal
- Python 3.10 ou mais recente (para os exemplos com boto3)
- Familiaridade básica com pelo menos um serviço da AWS

## Instalando e iniciando o LocalStack

A forma mais simples de rodar o LocalStack é com o Docker Compose.
Crie um arquivo na raiz do seu projeto:

```yaml
# docker-compose.yml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,lambda,dynamodb
      - DEBUG=1
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
```

A variável `SERVICES` define quais serviços vão subir. Listar só o
necessário é mais rápido do que inicializar tudo.

Suba o contêiner:

```bash
docker compose up -d
```

<!-- TODO: espaço reservado para print: terminal mostrando o LocalStack inicializando com os serviços s3, lambda e dynamodb prontos -->

Para confirmar que está no ar, rode:

```bash
curl http://localhost:4566/_localstack/health
```

A resposta vai mostrar cada serviço e seu status. Quando aparecer
`"running"` para os serviços configurados, o LocalStack está pronto.

## Configurando o AWS CLI

O AWS CLI precisa de credenciais e de uma região, mesmo para o
LocalStack (que não valida nenhuma delas). Configure um perfil
dedicado para não misturar com o perfil real da AWS:

```bash
aws configure --profile localstack
```

Preencha assim:

```text
AWS Access Key ID: test
AWS Secret Access Key: test
Default region name: us-east-1
Default output format: json
```

Qualquer valor serve para as credenciais. O LocalStack as ignora
completamente.

> [!TIP] Alias para facilitar
> Adicione um alias no `.bashrc` ou `.zshrc` para não repetir as
> flags toda vez:
>
> ```bash
> alias awslocal='aws --profile localstack \
>   --endpoint-url http://localhost:4566'
> ```
>
> O projeto [awslocal](https://github.com/localstack/awscli-local)
> faz isso de forma ainda mais robusta, se preferir instalar via pip.

Nos exemplos a seguir, `awslocal` se refere a esse alias.

## Testando com o S3

Com o alias configurado, criar um bucket é idêntico ao comando real:

```bash
awslocal s3 mb s3://meu-bucket-local
awslocal s3 cp arquivo.txt s3://meu-bucket-local/
awslocal s3 ls s3://meu-bucket-local/
```

<!-- TODO: espaço reservado para print: terminal com os três comandos acima e suas saídas confirmando criação, upload e listagem -->

Se você ainda não conhece o S3, confira o
[post sobre S3: bucket e upload via CLI/boto3](/posts/criando-primeiro-bucket-s3-boto3)
antes de seguir.

### Via boto3

```python
# s3_local.py
import boto3

s3 = boto3.client(
    "s3",
    endpoint_url="http://localhost:4566",
    aws_access_key_id="test",
    aws_secret_access_key="test",
    region_name="us-east-1",
)

s3.create_bucket(Bucket="meu-bucket-local")

s3.upload_file("arquivo.txt", "meu-bucket-local", "arquivo.txt")

resposta = s3.list_objects_v2(Bucket="meu-bucket-local")
for obj in resposta.get("Contents", []):
    print(obj["Key"])
```

A única diferença em relação ao uso normal do boto3 é o parâmetro
`endpoint_url` apontando para o localhost. O restante do código é
idêntico ao que vai para produção.

## Testando com a Lambda

Crie uma função simples:

```python
# handler.py
import json

def handler(event, context):
    nome = event.get("nome", "mundo")
    return {
        "statusCode": 200,
        "body": json.dumps({"mensagem": f"Olá, {nome}!"}),
    }
```

Empacote e faça o deploy para o LocalStack:

```bash
zip funcao.zip handler.py

awslocal lambda create-function \
  --function-name minha-funcao \
  --runtime python3.12 \
  --zip-file fileb://funcao.zip \
  --handler handler.handler \
  --role arn:aws:iam::000000000000:role/qualquer
```

O valor de `--role` não precisa existir no LocalStack, mas precisa
seguir o formato de ARN.

Invoque a função:

```bash
awslocal lambda invoke \
  --function-name minha-funcao \
  --payload '{"nome": "LocalStack"}' \
  resposta.json

cat resposta.json
```

<!-- TODO: espaço reservado para print: terminal mostrando a invocação da função e a resposta JSON com a mensagem -->

Para entender melhor como a Lambda funciona antes de testá-la
localmente, veja o
[post sobre AWS Lambda: introdução ao serverless na prática](/posts/aws-lambda-introducao).

## Testando com o DynamoDB

Crie uma tabela e insira um item via CLI:

```bash
awslocal dynamodb create-table \
  --table-name Pedidos \
  --attribute-definitions \
      AttributeName=id,AttributeType=S \
  --key-schema \
      AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

awslocal dynamodb put-item \
  --table-name Pedidos \
  --item '{"id": {"S": "001"}, "produto": {"S": "Teclado"}}'

awslocal dynamodb get-item \
  --table-name Pedidos \
  --key '{"id": {"S": "001"}}'
```

### Via boto3

```python
# dynamodb_local.py
import boto3

dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url="http://localhost:4566",
    aws_access_key_id="test",
    aws_secret_access_key="test",
    region_name="us-east-1",
)

tabela = dynamodb.Table("Pedidos")

tabela.put_item(Item={"id": "002", "produto": "Mouse"})

resposta = tabela.get_item(Key={"id": "002"})
print(resposta["Item"])
```

<!-- TODO: espaço reservado para print: terminal com a saída do get_item mostrando o item inserido -->

## Observações importantes

**Os dados não persistem por padrão.** Quando o contêiner para, tudo
que foi criado some. Para persistir entre reinicializações, adicione
um volume dedicado no `docker-compose.yml`:

```yaml
# docker-compose.yml (trecho)
volumes:
  - "./localstack-data:/var/lib/localstack"
  - "/var/run/docker.sock:/var/run/docker.sock"
```

**Versão Community versus Pro.** A versão gratuita cobre bem S3,
Lambda, DynamoDB, SQS, SNS, API Gateway e outros serviços populares.
Serviços mais avançados como RDS, EKS e CloudFront completo precisam
da versão Pro.

**Não use o LocalStack em produção.** Ele é uma ferramenta de
desenvolvimento. Nenhuma das configurações de segurança funciona de
verdade.

**Atenção com testes de integração.** O comportamento do LocalStack
pode divergir da AWS real em casos de borda. Sempre valide na AWS
antes de colocar em produção um fluxo crítico.

## Recapitulando

Você subiu o LocalStack com Docker, configurou o AWS CLI com um
perfil dedicado e executou operações reais em três serviços: S3,
Lambda e DynamoDB. O código boto3 que funciona aqui funciona na AWS
real com uma mudança mínima: remover o parâmetro `endpoint_url`.

Para o ciclo diário, isso significa testar localmente, iterar rápido
e só criar recursos reais na AWS quando o código já estiver validado.
Sem surpresas na conta no final do mês.
