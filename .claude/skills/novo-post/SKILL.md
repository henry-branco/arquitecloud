---
name: novo-post
description: Cria um post novo do blog arquitecloud em src/content/posts/ seguindo o schema, o tom e as convenções do projeto (frontmatter, asides, placeholders de print, tag de nível). Use quando o usuário pedir para criar, escrever, começar ou rascunhar um post/artigo do blog.
---

# novo-post

Guia para criar um post no blog arquitecloud (Astro + AstroPaper, pt-BR). Siga este fluxo passo a passo.

## Fluxo

### 0. Levantar posts existentes

Antes de qualquer outra coisa, liste os posts já publicados:

```bash
ls src/content/posts
```

Para cada post existente, você precisa saber (abra os que parecerem
relevantes ao tema do novo post) qual serviço/conceito ele cobre e seu
slug (nome do arquivo sem `.md`). Isso alimenta a etapa de links internos
no passo 4.

### 1. Coletar mínimo necessário

Pergunte ao usuário (em uma única rodada, curto):

- **Tema** do post.
- **Envolve serviço AWS pago por hora?** (SageMaker Endpoint, EC2, RDS, etc.) — decide se entra a seção de custo com `> [!WARNING]` no topo.

**Não pergunte o nível** — ele é atribuído na etapa 5, depois do post pronto.

### 2. Propor metadados

Antes de criar o arquivo, mostre ao usuário para confirmar (uma linha cada):

- **Slug** (nome do arquivo, kebab-case, sem acento): ex. `criando-primeiro-bucket-s3-boto3`.
- **Título**: frase completa, pode ter dois pontos separando o "o quê" do "para quê" (ex. `"S3: bucket e upload via CLI/boto3"`).
- **Description**: uma frase, objetiva, ~120-160 caracteres, aparece em SEO/OG.
- **Tags de tecnologia** (kebab-case, sem tag de nível ainda): ex. `["s3", "boto3"]`.

### 3. Criar o arquivo

Path: `src/content/posts/<slug>.md`

Frontmatter obrigatório (schema em `src/content.config.ts`):

```yaml
---
title: "<título>"
description: "<description>"
pubDatetime: <ISO com hora, ex. 2026-08-08T12:00:00.000Z — use a data de hoje>
tags: ["<tag1>", "<tag2>"]
---
```

Opcionais que só se usam quando fizer sentido: `modDatetime`, `featured: true`, `draft: true`, `ogImage`, `canonicalURL`. Não preencha `author` — cai no default de `astro-paper.config.ts`.

Depois do frontmatter, gere o **esqueleto de seções** adaptado ao tema:

1. **Parágrafo de abertura**: define o serviço/assunto em 2-4 linhas, diz o que o post cobre e o que não cobre.
2. `## Custo: leia isso antes de executar qualquer comando` — **apenas se o serviço cobra por hora**. Use `> [!WARNING]` explicando por que o custo é diferente de pay-as-you-go, tabela de instâncias/preços com `\$` escapado, e a regra "delete ao terminar". Para serviços pay-as-you-go baratos, pule aqui e coloque `## Quanto custa manter isso no ar` mais para o fim.
3. `## Pré-requisitos` — lista com marcador, tipicamente conta AWS, CLI configurada, linguagem/versão, dependências.
4. Seções de conteúdo: `## Passo 1: <ação>`, `## Passo 2: <ação>` quando o fluxo é linear. Títulos temáticos quando for conceitual.
5. `## Observações importantes` — armadilhas, custos ocultos, limpeza de recursos.
6. `## Recapitulando` — 3-5 linhas fechando o que o leitor fez.

### 4. Escrever iterativamente

- Depois de criar o esqueleto, **não** despeje o post inteiro numa tacada. Escreva seção por seção, pedindo confirmação/ajuste antes de seguir. A redação é o ponto em que o usuário quer ir e vir.

- O texto do arquivo `.md` do post deve respeitar o limite máximo de 80 caracteres por linha. Se passar disso, adicione uma quebra de linha.

