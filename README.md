# ArquiteCloud

Blog com conteúdo gratuito sobre AWS em português, escrito por [Henrique Branco](https://www.linkedin.com/in/henriqueajnb/).

🌐 **Site:** <https://www.arquitecloud.com/>

## Stack

- [Astro](https://astro.build/) 7 + tema [AstroPaper](https://github.com/satnaing/astro-paper)
- Tailwind CSS 4
- MDX para posts com callouts, TOC e syntax highlighting (Shiki)
- Busca via [Pagefind](https://pagefind.app/)
- Deploy no AWS Amplify Hosting

## Como rodar

Requisitos: **Node.js ≥ 22.12**.

```bash
npm install
npm run dev        # servidor local em http://localhost:4321
npm run build      # build de produção + índice Pagefind
npm run preview    # preview do build
```

Outros scripts úteis:

```bash
npm run lint          # ESLint
npm run format        # Prettier
npx astro check       # checagem de tipos
```

## Estrutura

```text
src/
├── content/posts/    # posts do blog (.md/.mdx)
├── components/       # componentes Astro
├── layouts/          # layouts de página
├── pages/            # rotas
└── utils/            # helpers

astro-paper.config.ts # configuração do site (título, socials, features)
astro.config.ts       # configuração do Astro
```

## Criando um post

Adicione um arquivo em `src/content/posts/` seguindo o schema definido em `src/content.config.ts`. O alias `@/*` aponta para `./src/*`.

## Contribuindo

Contribuições são muito bem-vindas! Você pode ajudar de três formas:

- 🐛 **Abrir uma [issue](https://github.com/henry-branco/arquitecloud/issues)** para reportar bugs, apontar erros em posts ou sugerir novos temas.
- 🔧 **Abrir um Pull Request** para corrigir typos, links quebrados, exemplos de código ou propor posts novos.
- 💬 **Mandar mensagem no [LinkedIn](https://www.linkedin.com/in/henriqueajnb/)** com sugestões de temas, feedback ou correções (ótima opção para quem prefere não usar o GitHub).

Toda sugestão de conteúdo sobre AWS é bem-vinda: de serviço específico a padrões de arquitetura, boas práticas ou casos de uso reais.

## Prints pendentes

Placeholders de print ainda não substituídos por imagens reais. Cada item leva à linha original do comentário no arquivo.

### Como adicionar um print

1. **Salve o arquivo** em `src/assets/posts/{slug-do-post}/` com o nome `L{linha}-{slug-curto}.png`.

   Exemplo para o item da linha 49 do post de Lambda:
   ```
   src/assets/posts/aws-lambda-introducao/L49-fluxo-invocacao.png
   ```

2. **Substitua o comentário TODO** no post pelo Markdown de imagem com caminho relativo:

   ```md
   ![Descrição do print](../../assets/posts/aws-lambda-introducao/L49-fluxo-invocacao.png)
   ```

3. **Marque o item abaixo** como concluído: troque `- [ ]` por `- [x]`.

### AWS Lambda — Introdução

- [ ] [Diagrama de fluxo de invocação: event source → Lambda → execução → resposta](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/aws-lambda-introducao.md#L49)
- [ ] [Tela de criação da função com os campos preenchidos antes de confirmar](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/aws-lambda-introducao.md#L68)
- [ ] [Resultado da execução do teste no console, mostrando o painel de resposta com status 200](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/aws-lambda-introducao.md#L109)

### Amazon SageMaker AI — Introdução

- [ ] [Tela do SageMaker Studio no console da AWS, mostrando o Code Editor aberto](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/amazon-sagemaker-ai-introducao.md#L65)
- [ ] [Lista de Training Jobs no console do SageMaker, com status e duração de cada run](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/amazon-sagemaker-ai-introducao.md#L104)
- [ ] [Interface do MLflow mostrando a comparação de runs com métricas e parâmetros](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/amazon-sagemaker-ai-introducao.md#L151)
- [ ] [Grafo de um pipeline no console do SageMaker, mostrando os steps conectados](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/amazon-sagemaker-ai-introducao.md#L175)

### Criando seu primeiro bucket S3 com boto3

- [ ] [Console S3 mostrando o bucket criado](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/criando-primeiro-bucket-s3-boto3.md#L82)
- [ ] [Bucket no console mostrando o arquivo enviado](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/criando-primeiro-bucket-s3-boto3.md#L116)
- [ ] [Aba Permissions com o Block Public Access ativado](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/criando-primeiro-bucket-s3-boto3.md#L209)

### Publicando site no AWS Amplify Hosting

- [ ] [Tela de seleção de repositório e branch no Amplify](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/publicando-site-aws-amplify-hosting.md#L91)
- [ ] [Console do Amplify com as quatro etapas do build concluídas](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/publicando-site-aws-amplify-hosting.md#L161)
- [ ] [Registro de domínio no Route 53, com o resultado da busca de disponibilidade](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/publicando-site-aws-amplify-hosting.md#L258)
- [ ] [Tela de Domain management com o domínio configurado](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/publicando-site-aws-amplify-hosting.md#L318)

### SageMaker Endpoints na prática

- [ ] [Tela de criação da IAM Role com o trusted entity SageMaker selecionado](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/sagemaker-endpoints-na-pratica.md#L75)
- [ ] [Bucket S3 mostrando o arquivo model.tar.gz na pasta modelos/linear/](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/sagemaker-endpoints-na-pratica.md#L246)
- [ ] [Aba Models do SageMaker no console, com a lista de modelos registrados](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/sagemaker-endpoints-na-pratica.md#L266)
- [ ] [Model registrado aparecendo na lista de Models do SageMaker](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/sagemaker-endpoints-na-pratica.md#L322)
- [ ] [Endpoint Configuration criada, listada no console do SageMaker](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/sagemaker-endpoints-na-pratica.md#L369)
- [ ] [Endpoint com status "Creating" no console do SageMaker](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/sagemaker-endpoints-na-pratica.md#L407)
- [ ] [Endpoint com status "InService" no console do SageMaker](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/sagemaker-endpoints-na-pratica.md#L409)
- [ ] [Output do terminal mostrando o resultado da invocação](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/sagemaker-endpoints-na-pratica.md#L463)
- [ ] [Endpoint com status "Deleting" no console do SageMaker](https://github.com/henry-branco/arquitecloud/blob/main/src/content/posts/sagemaker-endpoints-na-pratica.md#L502)

## Licença

Conteúdo © Henrique Branco. Tema baseado no [AstroPaper](https://github.com/satnaing/astro-paper) (MIT).
