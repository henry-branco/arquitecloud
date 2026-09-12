---
title: "Amazon Bedrock: introdução à IA generativa gerenciada na AWS"
description: "Entenda o Amazon Bedrock: Foundation Models gerenciados,
  RAG com Knowledge Bases, Agents e os trade-offs frente a SageMaker
  e infra própria."
pubDatetime: 2026-09-11T12:00:00.000Z
tags: ["bedrock", "machine-learning", "generative-ai", "rag", "nivel-300"]
---

O **Amazon Bedrock** é o serviço da AWS que dá acesso a modelos de
linguagem de grande escala (os chamados **Foundation Models**) de
diferentes fornecedores, como Anthropic, Meta, Mistral e Amazon,
tudo por meio de uma única API gerenciada. Você não precisa provisionar
GPUs, configurar drivers ou se preocupar com escalabilidade: a AWS
cuida da infraestrutura e você paga pelo que usa.

Este post cobre os conceitos centrais do Bedrock: como invocar modelos,
como montar pipelines de RAG com **Knowledge Bases**, como criar
**Agents** com lógica encadeada e quando faz sentido apostar no Bedrock
em vez de gerenciar seus próprios modelos. O post não entra em
provisionamento completo passo a passo; o objetivo é você sair daqui
com um mapa claro do serviço antes de ir para a prática.

## Foundation Models gerenciados

Um **Foundation Model (FM)** é um modelo pré-treinado em grandes volumes
de dados que serve como base para tarefas de linguagem: responder
perguntas, resumir textos, gerar código, classificar conteúdo e muito
mais. O Bedrock oferece acesso a vários desses modelos sem que você
precise hospedar nada.

A interação com os modelos se dá via API. O trecho abaixo mostra uma
chamada simples usando o SDK Python (`boto3`) ao modelo Claude da
Anthropic:

```python
import boto3
import json

client = boto3.client("bedrock-runtime", region_name="us-east-1")

response = client.invoke_model(
    modelId="anthropic.claude-3-5-sonnet-20241022-v2:0",
    body=json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "messages": [
            {"role": "user", "content": "Resuma o que é computação serverless."}
        ],
    }),
)

body = json.loads(response["body"].read())
print(body["content"][0]["text"])
```

Cada chamada cobra pelo número de **tokens** processados (entrada +
saída), não por tempo de execução. Isso torna o modelo de custo
previsível e proporcional ao uso real.

> [!NOTE] Disponibilidade por região
> Nem todos os modelos estão disponíveis em todas as regiões. Antes
> de escolher um modelo, verifique o **Model access** no console do
> Bedrock para a região onde sua aplicação roda.

<!-- TODO: espaço reservado para print: console do Bedrock mostrando
a lista de Foundation Models disponíveis com status de acesso -->

## Bedrock vs. infra própria: quando usar cada abordagem

A alternativa ao Bedrock é hospedar um modelo open-source você mesmo:
baixar os pesos, rodar em instâncias EC2 com GPU ou em um
**SageMaker Endpoint**, e gerenciar toda a pilha. Essa rota dá mais
controle, mas traz custos operacionais que o Bedrock elimina.

| Critério | Bedrock | EC2 / SageMaker próprio |
|---|---|---|
| **Custo inicial** | Zero (pay-per-token) | Alto (instância por hora, mesmo ociosa) |
| **Manutenção** | Nenhuma | Patches, drivers, monitoramento |
| **Modelos disponíveis** | Selecionados (curados pela AWS) | Qualquer modelo open-source |
| **Customização do modelo** | Fine-tuning via console | Total (LoRA, RLHF, etc.) |
| **Latência** | Variável (multi-tenant) | Mais previsível (dedicado) |
| **Conformidade de dados** | Dados não saem da sua conta AWS | Idem, mas você controla mais camadas |

O Bedrock faz mais sentido quando:

- O time não tem expertise em MLOps e quer focar na aplicação.
- O volume de requisições é irregular (picos eventuais, não contínuo).
- Modelos de fronteira como Claude ou Llama 3 atendem bem o caso de
  uso sem fine-tuning pesado.

Gerenciar infra própria vale mais a pena quando:

- O volume é alto o suficiente para que a instância dedicada fique
  mais barata que o custo por token.
- Você precisa de um modelo customizado que não existe no catálogo
  do Bedrock.
- Restrições regulatórias exigem controle total sobre onde os pesos
  do modelo residem.

Para entender a alternativa com SageMaker, veja o
[post sobre a plataforma de ML da AWS](/posts/amazon-sagemaker-ai-introducao)
e o [guia de SageMaker Endpoints na prática](/posts/sagemaker-endpoints-na-pratica).

## RAG com Knowledge Bases

**RAG (Retrieval-Augmented Generation)** é a técnica de conectar um
modelo de linguagem a uma base de conhecimento externa. Em vez de
depender apenas do que o modelo aprendeu no treinamento, você fornece
contexto relevante em cada chamada: o modelo lê os trechos recuperados
e usa essas informações para responder com mais precisão e menos
alucinação.

