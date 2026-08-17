---
title: "Amazon SageMaker AI: a plataforma de ML da AWS"
description: "Entenda o que é o Amazon SageMaker AI, como ele organiza o ciclo de vida de machine learning e quais ferramentas fazem parte da plataforma."
pubDatetime: 2026-08-10T12:00:00.000Z
tags: ["sagemaker", "machine-learning", "nivel-100"]
---

O **Amazon SageMaker AI** é a plataforma de machine learning gerenciada
da AWS. Em vez de montar um ambiente do zero, configurar servidores de
treinamento manualmente, versionar experimentos em pastas locais e criar
infraestrutura de deploy por conta própria, o SageMaker reúne tudo isso
em um conjunto de serviços integrados. A proposta é cobrir o ciclo de
vida completo de um projeto de ML: da exploração dos dados até o modelo
servindo predições em produção.

Este post apresenta o SageMaker como plataforma: o que cada parte faz,
como elas se encaixam e quando faz sentido usar. Não vamos executar
nenhum comando aqui. Posts específicos cobrem a parte prática de cada
serviço.

## O ciclo de vida de um projeto de ML

Um projeto de machine learning passa por etapas bastante previsíveis,
independente do problema que você está resolvendo:

1. **Exploração e análise dos dados**: entender o dataset, identificar
   problemas de qualidade, visualizar distribuições.
2. **Preparação dos dados**: limpeza, transformações, feature
   engineering, divisão entre treino e teste.
3. **Treinamento do modelo**: rodar o algoritmo sobre os dados
   preparados, ajustar hiperparâmetros, comparar abordagens.
4. **Avaliação e rastreamento de experimentos**: registrar métricas,
   comparar runs, escolher o melhor modelo.
5. **Deploy**: empacotar o modelo e disponibilizá-lo para receber
   requisições de inferência.
6. **Monitoramento**: acompanhar a qualidade das predições ao longo
   do tempo e detectar degradação.

O problema é que cada etapa dessas costuma exigir ferramentas e
infraestrutura diferentes. O ambiente de exploração não precisa de GPU.
O treinamento pode precisar de várias instâncias em paralelo. O deploy
exige uma API estável e escalável. Sem uma plataforma, você acaba
juntando peças de lugares diferentes e gerenciando essa cola.

É exatamente aí que o SageMaker entra: ele oferece um serviço (ou um
conjunto deles) para cada etapa, tudo dentro da AWS e integrado entre
si.

## Desenvolvendo: SageMaker Studio e Code Editor

O **SageMaker Studio** é o ambiente de desenvolvimento integrado do
SageMaker. Ele roda no navegador e oferece notebooks Jupyter, terminal,
gerenciador de arquivos e acesso direto aos outros serviços da
plataforma, tudo em um só lugar. Você não precisa instalar nada
localmente: o Studio provisiona a infraestrutura de computação por
trás dos bastidores.

Dentro do Studio, uma das ferramentas mais práticas é o **SageMaker
Code Editor**, que é basicamente um VS Code hospedado na nuvem. Ele
usa a mesma base do VS Code (extensões, atalhos, configurações), mas
roda em uma instância gerenciada pela AWS. Isso é útil quando você
quer editar scripts de treinamento, depurar código e rodar experimentos
sem sair do ambiente da AWS.

<!-- TODO: espaço reservado para print: tela do SageMaker Studio no console da AWS, mostrando o Code Editor aberto -->

A diferença entre os dois na prática:

- **Studio com notebooks**: melhor para exploração interativa, análise
  de dados e visualizações. O fluxo célula a célula é ideal para essa
  fase.
- **Code Editor**: melhor para escrever e organizar código de
  treinamento em arquivos `.py`, que é o que você vai submeter como
  um Job depois.

> [!NOTE] Instâncias de desenvolvimento têm custo por hora
> Tanto o Studio quanto o Code Editor rodam em instâncias que cobram
> por hora de uso, mesmo que você não esteja executando nada. Lembre
> de encerrar as sessões quando não estiver usando.

## Treinando: Training Jobs e Processing Jobs

Treinar um modelo localmente funciona bem para experimentos pequenos.
Mas assim que o dataset cresce ou você quer testar combinações de
hiperparâmetros em paralelo, rodar tudo na sua máquina deixa de fazer
sentido.

O **SageMaker Training Job** é a resposta para isso. Você define o
script de treinamento, escolhe qual instância vai rodar (CPU ou GPU),
aponta os dados de entrada no S3 e submete o job. Se você ainda
não conhece o S3, vale ler o [post sobre buckets e upload via
CLI/boto3](/posts/criando-primeiro-bucket-s3-boto3) antes de
continuar. O SageMaker provisiona a instância, executa o script e encerra
a máquina ao terminar. Você só paga pelo tempo que o job ficou rodando.