- **Links internos obrigatórios**: sempre que o texto mencionar um
  serviço, conceito ou passo que já é coberto por outro post existente
  (levantados no passo 0), transforme a primeira menção relevante em
  link para esse post. Exemplo: um post novo sobre SageMaker que manda
  subir o artefato do modelo para um bucket cita o post de S3:

  ```markdown
  Suba o artefato do modelo para um [bucket S3](/posts/criando-primeiro-bucket-s3-boto3)
  antes de configurar o Model do SageMaker.
  ```

  - URL do link: `/posts/<slug>` (o slug é o nome do arquivo sem
    `.md`; ver `getPostUrl` em `src/utils/getPostPaths.ts`).
  - Linke só a **primeira** menção relevante do conceito no post, não
    toda ocorrência.
  - Só linke se o post existente realmente cobrir o que está sendo
    citado; não force o link em menções genéricas demais.
  - Isso não é opcional nem depende do usuário pedir: é padrão do
    projeto, sempre que fizer sentido.

### 5. Atribuir a tag de nível (obrigatório antes de fechar)

Quando o corpo do post estiver escrito, avalie o nível **a partir do conteúdo real**:

- **nivel-100** — primeiro contato com o serviço, pré-requisitos mínimos, um único conceito central (ex. criar bucket S3 + upload).
- **nivel-200** — combina serviços ou envolve configuração não trivial (ex. Amplify Hosting com build customizado, DNS, domínio).
- **nivel-300** — exige conhecimento prévio de outros serviços, arquitetura em várias peças, ou gotchas relevantes de custo/operação (ex. SageMaker Endpoint com Model + Endpoint Configuration + IAM).

Justifique em uma linha para o usuário confirmar, então edite o frontmatter adicionando `nivel-<N>` ao array `tags` (é a última tag, depois das de tecnologia).

### 6. Validar

Rode:

```bash
npx astro check
```

Precisa passar sem erros de content collection (o schema é validado aqui).

## Regras de tom e estilo

Aplicam a todo o corpo do post.

- **pt-BR sempre**.
- Conversacional em "você" / "vamos" / "vale a pena". Didático, explica o *porquê*, não só o *como*.
- **Sem travessão (—)** — não soa natural em português. Use vírgula, dois pontos, parênteses ou reescreva.
- **Negrito liberal** em termos-chave na primeira aparição (`**bucket**`, `**Amplify Hosting**`).
- Ao citar preço em dólar, sempre escape: `\$0,15`, `\$16/ano`. Sem escape o Markdown pode entrar em math mode.
- Datas de referência de preço explícitas: "os valores oficiais da AWS em agosto de 2026".
- Links externos com texto descritivo, não "clique aqui": `[página de preços do Amplify Hosting](https://...)`.

## Elementos MDX

### Asides

Sempre com título curto na mesma linha do marcador:

```markdown
> [!NOTE] Título curto
> Corpo da nota em uma ou mais linhas, também em blockquote.

> [!TIP] Título curto
> Dica prática, atalho, gotcha positivo.

> [!WARNING] Título curto
> Alerta de custo, perda de dados, decisão irreversível.
```

Use `[!WARNING]` para custos por hora, deleções irreversíveis e limites da camada gratuita. Use `[!TIP]` para atalhos e "coisa boa de saber". Use `[!NOTE]` para desambiguação ou contexto lateral.

### Placeholders de print

Sempre no formato:

```markdown
<!-- TODO: espaço reservado para print: <descrição curta em pt-BR do que a imagem mostra> -->
```

Coloque logo abaixo do parágrafo/passo em que o print faria sentido. Não gere imagens — só o placeholder.

### Blocos de código

Sempre com linguagem: `bash`, `yaml`, `python`, `json`, `typescript`. Se não houver linguagem no bloco, escreva `text` (alguma saída de código por exemplo).

Quando o bloco representa um arquivo, primeira linha é comentário com o nome:

```yaml
# amplify.yml
version: 1
frontend:
  ...
```

Explique cada parte relevante do bloco depois dele, em bullets ou parágrafo.

## Referências rápidas

- Schema completo: `src/content.config.ts:10-24`.
- Exemplos de estilo/estrutura consolidados: `src/content/posts/criando-primeiro-bucket-s3-boto3.md`, `src/content/posts/publicando-site-aws-amplify-hosting.md`, `src/content/posts/sagemaker-endpoints-na-pratica.md`.
- Regras gerais do projeto (dev server, lint, `astro check`): `CLAUDE.md` na raiz.