O Bedrock implementa RAG por meio das **Knowledge Bases**. O fluxo
funciona assim:

1. Você sobe documentos (PDFs, páginas HTML, arquivos de texto) para
   um bucket **S3**.
2. O Bedrock ingere esses documentos, quebra em chunks e gera
   **embeddings** (vetores que representam o significado semântico
   de cada trecho).
3. Os vetores são indexados em uma **vector store** gerenciada, por
   padrão o **Amazon OpenSearch Serverless**.
4. Quando uma pergunta chega, o Bedrock converte a pergunta em
   embedding, busca os chunks mais similares no índice e injeta
   esses trechos no prompt antes de chamar o FM.

<!-- TODO: espaço reservado para print: diagrama do fluxo de RAG no
console do Bedrock Knowledge Bases, mostrando data source S3 e
vector store -->

O trecho abaixo mostra como fazer uma pergunta a uma Knowledge Base
já criada usando a API `RetrieveAndGenerate`:

```python
import boto3

client = boto3.client("bedrock-agent-runtime", region_name="us-east-1")

response = client.retrieve_and_generate(
    input={"text": "Qual é a política de reembolso do produto X?"},
    retrieveAndGenerateConfiguration={
        "type": "KNOWLEDGE_BASE",
        "knowledgeBaseConfiguration": {
            "knowledgeBaseId": "SEU_KB_ID",
            "modelArn": (
                "arn:aws:bedrock:us-east-1::foundation-model/"
                "anthropic.claude-3-5-sonnet-20241022-v2:0"
            ),
        },
    },
)

print(response["output"]["text"])
```

A resposta já vem com as **citações** dos trechos usados pelo modelo,
o que facilita auditoria e rastreabilidade das fontes.

> [!TIP] Sincronização automática da fonte de dados
> O Bedrock não monitora o S3 em tempo real. Para atualizar a
> Knowledge Base com documentos novos ou modificados, é necessário
> acionar explicitamente uma **sincronização** (via console ou
> chamada à API `start_ingestion_job`). Considere automatizar isso
> com um evento S3 disparando uma Lambda.

Se ainda não conhece o S3 ou quer revisar como estruturar buckets
e fazer upload de arquivos, confira o
[post sobre S3: bucket e upload via CLI/boto3](/posts/criando-primeiro-bucket-s3-boto3).

## Bedrock Agents e Action Groups

Um **Bedrock Agent** é um orquestrador gerenciado que usa um FM para
raciocinar em múltiplos passos e executar ações para atingir um
objetivo. Em vez de você escrever a lógica de "decida o que fazer,
chame a ferramenta, avalie o resultado, repita", o Agent faz esse
loop internamente.

O componente central dessa extensibilidade é o **Action Group**: um
conjunto de ações que o agente pode executar. Cada ação é definida
por um schema OpenAPI e conectada a uma função Lambda que implementa
a lógica real.

O fluxo de execução de um agente fica assim:

```text
Usuário → Agent → FM raciocina sobre o objetivo
                ↓
         Escolhe uma Action Group
                ↓
         Chama a Lambda correspondente
                ↓
         Recebe o resultado e raciocina novamente
                ↓
         Responde ao usuário (ou repete o ciclo)
```

Um exemplo concreto: um agente de suporte ao cliente pode ter três
Action Groups:

- **buscar_pedido**: chama uma Lambda que consulta o DynamoDB pelo
  número do pedido.
- **solicitar_reembolso**: chama uma Lambda que abre um ticket no
  sistema interno.
- **consultar_politica**: busca na Knowledge Base a política
  vigente para o tipo de reclamação.

O agente decide qual ação usar em cada turno com base no contexto
da conversa. Você não precisa escrever esse roteamento.

```python
import boto3

client = boto3.client("bedrock-agent-runtime", region_name="us-east-1")

response = client.invoke_agent(
    agentId="SEU_AGENT_ID",
    agentAliasId="TSTALIASID",
    sessionId="sessao-123",
    inputText="Quero cancelar meu pedido #9981 e receber reembolso.",
)

for event in response["completion"]:
    if "chunk" in event:
        print(event["chunk"]["bytes"].decode(), end="", flush=True)
```

> [!NOTE] Aliases e versões
> Um Agent no Bedrock tem **versões** (snapshots imutáveis) e
> **aliases** (ponteiros para uma versão). Em produção, use sempre
> um alias fixo para que uma atualização de versão não impacte
> sessões ativas.

<!-- TODO: espaço reservado para print: console do Bedrock Agents
mostrando um agente com suas Action Groups e a Knowledge Base
associada -->

Para o Agent invocar Lambda, o papel IAM do agente precisa de
permissão `lambda:InvokeFunction`. Se você ainda não trabalhou com
Lambda, veja o
[post sobre Lambda: introdução ao serverless na prática](/posts/aws-lambda-introducao).

## MCP no Bedrock

