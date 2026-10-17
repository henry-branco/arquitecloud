---
title: "FinOps na AWS: boas práticas para controlar custos na nuvem"
description: "Entenda os pilares de FinOps na AWS e aplique boas práticas de visibilidade, otimização e governança com Cost Explorer, Budgets, Savings Plans e tagging."
pubDatetime: 2026-10-17T12:00:00.000Z
tags: ["finops", "custos", "aws", "nivel-200"]
---

**FinOps** é a disciplina que une finanças, engenharia e negócio para
tratar o custo da nuvem como uma responsabilidade compartilhada. Em vez
de olhar a fatura só no fim do mês, times que praticam FinOps criam um
ciclo contínuo de **visibilidade**, **otimização** e **governança** dos
gastos.

Este post cobre os três pilares do framework da FinOps Foundation
aplicados à AWS, as ferramentas nativas que a própria AWS oferece
(Cost Explorer, Budgets, CUR, Trusted Advisor, Compute Optimizer) e as
boas práticas de mercado para reduzir fatura sem travar entregas. Não
é um tutorial passo a passo de um serviço específico, é um guia de como
pensar e organizar o trabalho de custo na nuvem.

## O que é FinOps

A **FinOps Foundation** define FinOps como uma prática cultural e
operacional que traz accountability financeira ao modelo de gastos
variáveis da nuvem, permitindo que times distribuídos façam trade-offs
entre velocidade, custo e qualidade.

Três princípios resumem bem a filosofia:

- **Times compartilham a responsabilidade pelo custo**. Engenharia
  precisa saber quanto a feature que subiu ontem está custando. Finanças
  precisa entender como funciona pagamento por uso. Produto precisa
  decidir onde vale a pena gastar.
- **Decisões baseadas no valor para o negócio**. Reduzir custo não é o
  objetivo final, é consequência. O objetivo é usar a nuvem de forma
  eficiente para o que o negócio precisa.
- **Dados centralizados e acessíveis em tempo real**. Ninguém otimiza
  o que não enxerga. Dashboards, relatórios e alertas precisam estar
  disponíveis para quem toma decisão.

## Os três ciclos do FinOps

O framework oficial organiza a prática em três fases que se repetem em
ciclo, não uma única vez.

### Inform (visibilidade)

Entender para onde o dinheiro está indo. Alocação por time, produto,
ambiente. Previsibilidade. Benchmarks internos.

### Optimize (otimização)

Com os dados em mãos, identificar oportunidades: recursos ociosos,
rightsizing, compra de capacidade reservada, mudança de arquitetura.

### Operate (governança)

Transformar as decisões em prática contínua: políticas de tagging,
budgets automáticos, alertas de anomalia, revisões periódicas.

A ordem importa. Pular para "otimizar" sem antes "informar" costuma
gerar economia pontual que some no mês seguinte porque ninguém está
observando.