Isso tem duas vantagens principais:

- **Escala sob demanda**: quer testar com uma instância com 8 GPUs?
  Você escolhe e o SageMaker cuida do provisionamento. Não é preciso
  manter esse hardware parado esperando.
- **Isolamento**: cada job roda em ambiente limpo e reproduzível.
  Sem conflito de dependências entre experimentos.

<!-- TODO: espaço reservado para print: lista de Training Jobs no console do SageMaker, com status e duração de cada run -->

O **SageMaker Processing Job** segue o mesmo modelo, mas para tarefas
de pré e pós-processamento de dados. Se você tem um script que limpa o
dataset, gera features ou avalia o modelo com métricas customizadas,
pode rodar isso como um Processing Job, também em infraestrutura
gerenciada e paga por uso.

> [!TIP] Prefira jobs a notebooks para código de produção
> Um Training Job é mais reproduzível do que rodar células de notebook
> manualmente. O código vive em um arquivo `.py` versionado, os
> parâmetros ficam registrados e os logs ficam no CloudWatch.

## Rastreando experimentos: integração com MLflow

Quando você roda múltiplos experimentos, comparar resultados vira um
problema rápido. Qual combinação de hiperparâmetros deu o melhor F1?
Qual versão do dataset foi usada naquela run de terça? Sem rastreamento,
essas respostas vivem em anotações espalhadas ou em nomes de arquivo.