O **Model Context Protocol (MCP)** é um padrão aberto criado pela
Anthropic para que modelos de linguagem se conectem a ferramentas e
fontes de dados externas de forma padronizada. Em vez de cada
integração ter seu próprio formato, o MCP define um protocolo único:
o modelo anuncia quais ferramentas quer usar, o servidor MCP executa
e devolve o resultado.

O Bedrock Agents passou a suportar **MCP servers** como destino de
Action Groups, o que significa que qualquer servidor MCP existente
(um banco de dados, uma API, um sistema de arquivos) pode ser
conectado a um agente sem reescrever a integração no formato de
Lambda + schema OpenAPI.

Na prática, isso expande bastante o ecossistema de ferramentas
disponíveis para os agentes. Se a sua equipe já opera servidores MCP
para outros modelos (via Claude Desktop, por exemplo), é possível
reaproveitá-los diretamente no Bedrock.

> [!NOTE] MCP no Bedrock ainda é recente
> O suporte a MCP nos Bedrock Agents foi anunciado em 2025 e ainda
> está evoluindo. Verifique a documentação oficial para a lista de
> regiões e limitações vigentes antes de adotar em produção.

## Integrando com arquiteturas serverless

O Bedrock se encaixa bem em arquiteturas orientadas a eventos porque
não exige infraestrutura dedicada por hora. Uma Lambda pode chamar
o Bedrock sob demanda e escala para zero quando não há requisições.

Um padrão comum é o processamento assíncrono de documentos:

```text
S3 (upload de arquivo)
  → EventBridge / S3 Event Notification
  → Lambda (extrai texto, monta prompt)
  → Bedrock (processa com FM)
  → DynamoDB (persiste resultado)
```

Para fluxos com múltiplos passos dependentes (resumir, classificar
e depois rotear para filas diferentes), o **AWS Step Functions** é
uma boa escolha. Você mantém cada etapa isolada em uma Lambda e o
Step Functions cuida do encadeamento, das retentativas e do estado
entre etapas.

Dois pontos de atenção ao integrar com Lambda:

- **Timeout**: o timeout padrão de uma Lambda é 3 segundos; modelos
  maiores podem levar mais. Ajuste para no mínimo 30-60 segundos
  em funções que invocam o Bedrock, e considere chamadas assíncronas
  com streaming para respostas longas.
- **Throttling**: o Bedrock tem cotas de **tokens por minuto (TPM)**
  e **requisições por minuto (RPM)** por modelo. Em picos, trate
  `ThrottlingException` com backoff exponencial ou mova o
  processamento para uma fila SQS com taxa controlada.

## Quanto custa

A invocação de modelos no Bedrock é **pay-per-token**: você paga por
cada mil tokens de entrada e saída, sem taxa mínima. Os valores variam
por modelo; como referência, os preços oficiais da AWS em setembro de
2026 para o Claude 3.5 Sonnet via Bedrock ficam em torno de
\$0,003 por mil tokens de entrada e \$0,015 por mil tokens de saída
na região us-east-1.

A exceção é a **Knowledge Base com OpenSearch Serverless**, que cobra
por **OCU-hora** (OpenSearch Compute Unit). O mínimo para uma
coleção de busca vetorial é 2 OCUs ativas, o que gera custo mesmo
sem requisições. Se a Knowledge Base for usada apenas em
desenvolvimento ou em testes esporádicos, destrua a coleção quando
não estiver em uso.

> [!WARNING] OpenSearch Serverless cobra por hora
> Uma coleção OpenSearch Serverless ativa consome no mínimo 2 OCUs
> continuamente, ao custo de ~\$0,24 por OCU-hora. Deixar uma
> coleção ligada por um mês sem uso gera uma conta de
> aproximadamente \$350. Exclua a coleção quando terminar os testes.

Para Bedrock Agents, o custo segue o mesmo modelo por token do
modelo subjacente, acrescido de uma taxa por passo de orquestração.
Verifique a [página de preços do Amazon Bedrock](https://aws.amazon.com/bedrock/pricing/)
para os valores atualizados por modelo e recurso.

## Recapitulando

O Amazon Bedrock centraliza o acesso a Foundation Models de diferentes
fornecedores sem exigir que você gerencie nenhuma infraestrutura de
ML. Com Knowledge Bases, você adiciona RAG à sua aplicação conectando
documentos do S3 a um índice vetorial gerenciado. Com Agents e Action
Groups, o modelo passa a orquestrar chamadas a sistemas externos com
base no contexto da conversa. E com o suporte a MCP, esse ecossistema
se expande para qualquer ferramenta que siga o protocolo.

O modelo de custo por token torna o Bedrock atraente para cargas
irregulares e times sem expertise em MLOps. Para volumes altos ou
necessidade de modelos customizados, vale comparar com uma rota via
SageMaker ou EC2 dedicado.

Posts futuros vão explorar cada um desses recursos em maior
profundidade, com exemplos completos de provisionamento e código
de produção.