> [!NOTE] Framework oficial
> A documentação completa está em
> [FinOps Framework da FinOps Foundation](https://www.finops.org/framework/).
> A AWS mantém um
> [guia FinOps na AWS](https://aws.amazon.com/pt/architecture/well-architected/)
> dentro do pilar **Cost Optimization** do Well-Architected Framework.

## Pilar 1: visibilidade com Cost Explorer, CUR e tagging

Antes de qualquer otimização, você precisa enxergar o custo de forma
útil, ou seja, dividido pelos recortes que importam para o seu negócio.

### AWS Cost Explorer

É o ponto de partida. Interface web dentro do Billing que mostra custo
e uso dos últimos 13 meses (ou 38 meses se habilitar o histórico
estendido), com filtros por serviço, região, conta e tags.

Boas práticas:

- Habilite o Cost Explorer logo no dia zero da conta. O histórico só
  começa a ser construído depois de habilitado.
- Use a visão por **tag** sempre que possível. Sem tags, você só
  consegue separar custo por serviço, não por time ou produto.
- Ative **previsões** (forecast) para antecipar o fim do mês.

### Cost and Usage Report (CUR)

Para análises mais profundas, o **CUR** entrega os dados brutos de
custo e uso em um bucket S3, com granularidade por hora e por recurso.
É de onde saem os dashboards customizados do time de FinOps.

Combinações comuns:

- CUR + Amazon Athena para consultas SQL ad hoc.
- CUR + QuickSight para dashboards executivos.
- CUR + ferramentas externas (Vantage, CloudZero, Kubecost, etc.).

Se você só precisa criar o bucket S3 que recebe o CUR, veja o
[post sobre S3: bucket e upload via CLI/boto3](/posts/criando-primeiro-bucket-s3-boto3).

### Estratégia de tagging

**Tag é a cola do FinOps**. Sem uma estratégia consistente de tags,
alocação de custo por time ou produto vira trabalho manual.

Tags obrigatórias que recomendo em qualquer conta:

| Tag | Exemplo | Para quê |
| --- | --- | --- |
| `Environment` | `prod`, `staging`, `dev` | Separar custo por ambiente |
| `Owner` | `time-pagamentos` | Quem responde pelo recurso |
| `Project` | `checkout-v2` | Alocação por iniciativa |
| `CostCenter` | `cc-4210` | Rateio contábil |

Pontos de atenção:

- Tags só aparecem no Cost Explorer depois de ativadas em
  **Billing → Cost Allocation Tags**.
- Tags aplicadas depois não retroagem no custo. Comece cedo.
- Use **AWS Organizations SCPs** ou **Tag Policies** para forçar
  tagging em recursos novos.
- Para serviços que não suportam tags em todos os recursos (algumas
  features de IAM, por exemplo), use alocação por conta via
  **Organizations**.

## Pilar 2: governança com Budgets e Cost Anomaly Detection

Visibilidade sem alerta é dashboard bonito que ninguém olha. Governança
é o que transforma dado em ação.

### AWS Budgets

O **AWS Budgets** permite criar orçamentos por conta, serviço, tag ou
unidade organizacional, com alertas por e-mail ou SNS quando o custo
real ou previsto ultrapassa um limite.

Receita básica para começar:

- Um budget mensal **por conta** com alerta em 50%, 80% e 100% do
  previsto.
- Um budget mensal **por ambiente** (via tag `Environment`) separando
  prod de dev/staging.
- Um budget de **Savings Plans utilization** para garantir que a
  capacidade reservada está sendo usada.

> [!TIP] Budgets Actions
> O **AWS Budgets Actions** vai além do alerta: aplica uma SCP, pausa
> instâncias EC2 ou revoga permissões IAM quando o limite é batido.
> Útil em ambientes de experimentação onde o custo não pode escapar.

### Cost Anomaly Detection

Serviço gratuito baseado em machine learning que aprende o padrão de
gasto da conta e alerta quando algo foge da curva, por exemplo uma
instância que ficou ligada no fim de semana ou um bucket que começou a
receber tráfego inesperado.

Configure pelo menos um **monitor** por conta/serviço e um
**subscription** com alerta por e-mail. É um dos quick wins com maior
retorno pelo esforço de setup.

> [!WARNING] Anomaly Detection não substitui Budgets
> O Cost Anomaly Detection é reativo e sensível ao padrão histórico.
> Em contas novas sem histórico ele erra bastante. Use junto com
> Budgets, não em vez de.

### Trusted Advisor

Checklist automatizado que inclui verificações de **cost optimization**
(instâncias EC2 subutilizadas, volumes EBS não anexados, IPs elásticos
ociosos, Load Balancers sem targets, Reserved Instances expirando).

Com plano **Business** ou **Enterprise Support** você destrava todas as
checagens. No plano Basic/Developer você tem um subconjunto limitado.

## Pilar 3: otimização sem travar o time

Com visibilidade e governança no lugar, aí sim entra a conversa de
reduzir fatura. Em ordem de retorno sobre esforço:

### 1. Delete o que está ocioso

A economia mais barata é não pagar pelo que ninguém usa. Candidatos
típicos:

- Instâncias EC2, RDS e SageMaker Endpoints parados há dias.
- Volumes EBS não anexados.
- Snapshots antigos sem política de retenção.
- Load Balancers sem targets saudáveis.
- NAT Gateways em VPCs de teste esquecidas.
- IPs elásticos não associados.

Serviços gerenciados pagos por hora merecem atenção redobrada. O post
sobre
[SageMaker Endpoints na prática](/posts/sagemaker-endpoints-na-pratica)
mostra como um endpoint esquecido vira a maior linha da sua fatura em
dias.

### 2. Rightsizing com Compute Optimizer

O **AWS Compute Optimizer** analisa métricas do CloudWatch e recomenda
tamanhos menores (ou tipos diferentes) para EC2, EBS, Lambda, ECS no
Fargate e Auto Scaling Groups.

As recomendações já vêm com economia estimada em dólar por mês. Comece
olhando as recomendações classificadas como **over-provisioned** com
alta confiança, sem risco de performance.

### 3. Capacidade reservada: Savings Plans e Reserved Instances

Workloads estáveis que rodam 24/7 pagam até **72%** menos com commit
de 1 ou 3 anos. Dois sabores principais:

- **Compute Savings Plans**: flexível, cobre EC2, Fargate e Lambda,
  independente de família, região ou SO. Até 66% de desconto.
- **EC2 Instance Savings Plans**: amarrado a família de instância em
  uma região. Até 72% de desconto.
- **Reserved Instances**: modelo mais antigo, ainda útil para RDS,
  ElastiCache, OpenSearch, Redshift, DynamoDB, que não têm Savings
  Plans.

Boas práticas:

- Nunca compre commit sem **pelo menos 3 meses** de histórico estável.
- Comece com **1 ano, no-upfront**, mais seguro para quem ainda está
  calibrando.
- Monitore a **utilization** e **coverage** no Cost Explorer. Baixa
  utilization significa que você pagou por capacidade que não usou.

### 4. Spot Instances para workloads tolerantes

Instâncias **Spot** chegam a **90%** de desconto no on-demand, com a
contrapartida de poder serem interrompidas com 2 minutos de aviso.
Casos clássicos:

- Processamento batch (ETL, renders, build).
- Clusters Kubernetes com nodes stateless.
- Treinamento de modelos de ML tolerante a reinício (checkpointing).
- Ambientes de dev/CI.

### 5. Arquitetura serverless e managed

Nem toda otimização está em "pagar menos pelo mesmo recurso". Trocar
uma EC2 24/7 por uma Lambda que roda 100ms por request pode cortar
ordens de grandeza do custo, principalmente em workloads com uso
variável. Para começar com serverless, confira o
[post sobre AWS Lambda](/posts/aws-lambda-introducao).

Para serviços de IA, modelos sob demanda do Amazon Bedrock cobram por
token e dispensam a infra do SageMaker Endpoint. O
[post sobre Amazon Bedrock](/posts/amazon-bedrock-introducao) compara
os trade-offs entre as duas abordagens.

### 6. Mova dev/test para fora da AWS quando possível

Testes locais custam zero. Para integração contra serviços AWS sem
subir recurso real, use o LocalStack. Veja o
[post sobre LocalStack](/posts/localstack-testando-aws-localmente) para
começar.

## Observações importantes

Alguns pontos que costumam pegar quem começa com FinOps:

- **Data transfer é a linha mais ignorada da fatura**. Tráfego entre
  AZs, saída para internet e Cross-Region podem representar 20% ou
  mais do total. Trate como linha de custo própria.
- **S3 e CloudWatch Logs crescem silenciosamente**. Sem política de
  lifecycle (S3) ou retention (Logs), você paga pra sempre por dados
  que ninguém consulta mais.
- **Camada gratuita tem armadilhas**. Alguns serviços cobram tráfego
  mesmo dentro do free tier. Sempre confira a tabela de preços oficial
  antes de assumir "é grátis".
- **Multi-account via Organizations ajuda muito**. Separe prod, dev e
  sandbox em contas diferentes. Facilita alocação, limites e isolamento
  de blast radius.
- **FinOps é prática, não projeto**. Revisões mensais, cerimônias
  recorrentes com engenharia, metas por time. Sem ritual, o custo
  volta a crescer em três meses.

> [!TIP] Comece pequeno
> Não tente implantar tudo isso de uma vez. O ciclo mais eficiente
> para quem está começando é: ativar Cost Explorer e tags, criar
> Budgets por conta, revisar recursos ociosos, e só depois pensar em
> Savings Plans. Cada etapa já derruba fatura.

## Recapitulando

Você viu os três pilares do FinOps aplicados à AWS: **visibilidade**
com Cost Explorer, CUR e tagging, **governança** com Budgets, Cost
Anomaly Detection e Trusted Advisor, e **otimização** com rightsizing,
Savings Plans, Spot e revisão de arquitetura.

A ordem importa mais do que a ferramenta. Primeiro enxergue para onde
o dinheiro vai, depois crie alertas para não ser pego de surpresa, e
só então ataque a otimização com dados em mãos. FinOps bem feito é
ritmo, não evento: ciclo contínuo que roda todo mês, não uma força
tarefa que acontece quando a fatura assusta.

<!-- TODO: espaço reservado para print: dashboard do Cost Explorer com
custos agrupados por tag Environment ao longo de 6 meses -->
