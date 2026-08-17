---
title: "AWS Lambda: introdução ao serverless na prática"
description: "Aprenda o que é a AWS Lambda, como criar sua primeira
  função serverless pelo console e entenda quando faz sentido usar
  computação sem servidor."
pubDatetime: 2026-08-16T12:00:00.000Z
tags: ["lambda", "serverless", "nivel-200"]
---

A **AWS Lambda** é o serviço de computação serverless da AWS: você
escreve uma função, sobe o código e a AWS cuida de tudo o mais,
desde provisionar servidores até escalar automaticamente conforme a
demanda. Neste post você vai entender como a Lambda funciona por
dentro, criar sua primeira função pelo console, e aprender quando
faz sentido adotar serverless, e quando ela pode ser a escolha
errada.

O post não cobre triggers avançados como integração com API Gateway
ou processamento de filas com SQS. Esses temas ficam para posts
próprios.

## Pré-requisitos

- Conta AWS ativa (a camada gratuita já é suficiente para tudo
  aqui).
- Acesso ao Console AWS via browser.
- Conhecimento básico de Python ou Node.js (os exemplos usam Python).

## Como a Lambda funciona

Quando você cria uma função Lambda, está basicamente dizendo para a
AWS: "sempre que alguém chamar essa função, execute este código e
me devolva o resultado". A AWS provisiona um contêiner de execução
nos bastidores, injeta seu código nele, roda a função e descarta o
contêiner quando termina.

Três conceitos centrais:

- **Handler**: o ponto de entrada da sua função. No Python, é a
  função `lambda_handler(event, context)`.
- **Event**: o objeto que dispara a execução. Pode vir de um
  endpoint HTTP, de um arquivo novo num bucket S3, de um
  agendamento, entre outros. Se quiser entender melhor como o S3
  funciona, confira o [post sobre buckets e upload via
  CLI/boto3](/posts/criando-primeiro-bucket-s3-boto3).
- **Context**: metadados da execução (tempo restante, nome da
  função, ID da requisição).

<!-- TODO: espaço reservado para print: diagrama mostrando o fluxo
de invocação da Lambda: event source → Lambda → execução → resposta -->

## Criando sua primeira função

Acesse o console da AWS e navegue até o serviço **Lambda**.

### Passo 1: criar a função

Clique em **Create function** e escolha **Author from scratch**.
Preencha:

- **Function name**: `minha-primeira-funcao`
- **Runtime**: Python 3.13 (ou a versão mais recente disponível)
- **Architecture**: x86\_64

Deixe as permissões no default (a Lambda cria uma role básica com
permissão de escrita em logs). Clique em **Create function**.

<!-- TODO: espaço reservado para print: tela de criação da função
com os campos preenchidos antes de confirmar -->

### Passo 2: escrever o código

No editor inline, substitua o conteúdo pelo código abaixo:

```python
# lambda_function.py
def lambda_handler(event, context):
    nome = event.get("nome", "mundo")
    return {
        "statusCode": 200,
        "body": f"Olá, {nome}!"
    }
```

O handler recebe um `event` com um campo opcional `nome` e devolve
uma resposta HTTP-like com status e corpo. Clique em **Deploy**
para salvar.

### Passo 3: testar

Clique em **Test** e crie um evento de teste com o JSON abaixo:

```json
{
  "nome": "arquitecloud"
}
```

Dê um nome ao evento (ex. `teste-basico`) e clique em **Test**
novamente. Você deve ver a resposta:

```json
{
  "statusCode": 200,
  "body": "Olá, arquitecloud!"
}
```

<!-- TODO: espaço reservado para print: resultado da execução do
teste no console, mostrando o painel de resposta com status 200 -->

> [!TIP] Logs automáticos
> A Lambda envia automaticamente os logs de cada execução para o
> **Amazon CloudWatch Logs**. Se sua função falhar, é lá que você
> encontra o stack trace completo.

## Vantagens do serverless com a Lambda

**Sem servidor para gerenciar.** Você não provisiona, não patcha
sistema operacional, não configura auto scaling. A AWS faz isso.

**Escala automática e instantânea.** Se sua função receber mil
requisições ao mesmo tempo, a AWS sobe mil instâncias em paralelo.
Você não configura nada.

**Custo proporcional ao uso.** Você paga por número de invocações e
por tempo de execução (em incrementos de 1 ms). Se ninguém chamar
sua função, o custo é zero.

**Integração nativa com o ecossistema AWS.** A Lambda se conecta com
S3, DynamoDB, SQS, SNS, API Gateway, EventBridge e dezenas de
outros serviços com poucos cliques.

**Deploy simples.** Um arquivo ZIP ou uma imagem de contêiner já é
suficiente para colocar código em produção.

## Desvantagens: o cold start e outros limites

### Cold start

Quando uma função Lambda fica sem receber chamadas por algum tempo,
a AWS descarta o contêiner de execução para liberar recursos. Na
próxima invocação, ela precisa subir um novo contêiner do zero:
baixar o runtime, inicializar dependências, carregar o código. Esse
processo leva de alguns milissegundos a alguns segundos dependendo
do runtime e do tamanho do pacote.

Isso é o **cold start**, e ele tem impacto real em aplicações que
exigem latência consistente.

> [!NOTE] Cold start vs warm start
> Uma invocação "quente" (warm) reutiliza um contêiner já
> inicializado e costuma responder em menos de 10 ms. Uma
> invocação "fria" (cold) pode levar de 200 ms a mais de 1 s,
> dependendo do runtime (Java e .NET são os mais lentos; Python e
> Node.js são os mais rápidos).

