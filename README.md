# ArquiteCloud

Blog com conteúdo gratuito sobre AWS em português, escrito por [Henrique Branco](https://www.linkedin.com/in/henriqueajnb/).

🌐 **Site:** <https://main.d24bpvjwpji1xz.amplifyapp.com/>

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

## Licença

Conteúdo © Henrique Branco. Tema baseado no [AstroPaper](https://github.com/satnaing/astro-paper) (MIT).
