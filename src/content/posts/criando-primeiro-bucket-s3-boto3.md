---
title: "S3: bucket e upload via CLI/boto3"
description: "Crie seu primeiro bucket S3 e envie arquivos via AWS CLI e Python (boto3), entendendo o porquê de cada passo."
pubDatetime: 2026-08-07T12:00:00.000Z
tags: ["s3", "boto3", "nivel-100"]
---

O S3 (Simple Storage Service) é o serviço de armazenamento de objetos da
AWS: você joga arquivos lá dentro (imagens, backups, logs, vídeos, o que
for), organizados em "buckets", que funcionam mais ou menos como pastas
raiz. É provavelmente o serviço mais usado da AWS, e é normalmente o
primeiro contato de quem está começando na nuvem.

Neste post você vai criar seu primeiro bucket e subir arquivos nele de duas
formas: pela linha de comando (AWS CLI) e por código Python (boto3, o SDK
oficial da AWS para Python). No fim, você vai entender não só o "como", mas
também o porquê de cada passo.

## Pré-requisitos

Antes de começar, você precisa de três coisas:

- **Uma conta AWS.** Se ainda não tem, crie uma em
  [aws.amazon.com](https://aws.amazon.com/). O S3 tem uma camada gratuita
  generosa, então testar os exemplos abaixo não deve custar nada.
- **AWS CLI instalada e configurada** com suas credenciais:

  ```bash
  aws configure
  ```

  Isso vai pedir sua Access Key, Secret Key, região padrão (ex: `us-east-1`)
  e formato de saída. Se você ainda não tem uma Access Key, gere uma em
  IAM → Users → Security credentials, no console da AWS.

- **Python 3.14 instalado, com o [uv](https://docs.astral.sh/uv/)** para
  gerenciar dependências e rodar os scripts:

  ```bash
  uv add boto3
  ```

  Isso adiciona o boto3 ao `pyproject.toml`/`uv.lock` do projeto. Uma coisa
  boa de saber: o boto3 usa automaticamente as mesmas credenciais
  configuradas pelo `aws configure`, então você não precisa configurar nada
  de novo para o Python: CLI e código Python "conversam" com a AWS da
  mesma forma.

Com isso pronto, vamos ao que interessa.

## Criando o bucket via CLI

Antes do primeiro comando, duas regras de nome que valem para qualquer
bucket S3:

1. O nome é único **globalmente**, não só na sua conta. Ou seja, se alguém
   no mundo já usou o nome, você não consegue usar. Por isso é comum incluir
   algo único, como o nome da empresa ou um sufixo aleatório.
2. Só letras minúsculas, números, pontos e hífens. Nada de espaço, maiúscula
   ou underline.

Com isso em mente, criar o bucket é um comando só:

```bash
# Criando um bucket
aws s3 mb s3://meu-bucket-exemplo-123 --region us-east-1
```

`mb` é de "make bucket". O `--region` define em qual região física da AWS o
bucket vai morar. Vale escolher uma perto de quem vai consumir os dados,
por questão de latência (e, às vezes, de conformidade legal).

Se der certo, a CLI responde com:

```bash
make_bucket: meu-bucket-exemplo-123
```

Se quiser confirmar visualmente, dá pra abrir o console da AWS e ver o
bucket na lista:

<!-- espaço reservado para print: console S3 mostrando o bucket criado -->

## Subindo arquivos via CLI

Com o bucket criado, subir arquivo é o próximo passo. Para um arquivo
único, o comando é `cp`, igual ao `cp` do terminal, só que de local para o
S3:

```bash
# Upload de um arquivo
aws s3 cp arquivo.txt s3://meu-bucket-exemplo-123/
```

Quando você tem uma pasta inteira para subir, dá para rodar `cp` várias
vezes, mas o jeito certo é usar `sync`: ele compara o que já está no bucket
com o que está localmente e sobe só o que mudou. Isso importa principalmente
quando você roda o upload mais de uma vez: a segunda vez é bem mais rápida.

```bash
# Upload de uma pasta
aws s3 sync ./meus-arquivos s3://meu-bucket-exemplo-123/meus-arquivos
```

E para conferir se realmente subiu, você lista o conteúdo do bucket:

```bash
# Listando o conteúdo do bucket
aws s3 ls s3://meu-bucket-exemplo-123/
```

Se o arquivo aparecer na lista com o tamanho certo, deu tudo certo. No
console, entrando no bucket, o arquivo aparece listado junto com o tamanho
e a data de upload:

<!-- espaço reservado para print: bucket no console mostrando o arquivo enviado -->

## Criando o bucket via boto3

Tudo que fizemos até aqui pela CLI também dá para fazer por código, o que
importa quando você quer automatizar isso dentro de uma aplicação, em vez
de rodar comando manualmente.

```python
# criar_bucket.py
import boto3

s3 = boto3.client("s3", region_name="us-east-1")

s3.create_bucket(Bucket="meu-bucket-exemplo-123")
```

Repare que a lógica é a mesma do comando `mb`: um cliente do S3, apontando
para uma região, criando um bucket com nome único. Para rodar:

```bash
uv run criar_bucket.py
```

> [!WARNING] Fora de us-east-1
> Se a sua região não for `us-east-1`, o `create_bucket` exige um parâmetro
> a mais, senão a AWS retorna erro. É uma particularidade histórica da
> API do S3, então vale decorar:
>
> ```python
> s3.create_bucket(
>     Bucket="meu-bucket-exemplo-123",
>     CreateBucketConfiguration={"LocationConstraint": "sa-east-1"},
> )
> ```

## Subindo arquivos via boto3

Com o bucket criado, o upload em Python usa o método `upload_file`:

```python
# upload.py
import boto3

s3 = boto3.client("s3")

s3.upload_file("arquivo.txt", "meu-bucket-exemplo-123", "arquivo.txt")
```

```bash
uv run upload.py
```

Os três argumentos, na ordem, são: caminho do arquivo local, nome do bucket
e a "key" (o caminho/nome que o arquivo vai ter dentro do bucket). É esse
terceiro argumento que dá a flexibilidade de organizar os arquivos. Se você
quiser simular uma "pasta" dentro do bucket (o S3 não tem pastas de verdade,
só simula visualmente a partir do nome), basta usar `/` na key:

```python
s3.upload_file("arquivo.txt", "meu-bucket-exemplo-123", "backups/arquivo.txt")
```

E, assim como fizemos na CLI, dá para conferir os arquivos que estão no
bucket:

```python
# listar.py
import boto3

s3 = boto3.client("s3")

response = s3.list_objects_v2(Bucket="meu-bucket-exemplo-123")
for obj in response.get("Contents", []):
    print(obj["Key"])
```

```bash
uv run listar.py
```

Esse script imprime a key de cada objeto do bucket: é o `list_objects_v2`
que faz o trabalho de listar, e o `for` só percorre o resultado.

## Duas observações importantes

- **O bucket é privado por padrão.** A AWS ativa o Block Public Access
  automaticamente, então ninguém acessa os arquivos por URL pública a menos
  que você mude isso explicitamente. É o comportamento certo pra maioria
  dos casos: só desative se você realmente souber o que está fazendo (por
  exemplo, hospedar um site estático). Você confere isso na aba
  "Permissions" do bucket, em "Block public access":

  *(espaço reservado para print: aba Permissions com o Block Public Access ativado)*

- **Apague o bucket depois do teste.** Bucket de teste esquecido é uma das
  formas mais comuns de gerar custo desnecessário na AWS. Para apagar:

  ```bash
  aws s3 rb s3://meu-bucket-exemplo-123 --force
  ```

  O `--force` remove os objetos dentro do bucket antes de apagar o bucket em
  si. Sem ele, o comando falha se o bucket não estiver vazio.

## Recapitulando

Você criou um bucket e subiu arquivos nele de duas formas: CLI para o dia
a dia manual, boto3 para automatizar dentro de código Python. É a mesma
lógica por trás de praticamente tudo que se faz com S3: criar um cliente
(ou usar a CLI já configurada), apontar para uma região e um bucket, e
chamar o método certo para a ação que você quer.

## Parabéns por ter chegado até aqui

Esse post cobre o básico para você sair do zero, mas o S3 sozinho já dá
pano pra manga: versionamento, políticas de acesso, ciclo de vida de
objetos, integração com outros serviços da AWS... e isso é só um serviço
entre dezenas. Se você quer aprender AWS de forma estruturada, do
fundamento até casos reais de uso em produção, dá uma olhada no meu curso.

Como recompensa por ter lido até o fim, use o cupom **`ARQUITECLOUD`** e
garanta **50% de desconto**:

**[Quero aprender AWS na prática »](https://go.hotmart.com/M105171021R)**
