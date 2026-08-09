---
title: "Amplify Hosting: publicando um site estático com deploy automático"
description: "Publique um site estático na AWS Amplify Hosting com HTTPS, CDN global e deploy automático a cada git push."
pubDatetime: 2026-08-07T12:00:00.000Z
tags: ["amplify", "hosting", "deploy", "nivel-200"]
---

Este post parte de um pressuposto: **o seu site já está pronto**. Não vamos
falar de como estruturar páginas, escrever conteúdo em Markdown ou
configurar tema no [Astro](https://astro.build/), isso é assunto para
outro post. Aqui o foco é só a publicação: pegar um site estático já
construído (no nosso caso, gerado pelo Astro, o mesmo gerador que produz
este próprio blog) e colocá-lo no ar através do **AWS Amplify Hosting**, com
HTTPS, CDN global e deploy automático a cada `git push`.

Se está curioso para saber inclusive como eu coloquei esta página no ar na AWS,
este post é para você.

## O que é o Amplify Hosting

O Amplify Hosting é o serviço da AWS voltado para publicar aplicações web,
sites estáticos, SPAs, apps com server-side rendering. Na prática, ele faz
três coisas por você:

1. **Builda o seu projeto** a partir de um repositório git (GitHub, GitLab,
   Bitbucket ou AWS AWS CodeCommit), seguindo um passo a passo que você define.
2. **Publica o resultado** em uma CDN global (CloudFront por baixo dos
   panos), com HTTPS automático via certificado gerenciado.
3. **Reconstrói e republica automaticamente** toda vez que você faz push
   numa branch conectada, isso é CI/CD de graça, sem precisar montar
   pipeline nenhum.

> [!NOTE] Amplify Hosting não é o mesmo que o framework "AWS Amplify"
> A AWS também vende "Amplify" como um framework fullstack (Amplify Gen 2),
> com backend, autenticação, banco de dados etc. Neste post estamos usando
> só a parte de **Hosting**: publicar arquivos estáticos já prontos. Você
> não precisa de nenhuma das outras funcionalidades do Amplify para seguir
> este guia.

## Pré-requisitos

- **Uma conta AWS.** A mesma que você já usa para outros serviços serve
  aqui, não precisa de nada especial.
- **Um site estático pronto para build**, ou seja, um projeto que tenha um
  comando que gere uma pasta com HTML/CSS/JS estático a partir do seu
  conteúdo. No caso deste blog, isso é feito com o próprio Astro:

  ```bash
  npm run build
  ```

  Esse comando gera a pasta `dist/`, com tudo que precisa para o site
  funcionar: HTML, CSS, assets, `sitemap.xml`, até uma página `404.html`
  pronta. É exatamente essa pasta que vamos publicar.

- **O projeto em um repositório git**, hospedado no GitHub, GitLab,
  Bitbucket ou AWS CodeCommit. A Amplify Hosting builda direto do repositório,
  então ele precisa estar lá, não precisa estar público, contas privadas
  funcionam normalmente.

## Duas formas de publicar

O Amplify Hosting oferece dois caminhos:

- **Deploy manual (drag and drop).** Você builda o site na sua máquina e
  arrasta a pasta resultante (ou um `.zip` dela) direto no console da AWS.
  Rápido para testar, mas manual: toda mudança exige repetir o processo à
  mão.
- **Deploy conectado ao git (recomendado).** Você conecta o repositório uma
  vez, e a partir daí todo `git push` numa branch conectada dispara um build
  e um deploy novos, automaticamente. É o caminho que vamos seguir aqui,
  porque é o que faz sentido para um blog que vai receber posts novos com
  frequência.

## Passo 1: conectando o repositório

No console da AWS, procure por **Amplify** e entre no serviço. Clique em
**Criar novo app** (ou **New app** → **Host web app**, dependendo do idioma
do console) e escolha o provedor do seu repositório, no nosso caso,
**GitHub**.

Na primeira vez, a AWS pede para autorizar o **Amplify GitHub App** na sua
conta do GitHub. Essa autorização é o que permite a Amplify ler o código do
repositório e detectar automaticamente quando há um push novo.

Depois de autorizado, selecione:

- O **repositório** (no nosso caso, `henry-branco/arquitecloud`).
- A **branch** que vai ser publicada (`main`).

<!-- TODO: espaço reservado para print: tela de seleção de repositório e branch no Amplify -->

## Passo 2: configurando o build

Aqui está o único ponto onde o Amplify Hosting exige atenção extra no nosso
caso: por padrão, ele tenta detectar automaticamente o tipo de projeto, e
mesmo para um projeto Node/Astro vale a pena declarar o passo a passo do
build explicitamente, em vez de depender só da detecção automática.

Isso é feito num arquivo chamado `amplify.yml`. Você pode colar o conteúdo
direto no editor do console (na etapa "Configurações de build"), mas o mais
correto é versionar esse arquivo na raiz do repositório, assim ele fica
documentado e rastreável junto com o resto do projeto, igual qualquer outra
configuração de infraestrutura:

```yaml
# amplify.yml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

Explicando cada parte:

- **`preBuild`** roda `npm ci`, que instala as dependências do projeto a
  partir do `package.json`/`package-lock.json` (é o equivalente, para Node,
  do que `pip install` é para Python: instala exatamente as versões travadas
  no lockfile).
- **`build`** roda o comando que efetivamente gera o site estático.
- **`artifacts.baseDirectory`** diz para o Amplify onde está o resultado do
  build, no nosso caso, a pasta `dist/` que o Astro gera. É o conteúdo dessa
  pasta que vai para a CDN.
- **`cache.paths`** guarda o `node_modules` entre builds, o que deixa os
  próximos deploys mais rápidos (não precisa reinstalar tudo do zero toda
  vez).

Se o `amplify.yml` estiver commitado no repositório, o Amplify o detecta
sozinho. Se você colou direto no console, ele fica salvo nas configurações
do app (mas não versionado com o resto do código, prefira o arquivo).

> [!TIP] E a versão do Node?
> O `amplify.yml` acima não fixa uma versão do Node em lugar nenhum, o que
> significa que a Amplify usa a versão padrão da imagem de build dela (em
> geral, uma LTS recente). Se o seu projeto precisar de uma versão
> específica, duas formas simples de garantir isso: declarar um `engines.node`
> no `package.json` (o nosso já declara `>=22.12.0`) ou adicionar um comando
> `nvm install`/`nvm use` no `preBuild` do `amplify.yml`. Isso evita
> surpresas se a imagem padrão da Amplify mudar de versão no futuro.

## Passo 3: deploy

Com o build configurado, clique em **Salvar e implantar**. O Amplify roda
quatro etapas visíveis no console: **Provision** → **Build** → **Deploy** →
**Verify**. Dá para acompanhar o log de cada uma em tempo real, o que ajuda
bastante se algo falhar, geralmente é erro de dependência ou de comando no
`amplify.yml`, e o log aponta exatamente a linha.

<!-- TODO: espaço reservado para print: console do Amplify com as quatro etapas do build concluídas -->

Quando as quatro etapas ficarem verdes, o site já está no ar, em uma URL
gerada automaticamente pela AWS, no formato:

```bash
https://main.d1a2b3c4d5e6f7.amplifyapp.com
```

Vale conferir também a página de erro: como o Astro já gera um `404.html`
dentro da pasta `dist/`, o Amplify serve esse arquivo automaticamente
quando alguém acessa uma URL que não existe, não precisa configurar nenhuma
regra de rewrite para isso.

## Deploy automático a cada push

A partir daqui, publicar um post novo é só:

```bash
git add .
git commit -m "novo post sobre X"
git push
```

O push na branch conectada (`main`, no nosso caso) dispara sozinho um novo
build e um novo deploy, sem precisar entrar no console, sem repetir passo
nenhum manualmente. É a mesma diferença entre subir arquivo no S3 na mão
(como fizemos no post anterior) e ter um pipeline automatizado: aqui, o
"pipeline" já vem pronto por conta de estar conectado ao git.

Se algum deploy quebrar alguma coisa, a aba de histórico de builds do app
tem um botão **Redeploy this version** em cima de qualquer build anterior,
um jeito rápido de voltar para uma versão que funcionava, sem precisar
reverter commit no git.

## Quanto custa manter o site no ar?

Com o deploy automático funcionando, vale a pergunta óbvia: quanto isso
custa? Pra um blog do tamanho deste, a resposta curta é **praticamente
nada**, mas vale entender de onde vem cada centavo, porque o Amplify
Hosting cobra por uso (pay-as-you-go, sem mensalidade fixa). Os valores
abaixo são os oficiais da AWS em agosto de 2026:

- **Minutos de build.** Cada deploy consome minutos de build (o tempo que o
  `preBuild` + `build` do `amplify.yml` levam para rodar). Os primeiros
  1.000 minutos por mês entram na camada gratuita da instância padrão (8 GB
  de memória, 4 vCPUs); depois disso, **\$0,01 por minuto**. Um build deste
  blog leva menos de um minuto no total.
- **Armazenamento na CDN.** Os arquivos publicados (o conteúdo da pasta
  `dist/`) ficam guardados na CDN da Amplify. Os primeiros 5 GB por mês são
  gratuitos; depois, **\$0,023 por GB**. Um blog em Markdown, sem vídeo
  pesado, dificilmente passa de alguns megabytes.
- **Transferência de dados (tráfego).** Cada visita consome dados
  transferidos da CDN até quem acessa. Os primeiros 15 GB por mês são
  gratuitos; depois, **\$0,15 por GB**. Como referência, se cada página
  pesar uns 200 KB, 15 GB cobrem algo como 75 mil visualizações de página
  por mês.

Fazendo as contas: publicar um post novo (uma atualização) consome poucos
minutos de build, então custa **\$0** por atualização, na prática. E manter
o site no ar, dentro dessas faixas de uso, também fica em **\$0/mês**.

> [!TIP] E se a camada gratuita não valer mais para a sua conta?
> A AWS reestruturou o programa de free tier em 2025, então vale conferir
> as condições atuais na [página de preços do Amplify
> Hosting](https://aws.amazon.com/amplify/pricing/) antes de assumir que
> está tudo gratuito. Mas mesmo no cenário mais pessimista, sem nenhuma
> camada gratuita, os valores de pay-as-you-go já são baixos por si só:
> alguns minutos de build por mês, poucos MB armazenados e uns 2 GB de
> tráfego mensal (bastante para um blog pessoal) somados dão uma conta na
> casa de **poucos centavos de dólar por mês**, não dezenas de dólares.

## Comprando um domínio pela própria AWS (Route 53)

Até aqui o site está no ar, mas na URL gerada pela Amplify (algo como
`main.d1a2b3c4d5e6f7.amplifyapp.com`). Se você ainda não tem um domínio
próprio, a forma mais direta de comprar um sem sair da AWS é pelo
**Route 53**, o serviço de DNS e registro de domínios da AWS, que também
funciona como registrador (o "cartório" que registra o domínio no seu
nome).

O passo a passo:

1. No console da AWS, acesse **Route 53 → Domínios registrados → Registrar
   domínio**.
2. Digite o nome desejado (ex: `arquitecloud.com`) e a AWS mostra na hora
   se está disponível, junto com o preço da extensão (TLD) escolhida.
3. Adicione ao carrinho, preencha os dados de contato (nome, e-mail,
   endereço, é o que vai para o WHOIS do domínio) e, se o TLD suportar,
   ative a proteção de privacidade (esconde seus dados pessoais da consulta
   pública de WHOIS; a maioria dos TLDs genéricos suporta, sem custo
   extra).
4. Finalize a compra. O pagamento vai direto na forma de pagamento já
   cadastrada na sua conta AWS, e o domínio costuma ficar ativo em poucos
   minutos.

<!-- TODO: espaço reservado para print: registro de domínio no Route 53, com o resultado da busca de disponibilidade -->

Depois de comprado, se você apontar o domínio para o Amplify seguindo a
seção **Apontando o domínio para o Amplify**, logo abaixo, a configuração
fica ainda mais simples: como o domínio já está registrado na Route 53, a
Amplify cria os registros de DNS necessários automaticamente, sem precisar
copiar CNAME manualmente em lugar nenhum.

### Quanto custa um domínio?

O preço varia por extensão (TLD) e é cobrado **por ano**, renovando
automaticamente (a não ser que você desative a renovação automática).
Alguns valores oficiais da Route 53 em agosto de 2026, para referência:

- `.com` — \$16/ano
- `.net` — \$17/ano
- `.org` — \$16/ano
- `.dev` — \$17/ano
- `.app` — \$20/ano
- `.cloud` — \$26/ano
- `.tech` — \$49/ano
- `.io` — \$71/ano
- `.ai` — \$137/ano

> [!WARNING] .com.br não dá para comprar pela Route 53
> Se você, como eu, pensou em registrar um `.com.br`: a Route 53 **não
> aceita registros novos** dessa extensão, ela só processa renovação de
> domínios `.com.br` que você já tenha. É uma particularidade da extensão
> brasileira, que exige registro através do [Registro.br](https://registro.br/),
> o registro oficial no Brasil (com CPF ou CNPJ). Nesse caso, o fluxo muda
> um pouco: você registra o domínio direto no Registro.br (custo bem menor,
> na faixa de R\$40/ano) e depois aponta o DNS dele para o Amplify
> manualmente, seguindo a seção de **Apontando o domínio para o Amplify**
> abaixo, exatamente como faria com qualquer domínio comprado fora da AWS.

Vale lembrar também que, se você usar a Route 53 como DNS do domínio (o que
acontece automaticamente se comprar por lá), existe um custo separado e bem
pequeno: **\$0,50 por mês por hosted zone** (nas primeiras 25) e **\$0,40 por
milhão de consultas de DNS**. Para um blog pessoal, isso fica na casa de
centavos por mês, na prática, o domínio em si costuma pesar mais no bolso
do que o DNS.

## Apontando o domínio para o Amplify

Por padrão, o site fica disponível na URL gerada pela Amplify
(`*.amplifyapp.com`), mas o normal é apontar um domínio próprio, seja ele
comprado na Route 53 (seção anterior) ou em outro provedor. Isso é feito
em **App settings → Domain management → Add domain**:

1. Digite o domínio (ex: `arquitecloud.com.br`).
2. Escolha quais subdomínios apontar para qual branch, o mais comum é
   apontar o domínio raiz e o `www` para a branch `main`.
3. Se o domínio estiver registrado na Route 53, a Amplify configura os
   registros de DNS automaticamente. Se estiver em outro provedor
   (Registro.br, GoDaddy, etc.), ela mostra os registros CNAME que você
   precisa cadastrar manualmente no painel de DNS do seu provedor.
4. Aguarde a propagação e a emissão do certificado SSL, feita
   automaticamente via AWS Certificate Manager, geralmente em minutos, mas
   pode levar algumas horas dependendo do provedor de DNS.

<!-- TODO: espaço reservado para print: tela de Domain management com o domínio configurado -->

> [!TIP] Não esqueça da URL do site
> Depois que o domínio customizado estiver funcionando, atualize o campo
> `site.url` no `astro-paper.config.ts` do projeto (ele normalmente fica com
> um valor de placeholder até esse ponto). Esse campo é usado para gerar o
> `sitemap.xml` e as URLs canônicas corretamente, o que importa para SEO.
> Depois de mudar, é só commitar e dar push, o deploy automático cuida do
> resto.

## Observações importantes

- **Apague branches de preview que não usa mais.** Cada branch conectada ao
  Amplify gera builds próprios (e consome minutos de build). Se você criar
  branches de teste conectadas ao app, lembre de desconectá-las depois,
  assim como bucket de teste esquecido no S3, branch de preview esquecida é
  uma forma comum de gastar sem perceber.
- **Domínio é custo recorrente e separado da hospedagem.** Mesmo que a
  hospedagem em si fique em \$0/mês, o domínio renova sozinho todo ano e é
  cobrado independente de você usar Amplify, S3 ou qualquer outra coisa por
  trás dele. Vale anotar a data de renovação, principalmente se desativar a
  renovação automática.

## Recapitulando

Você conectou um repositório git ao Amplify Hosting, configurou o build de
um projeto Node/Astro através de um `amplify.yml`, fez o primeiro deploy e
configurou deploy automático a cada push. Também viu quanto custa manter
isso tudo no ar (na prática, perto de \$0 para um blog pequeno) e como
comprar e apontar um domínio próprio, seja pela Route 53 ou por outro
registrador. A partir de agora, publicar conteúdo novo no site é só dar
push: o Amplify cuida de buildar e colocar no ar.
