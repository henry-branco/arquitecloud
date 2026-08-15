---
title: "SageMaker Endpoints na prática: servindo um modelo com API gerenciada"
description: "Suba um modelo para produção usando SageMaker Real-Time Endpoints: criação do Model, Endpoint Configuration e Endpoint, invocação via boto3 e limpeza de recursos."
pubDatetime: 2026-08-08T12:00:00.000Z
tags: ["sagemaker", "machine-learning", "boto3", "nivel-300"]
---

O SageMaker Endpoint é uma API REST gerenciada pela AWS que serve predições
de um modelo de machine learning. Você sobe o artefato do modelo para o S3,
define qual contêiner vai executá-lo e qual instância vai sustentá-lo, e a
AWS cuida do resto: provisionamento, health checks, balanceamento e HTTPS.
Você não gerencia servidor nenhum.

Este post cobre o ciclo completo de um Real-Time Endpoint: empacotar o
modelo, registrá-lo no SageMaker, configurar e criar o endpoint, invocar
a API e, tão importante quanto tudo isso, deletar o endpoint no final. O
que este post não cobre é treinar modelos, construir features ou qualquer
etapa anterior ao artefato já serializado e pronto para servir.

## Custo: leia isso antes de executar qualquer comando

> [!WARNING]
> O SageMaker Endpoint é fundamentalmente diferente do S3 e do
> [Amplify Hosting](/posts/publicando-site-aws-amplify-hosting) em termos
> de cobrança. Enquanto aqueles cobram por uso (por GB
> armazenado, por minuto de build), o endpoint cobra por hora de instância
> ativa. A instância fica alocada enquanto o endpoint existe, independente
> de você fazer uma ou zero invocações. Endpoint esquecido é a causa mais
> comum de susto no extrato da AWS quando o assunto é SageMaker.

Os valores abaixo são os oficiais da AWS em agosto de 2026, para a
região `us-east-1`:

| Instância | vCPU | RAM | Custo/hora | Custo/mês (sempre ligado) |
| --- | --- | --- | --- | --- |
| ml.t2.medium | 2 | 4 GiB | \$0,065 | ~\$47 |
| ml.m5.large | 2 | 8 GiB | \$0,128 | ~\$92 |
| ml.c5.xlarge | 4 | 8 GiB | \$0,204 | ~\$147 |