O **[MLflow](https://mlflow.org/)** é uma ferramenta open source amplamente
adotada para isso.Ele registra métricas, parâmetros, artefatos (como o modelo
treinado)e metadados de cada experimento em um servidor centralizado. Você pode
comparar runs lado a lado, visualizar curvas de métricas e promover
modelos para um registro central.

O SageMaker oferece **servidores MLflow gerenciados**: você cria um
tracking server no console (ou via CLI) e a AWS cuida da infraestrutura,
do armazenamento e da disponibilidade. No seu código de treinamento,
você aponta o `MLFLOW_TRACKING_URI` para o endpoint do servidor e o
MLflow passa a registrar tudo automaticamente.

```python
import mlflow

mlflow.set_tracking_uri("<uri-do-seu-servidor-sagemaker>")
mlflow.set_experiment("meu-experimento")

with mlflow.start_run():
    mlflow.log_param("learning_rate", 0.01)
    mlflow.log_metric("accuracy", 0.94)
```

Essa integração funciona com Training Jobs também: você passa o URI
como variável de ambiente no job e o MLflow registra as métricas
remotamente durante o treinamento.

<!-- TODO: espaço reservado para print: interface do MLflow mostrando a comparação de runs com métricas e parâmetros -->

> [!NOTE] MLflow gerenciado cobra por hora
> O tracking server do SageMaker é cobrado por hora de uso, além do
> armazenamento dos artefatos no S3. Para times pequenos ou uso
> esporádico, vale avaliar se o custo faz sentido frente a hospedar
> um servidor MLflow próprio.

## Orquestrando: SageMaker Pipelines

Conforme um projeto de ML amadurece, o que antes era uma sequência de
scripts rodados manualmente precisa virar um processo automatizado e
reproduzível. Você quer que, ao chegar um novo lote de dados, o
pipeline processe, treine, avalie e, se as métricas estiverem boas,
registre o novo modelo automaticamente.

O **SageMaker Pipelines** é o serviço de orquestração de ML da AWS.
Você define um grafo de etapas (steps) em Python: um Processing Step
para preparar os dados, um Training Step para treinar, um step de
avaliação de métricas e um step condicional que só registra o modelo
se o desempenho passar de um limiar. O SageMaker executa essas etapas
na ordem certa, gerencia as dependências entre elas e registra o
histórico de cada execução.

<!-- TODO: espaço reservado para print: grafo de um pipeline no console do SageMaker, mostrando os steps conectados -->

A diferença em relação a orquestradores genéricos como o Airflow é que
o Pipelines é nativo do SageMaker: cada step sabe como criar um
Training Job ou invocar um Processing Job, sem precisar de adaptadores.
As saídas de um step (como o modelo treinado ou métricas geradas)
são passadas automaticamente como entradas do próximo.

Para times que ainda estão explorando, o Pipelines pode ser complexo
demais no começo. Mas conforme o projeto estabiliza e o ciclo de
retreinamento precisa ser automático, ele se torna a peça que mantém
tudo junto.

## Servindo modelos: uma menção rápida

O SageMaker também cobre a etapa de deploy. O serviço principal para
isso são os **SageMaker Endpoints**: APIs REST gerenciadas que recebem
requisições de inferência e retornam as predições do modelo. Você
aponta o endpoint para um artefato de modelo no S3, escolhe o tipo de
instância e a AWS cuida do provisionamento, balanceamento e HTTPS.

Existem variações para diferentes casos de uso: endpoints síncronos
(resposta em tempo real), assíncronos (payload grande, resposta via
S3), serverless (sem instância dedicada, cobrança por invocação) e
multi-modelo (vários modelos em uma mesma instância).

Esse assunto tem nuances importantes de custo e arquitetura que merecem
um post separado. Se você quiser ir direto para a prática, leia o
[post SageMaker Endpoints na prática](/posts/sagemaker-endpoints-na-pratica),
que cobre o ciclo completo com código.

## Como funciona o custo do SageMaker

O SageMaker não tem um preço único: cada serviço da plataforma tem seu
próprio modelo de cobrança. Entender isso antes de começar evita
surpresas no extrato.

A regra geral é: **se tem uma instância rodando, você está pagando por
hora**, independente do que essa instância está fazendo. Os principais
pontos de custo são:

- **Studio e Code Editor**: cobram por hora de instância ativa. Uma
  sessão aberta e esquecida no final do dia gera custo até ser
  encerrada manualmente.
- **Training Jobs e Processing Jobs**: cobram pelo tempo de execução
  do job. A instância é provisionada quando o job começa e encerrada
  automaticamente ao terminar. Sem job rodando, sem custo.
- **MLflow tracking server**: cobra por hora que o servidor está
  ligado, mesmo sem nenhum experimento sendo registrado. É o tipo de
  recurso que precisa de atenção porque fica em segundo plano.
- **Endpoints de inferência**: cobram por hora de instância ativa,
  independente do volume de requisições. Um endpoint sem tráfego custa
  o mesmo que um endpoint com tráfego intenso.
- **Armazenamento no S3**: os artefatos de modelo, datasets e logs
  ficam no S3 e seguem a cobrança por GB armazenado, que é bem mais
  barata e previsível.

> [!WARNING] Recursos esquecidos são a causa mais comum de surpresa
> Studio, Code Editor, servidores MLflow e Endpoints não se encerram
> sozinhos. Se você abrir uma sessão para testar e esquecer, o custo
> acumula até você deletar manualmente. Crie o hábito de encerrar o
> que não está usando.

Para ter uma referência de valores, a [página de preços do
SageMaker](https://aws.amazon.com/sagemaker/pricing/) lista os custos
por serviço e por região. A região `us-east-1` costuma ter os preços
mais baixos.

## Quando faz sentido usar o SageMaker

O SageMaker não é a escolha certa para todo projeto de ML. Vale a pena
quando algumas dessas condições se aplicam:

- **O dataset não cabe na memória local** e você precisa de instâncias
  maiores ou treinamento distribuído.
- **Você tem vários experimentos rodando em paralelo** e precisa de
  rastreamento organizado.
- **O modelo precisa estar disponível como API** com disponibilidade
  gerenciada.
- **O pipeline de retreinamento precisa ser automatizado**, seja por
  agendamento ou por chegada de novos dados.
- **O time já usa AWS** e quer manter a infraestrutura de ML no mesmo
  ecossistema.

Por outro lado, para prototipagem rápida, datasets pequenos ou times
que ainda estão validando se o problema é resolvível com ML, o
SageMaker pode ser overkill. Rodar localmente ou em um notebook no
Google Colab resolve bem essa fase inicial.

O SageMaker faz mais sentido quando o projeto sai do modo de
experimentação e entra no modo de operação.

## Recapitulando

O SageMaker AI é uma plataforma que cobre o ciclo de vida completo de
um projeto de machine learning dentro da AWS. O **Studio e o Code
Editor** oferecem o ambiente de desenvolvimento. Os **Training e
Processing Jobs** trazem infraestrutura de computação gerenciada para
treinar e processar dados em escala. O **MLflow gerenciado** centraliza
o rastreamento de experimentos. O **Pipelines** orquestra e automatiza
o fluxo completo. E os **Endpoints** colocam o modelo em produção como
uma API gerenciada.

Cada serviço pode ser usado de forma independente, o que permite adotar
o SageMaker gradualmente: você pode começar só com Training Jobs e
adicionar rastreamento com MLflow depois, sem precisar comprar a
plataforma inteira de uma vez.