Estratégias para mitigar:

- **Provisioned Concurrency**: mantém N instâncias sempre
  inicializadas (tem custo adicional).
- **SnapStart** (disponível para Java): a AWS tira um snapshot do
  estado inicializado e o reutiliza nas próximas execuções.
- **Funções menores e com menos dependências**: quanto menor o
  pacote, mais rápido o cold start.
- **Pings periódicos**: invocar a função a cada poucos minutos
  mantém o contêiner quente. É um hack, mas funciona.

### Outros limites

| Limite | Valor padrão |
| --- | --- |
| Tempo máximo de execução | 15 minutos |
| Memória máxima | 10 GB |
| Tamanho do pacote (ZIP) | 50 MB (comprimido) |
| Concorrência padrão por região | 1.000 execuções simultâneas |
| Tamanho do payload de entrada | 6 MB (síncrono) |

> [!WARNING] Limites de concorrência
> O limite de 1.000 execuções simultâneas é por conta AWS, não por
> função. Se você tiver várias funções em produção e uma delas
> explodir em tráfego, pode "engolir" a cota das outras. Solicite
> aumento via Support ou defina **reserved concurrency** por
> função.

## Quando usar a Lambda (e quando não usar)

### Use a Lambda quando

- A tarefa é **orientada a eventos**: responder a um upload, a uma
  mensagem numa fila, a um agendamento periódico.
- O processamento é **curto** (segundos, no máximo poucos minutos).
- O tráfego é **imprevisível ou irregular**: picos esporádicos se
  beneficiam do scale-to-zero da Lambda.
- Você quer **zero overhead operacional**: sem EC2 para gerenciar,
  sem auto scaling groups para configurar.
- O projeto está começando e você quer **mover rápido** sem
  infraestrutura.

### Não use a Lambda quando

- O processamento leva **mais de 15 minutos** (use AWS Batch, ECS
  ou EC2).
- A aplicação precisa de **estado persistente em memória entre
  requisições** (a Lambda é stateless por natureza).
- A **latência consistente é crítica** e cold starts são
  inaceitáveis (Provisioned Concurrency resolve, mas aumenta o
  custo; EC2 ou ECS podem ser mais previsíveis).
- O workload é **CPU-intensivo e contínuo**: transcodificação de
  vídeo, renderização, ML inference em lote. Para esses casos, EC2
  com GPU ou instâncias otimizadas sai mais barato.
- Você tem um **monolito legado** que não foi projetado para
  execução efêmera. Migrar para Lambda sem refatorar cria mais
  problemas do que resolve.

## Quanto custa manter isso no ar

A Lambda usa modelo **pay-as-you-go** puro: sem custo quando a
função não é invocada.

A precificação tem dois componentes (valores da AWS em agosto de
2026):

- **Invocações**: primeiros 1 milhão por mês são gratuitos. Depois
  disso, \$0,20 por milhão de invocações.
- **Duração**: primeiros 400.000 GB-segundo por mês são gratuitos.
  Depois, \$0,0000166667 por GB-segundo.

Para ter uma ideia prática: uma função com 128 MB de memória rodando
por 200 ms, invocada 1 milhão de vezes no mês, custa menos de
\$0,50. Para a maioria dos projetos iniciais, o custo é zero ou
próximo disso.

> [!TIP] Calculadora oficial
> Use a [calculadora de preços da AWS](https://calculator.aws) para
> estimar o custo com base no número real de invocações e tempo
> médio de execução do seu caso.

## Observações importantes

- **Limite de timeout por padrão é 3 segundos**. Se sua função
  demora mais, você vai ver um erro `Task timed out`. Ajuste em
  **Configuration > General configuration**.
- **Variáveis de ambiente** são o lugar certo para guardar
  configurações (URLs, nomes de buckets, flags). Nunca coloque
  credenciais diretamente no código.
- **IAM é essencial**: por padrão, a Lambda não tem permissão para
  acessar nenhum outro serviço. Adicione as permissões necessárias
  na execution role da função.
- **Dependências externas** precisam ser empacotadas junto com o
  código num arquivo ZIP ou via Lambda Layers.
- Ao terminar os testes, você pode deixar a função sem invocar que
  o custo será zero. Não há recurso "ligado" para deletar como num
  EC2.

## Recapitulando

Você criou sua primeira função Lambda no console, entendeu o ciclo
de execução (event, handler, response) e aprendeu o que está por
trás do modelo serverless. O principal trade-off é claro: você abre
mão de controle e de latência consistente em troca de escala
automática, custo zero em idle e zero overhead operacional. Para
workloads orientados a evento e tráfego irregular, a Lambda costuma
ser a escolha mais simples e barata. Para processamento longo,
stateful ou CPU-intensivo, outras opções da AWS se encaixam melhor.

## Continuando

A Lambda raramente vive sozinha. Onde ela fica mais interessante é
quando entra num pipeline orientado a eventos: reagindo a arquivos
novos num bucket S3, processando mensagens de uma fila SQS ou
sendo invocada em resposta a eventos do EventBridge.

É exatamente esse pipeline (S3 disparando uma Lambda que processa
e entrega dados para análise) que eu cubro no curso
[Engenharia de dados: AWS, Python e B3 na prática](https://go.hotmart.com/M105171021R).
Caso queira, utilize o cupom `ARQUITECLOUD` para garantir 50% de desconto na compra.