Não existe camada gratuita permanente para endpoints. Contas novas têm
250 horas mensais de `ml.t2.medium` nos primeiros dois meses, mas
verifique as condições atuais na
[página de preços do SageMaker](https://aws.amazon.com/sagemaker/pricing/)
antes de assumir que está coberto.

A regra prática é simples: sempre delete o endpoint ao terminar os
testes. Este post tem uma seção de limpeza no final e, se você pular
qualquer coisa neste post, que não seja a limpeza.

## Pré-requisitos

Antes de começar, você precisa de cinco coisas:

**1. Uma conta AWS** com permissões para SageMaker e S3. Para testes,
uma policy de administrador funciona. Em ambientes de produção,
restrinja ao mínimo necessário.

**2. Uma IAM Role de execução do SageMaker.** Esta é a role que o
próprio SageMaker vai assumir quando criar o endpoint: é ela que dá ao
serviço permissão para ler o artefato do modelo no S3 e puxar a imagem
do contêiner no ECR. Para criar:

1. No console da AWS, acesse **IAM → Roles → Create role**.
2. Em "Trusted entity type", selecione **AWS service**.
3. Em "Use case", selecione **SageMaker** (a opção "SageMaker - Execution").
4. Avance e adicione a policy gerenciada `AmazonSageMakerFullAccess`
   (cobre o suficiente para testes).
5. Dê um nome, como `SageMakerExecutionRole`, e salve.
6. Abra a role criada e copie o **ARN**: vai ser algo como
   `arn:aws:iam::123456789012:role/SageMakerExecutionRole`. Você vai
   precisar desse valor no código.

<!-- TODO: espaço reservado para print: tela de criação da IAM Role com o trusted entity SageMaker selecionado -->

**3. AWS CLI instalada e configurada** com credenciais que tenham
permissão para SageMaker e S3:

```bash
aws configure
```

**4. Um bucket S3** para guardar o artefato do modelo. Se você seguiu
o [post sobre S3](/posts/criando-primeiro-bucket-s3-boto3), já tem um.
Caso contrário, crie um agora:

```bash
aws s3 mb s3://meu-bucket-exemplo-123 --region us-east-1
```

**5. Python 3.14 com `uv`**, com as dependências do projeto:

```bash
uv init sagemaker-endpoint-demo
cd sagemaker-endpoint-demo
uv add boto3==1.38.4 sagemaker==2.258.0 scikit-learn==1.6.1 numpy==2.1.3
```

Para confirmar as versões instaladas:

```python
import boto3, sagemaker, sklearn, numpy
print(f"boto3=={boto3.__version__}")
print(f"sagemaker=={sagemaker.__version__}")
print(f"sklearn=={sklearn.__version__}")
print(f"numpy=={numpy.__version__}")
```

## O artefato do modelo

O SageMaker não recebe o código do modelo diretamente: ele recebe um
arquivo `model.tar.gz` com o modelo serializado dentro. É esse arquivo
que você sobe para o S3 e que o contêiner de inferência extrai quando o
endpoint sobe.

O conteúdo do `model.tar.gz` varia conforme o contêiner que vai servir
o modelo. Para o contêiner scikit-learn da AWS (que é o que vamos usar
aqui), o arquivo mínimo necessário é o modelo serializado com `joblib`,
mais um script `inference.py` que define como carregar e usar o modelo.

Vamos criar os dois.

### O script de inferência

O contêiner sklearn da AWS chama funções específicas do `inference.py`
para cada etapa do ciclo de uma requisição:

```python
# inference.py
import json
import joblib
import numpy as np
from numpy.typing import NDArray
from sklearn.linear_model import LinearRegression


def model_fn(model_dir: str) -> LinearRegression:
    """Carrega o modelo serializado a partir do diretório de modelo."""
    return joblib.load(f"{model_dir}/model.joblib")


def input_fn(
    input_data: str | bytes,
    content_type: str,
) -> NDArray[np.float64]:
    """Deserializa o body da requisição para um array numpy."""
    if content_type == "application/json":
        return np.array(json.loads(input_data))
    raise ValueError(f"Content type não suportado: {content_type}")


def predict_fn(
    input_data: NDArray[np.float64],
    model: LinearRegression,
) -> NDArray[np.float64]:
    """Executa a predição sobre os dados de entrada."""
    return model.predict(input_data)


def output_fn(prediction: NDArray[np.float64], accept: str) -> str:
    """Serializa a predição para o formato de resposta."""
    return json.dumps(prediction.tolist())
```

Cada função tem uma responsabilidade clara:

- `model_fn`: carrega o modelo do disco. O argumento `model_dir` é o
  caminho onde o contêiner extrai o `model.tar.gz` em tempo de execução
  (`/opt/ml/model/`).
- `input_fn`: deserializa o body da requisição. Aqui tratamos JSON e
  rejeitamos qualquer outro content type.
- `predict_fn`: executa a predição. Recebe o output de `input_fn` e o
  modelo carregado por `model_fn`.
- `output_fn`: serializa a resposta. Aqui convertemos o array numpy
  para JSON.

### O modelo serializado

Para ter algo para servir, vamos criar um modelo de regressão linear
que aprende que a saída é sempre o dobro da entrada. O modelo em si
não importa para o objetivo deste post: serve só como artefato válido
para testar o ciclo completo do endpoint.

```python
# preparar_modelo.py
"""Treina um modelo mínimo, serializa e empacota em model.tar.gz."""
import tarfile
import joblib
import numpy as np
from numpy.typing import NDArray
from sklearn.linear_model import LinearRegression


X: NDArray[np.float64] = np.array([[1], [2], [3]])
y: NDArray[np.float64] = np.array([2.0, 4.0, 6.0])
model: LinearRegression = LinearRegression().fit(X, y)

joblib.dump(model, "model.joblib")

with tarfile.open("model.tar.gz", "w:gz") as tar:
    tar.add("model.joblib")
    tar.add("inference.py")

print("model.tar.gz criado")
```

```bash
uv run preparar_modelo.py
```

O `model.tar.gz` inclui os dois arquivos: `model.joblib` (o modelo) e
`inference.py` (o script que o contêiner vai executar). O contêiner
extrai tudo no mesmo diretório, então o `model_fn` consegue encontrar o
`model.joblib` pelo caminho `model_dir/model.joblib`.

> [!TIP]
> A versão do scikit-learn instalada localmente (1.6.1 neste exemplo)
> pode ser diferente da versão disponível na imagem do contêiner (1.2
> no nosso caso). Modelos salvos com `joblib` em geral são compatíveis
> entre versões próximas do sklearn, mas se você tiver erros de
> carregamento no endpoint, a primeira coisa a verificar é se as
> versões batem.

## Enviando o artefato para o S3

```python
# upload_modelo.py
"""Faz o upload do model.tar.gz para o bucket S3."""
import boto3


BUCKET: str = "meu-bucket-exemplo-123"
REGION: str = "us-east-1"

s3 = boto3.client("s3", region_name=REGION)
s3.upload_file("model.tar.gz", BUCKET, "modelos/linear/model.tar.gz")

print(f"Artefato disponível em: s3://{BUCKET}/modelos/linear/model.tar.gz")
```

```bash
uv run upload_modelo.py
```

<!-- TODO: espaço reservado para print: bucket S3 mostrando o arquivo model.tar.gz na pasta modelos/linear/ -->

## Os três objetos do SageMaker

Antes de criar qualquer coisa, vale entender que o SageMaker organiza
o endpoint em três objetos independentes:

- **Model**: aponta para o `model.tar.gz` no S3 e define qual contêiner
  Docker vai servir o modelo. É a definição do "o quê".
- **Endpoint Configuration**: define em qual tipo de instância o modelo
  vai rodar, quantas instâncias e com qual distribuição de tráfego. É a
  definição do "como".
- **Endpoint**: a API em si, criada a partir de uma Endpoint
  Configuration. É o que recebe as invocações e onde o custo acontece.

A separação entre configuração e endpoint existe por uma razão prática:
você pode atualizar um endpoint existente apontando-o para uma nova
configuração, sem precisar recriar do zero. Isso é o que viabiliza
deploys sem downtime em produção, mas esse assunto fica para outro post.

<!-- TODO: espaço reservado para print: aba Models do SageMaker no console, com a lista de modelos registrados -->

## Criando o Model

```python
# criar_model.py
"""Registra o artefato do S3 como um Model no SageMaker."""
import boto3


REGION: str = "us-east-1"
BUCKET: str = "meu-bucket-exemplo-123"
ROLE_ARN: str = "arn:aws:iam::123456789012:role/SageMakerExecutionRole"
MODEL_NAME: str = "linear-model-v1"

SKLEARN_IMAGE: str = (
    "683313688378.dkr.ecr.us-east-1.amazonaws.com"
    "/sagemaker-scikit-learn:1.2-1-cpu-py3"
)

sm = boto3.client("sagemaker", region_name=REGION)

sm.create_model(
    ModelName=MODEL_NAME,
    PrimaryContainer={
        "Image": SKLEARN_IMAGE,
        "ModelDataUrl": f"s3://{BUCKET}/modelos/linear/model.tar.gz",
        "Environment": {
            "SAGEMAKER_PROGRAM": "inference.py",
        },
    },
    ExecutionRoleArn=ROLE_ARN,
)

print(f"Model '{MODEL_NAME}' criado")
```

```bash
uv run criar_model.py
```

Três campos merecem atenção:

- **`Image`**: o URI da imagem Docker que vai servir o modelo. A AWS
  mantém imagens prontas para scikit-learn, XGBoost, PyTorch,
  TensorFlow e outros frameworks, chamadas de DLC (Deep Learning
  Containers). O URI muda conforme a região e a versão do framework.
  Para encontrar o URI correto para a sua região e framework, consulte
  o [repositório de imagens disponíveis da AWS](https://github.com/aws/deep-learning-containers/blob/master/available_images.md).
- **`ModelDataUrl`**: o caminho S3 do `model.tar.gz`. O contêiner
  extrai esse arquivo em `/opt/ml/model/` quando o endpoint sobe.
- **`SAGEMAKER_PROGRAM`**: diz ao contêiner sklearn qual arquivo dentro
  do diretório extraído contém o script de inferência. Sem essa
  variável, o contêiner procura por `inference.py` por padrão, mas é
  boa prática declarar explicitamente.

<!-- TODO: espaço reservado para print: model registrado aparecendo na lista de Models do SageMaker -->

## Criando a Endpoint Configuration

```python
# criar_endpoint_config.py
"""Cria a Endpoint Configuration com tipo de instância e variantes."""
import boto3


REGION: str = "us-east-1"
CONFIG_NAME: str = "linear-model-config-v1"
MODEL_NAME: str = "linear-model-v1"

sm = boto3.client("sagemaker", region_name=REGION)

sm.create_endpoint_config(
    EndpointConfigName=CONFIG_NAME,
    ProductionVariants=[
        {
            "VariantName": "AllTraffic",
            "ModelName": MODEL_NAME,
            "InstanceType": "ml.t2.medium",
            "InitialInstanceCount": 1,
            "InitialVariantWeight": 1,
        }
    ],
)

print(f"Endpoint Configuration '{CONFIG_NAME}' criada")
```

```bash
uv run criar_endpoint_config.py
```

O campo `ProductionVariants` aceita uma lista porque o SageMaker
suporta múltiplas variantes de modelo no mesmo endpoint, cada uma
recebendo uma fração do tráfego (útil para A/B testing e canary
deployments, mas fora do escopo deste post).

O `InstanceType` é o campo que determina o custo. O `ml.t2.medium` é
a instância mínima disponível e cobre bem testes e workloads leves.
Para modelos maiores ou com requisitos de latência mais exigentes, você
vai precisar de instâncias mais potentes, mas o custo sobe
proporcionalmente.

<!-- TODO: espaço reservado para print: Endpoint Configuration criada, listada no console do SageMaker -->

## Criando o endpoint

```python
# criar_endpoint.py
"""Cria o endpoint e aguarda o status InService via waiter do boto3."""
import boto3


REGION: str = "us-east-1"
ENDPOINT_NAME: str = "linear-model-endpoint"
CONFIG_NAME: str = "linear-model-config-v1"

sm = boto3.client("sagemaker", region_name=REGION)

sm.create_endpoint(
    EndpointName=ENDPOINT_NAME,
    EndpointConfigName=CONFIG_NAME,
)

print("Criando endpoint, aguardando status InService...")

waiter = sm.get_waiter("endpoint_in_service")
waiter.wait(EndpointName=ENDPOINT_NAME)

print("Endpoint pronto!")
```

```bash
uv run criar_endpoint.py
```

A criação leva entre 3 e 8 minutos. O SageMaker precisa provisionar a
instância, puxar a imagem do contêiner e carregar o modelo na memória.
O `waiter` do boto3 faz polling automático do status e retorna assim
que o endpoint fica `InService`, sem precisar ficar checando o console.

<!-- TODO: espaço reservado para print: endpoint com status "Creating" no console do SageMaker -->

<!-- TODO: espaço reservado para print: endpoint com status "InService" no console do SageMaker -->

> [!WARNING]
> A partir do momento em que o endpoint fica `InService`, o relógio do
> custo começa a rodar. Não encerre a sessão sem deletar o endpoint
> antes.

## Invocando o endpoint

A invocação usa um cliente diferente do que usamos para criar os
recursos: o `sagemaker-runtime`. Essa separação existe porque os dois
têm propósitos distintos. O `sagemaker` é para gerenciamento (criar,
listar, deletar) e o `sagemaker-runtime` é para tráfego de inferência
(invocar).

```python
# invocar_endpoint.py
"""Invoca o endpoint com um payload JSON e imprime as predições."""
import json
import boto3


REGION: str = "us-east-1"
ENDPOINT_NAME: str = "linear-model-endpoint"

runtime = boto3.client("sagemaker-runtime", region_name=REGION)

payload: str = json.dumps([[5.0], [10.0], [15.0]])

response = runtime.invoke_endpoint(
    EndpointName=ENDPOINT_NAME,
    ContentType="application/json",
    Body=payload,
)

resultado: list[float] = json.loads(response["Body"].read())
print(resultado)
```

```bash
uv run invocar_endpoint.py
```

A saída esperada:

```text
[10.0, 20.0, 30.0]
```

O modelo aprendeu que a saída é o dobro da entrada, então 5 vira 10,
10 vira 20 e 15 vira 30. O `ContentType` precisa bater com o que o
`input_fn` no `inference.py` espera: se você mandar `application/json`
e o script não tratar esse tipo, o contêiner retorna erro 415.

<!-- TODO: espaço reservado para print: output do terminal mostrando o resultado da invocação -->

## Limpeza: delete na ordem correta

Deletar o Model e a Endpoint Configuration não para o billing. Só
deletar o Endpoint para. Por isso a ordem importa:

```python
# limpar.py
"""Deleta o endpoint, a configuração e o model na ordem correta."""
import boto3


REGION: str = "us-east-1"
ENDPOINT_NAME: str = "linear-model-endpoint"
CONFIG_NAME: str = "linear-model-config-v1"
MODEL_NAME: str = "linear-model-v1"
BUCKET: str = "meu-bucket-exemplo-123"

sm = boto3.client("sagemaker", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)

sm.delete_endpoint(EndpointName=ENDPOINT_NAME)
print(f"Endpoint '{ENDPOINT_NAME}' deletado, billing parado")

sm.delete_endpoint_config(EndpointConfigName=CONFIG_NAME)
print(f"Endpoint Configuration '{CONFIG_NAME}' deletada")

sm.delete_model(ModelName=MODEL_NAME)
print(f"Model '{MODEL_NAME}' deletado")

s3.delete_object(Bucket=BUCKET, Key="modelos/linear/model.tar.gz")
print("Artefato removido do S3")
```

```bash
uv run limpar.py
```

<!-- TODO: espaço reservado para print: endpoint com status "Deleting" no console do SageMaker -->

> [!NOTE]
> O `delete_endpoint` é assíncrono: o boto3 retorna imediatamente, mas
> a instância leva alguns minutos para ser encerrada de fato. O status
> no console vai ficar "Deleting" por um tempo. Para aguardar a
> conclusão por código, use o waiter `endpoint_deleted`:
>
> ```python
> waiter = sm.get_waiter("endpoint_deleted")
> waiter.wait(EndpointName=ENDPOINT_NAME)
> ```

## O que não cobrimos

Este post focou no caso mais direto: um endpoint síncrono com uma
instância fixa. O SageMaker tem outros modos de inferência que
resolvem problemas diferentes:

- **Serverless Inference**: cobra por invocação e por tempo de
  computação, sem instância dedicada. Faz sentido para tráfego baixo
  ou intermitente, onde manter uma instância ligada 24h seria
  ineficiente.
- **Async Inference**: o cliente manda o payload para o S3 e recebe
  uma notificação quando a resposta estiver pronta. Útil para payloads
  grandes ou modelos lentos, onde uma resposta síncrona em tempo real
  não é viável.
- **Multi-Model Endpoints**: um único endpoint serve múltiplos modelos,
  carregando e descarregando sob demanda. Reduz custo quando você tem
  muitos modelos com tráfego baixo.
- **Auto Scaling**: ajusta automaticamente o número de instâncias
  conforme a carga, adicionando quando o tráfego aumenta e removendo
  quando cai.

Cada um tem trade-offs de custo, latência e complexidade operacional
que merecem um post próprio.

## Recapitulando

Você empacotou um modelo em `model.tar.gz`, subiu para o S3, registrou
no SageMaker como um Model, criou uma Endpoint Configuration com o tipo
de instância, subiu o endpoint, fez invocações via `sagemaker-runtime`
e deletou tudo na ordem correta ao final.

O padrão é sempre o mesmo: Model aponta para o artefato, EndpointConfig
define o hardware, Endpoint é o que roda e custa. Mudar o modelo em
produção é questão de criar uma nova Endpoint Configuration e atualizar
o endpoint para apontar para ela, sem precisar recriar do zero.

O custo é o fator que mais diferencia o SageMaker Endpoint dos outros
serviços que vimos até aqui. Mantenha o hábito de deletar endpoints de
teste imediatamente após o uso.
