# Instruções gerais

## Texto

- Escreva em tom natural.
- Não use traços nos textos.

## Desenvolvimento

Ao iniciar o servidor de desenvolvimento, use o modo background:

```bash
astro dev --background
```

Gerencie o servidor em background com `astro dev stop`, `astro dev status` e `astro dev logs`.

## Convenções do projeto

- Blog em **pt-BR** (tema AstroPaper). Todo o conteúdo voltado ao leitor final deve ser escrito em português do Brasil.
- Alias de import: `@/*` mapeia para `./src/*` (definido no `tsconfig.json`). Prefira `@/...` em vez de caminhos relativos longos.
- TypeScript em modo `strict` (via `astro/tsconfigs/strict`). Rode `astro check` antes de considerar uma alteração pronta.
- Lint: `npm run lint` (ESLint). Formatação: `npm run format` (Prettier, com plugins para Astro e Tailwind).
- Build gera o índice de busca com Pagefind e copia para `public/pagefind`. Não edite `public/pagefind` manualmente.

## Documentação

Documentação completa do Astro: <https://docs.astro.build>

Consulte estes guias antes de trabalhar em tarefas relacionadas:

- [Adicionar páginas, rotas dinâmicas ou middleware](https://docs.astro.build/en/guides/routing/)
- [Trabalhar com componentes Astro](https://docs.astro.build/en/basics/astro-components/)
- [Usar componentes React, Vue, Svelte ou de outros frameworks](https://docs.astro.build/en/guides/framework-components/)
- [Adicionar ou gerenciar conteúdo](https://docs.astro.build/en/guides/content-collections/)
- [Adicionar estilos ou usar Tailwind](https://docs.astro.build/en/guides/styling/)
- [Suporte a múltiplos idiomas](https://docs.astro.build/en/guides/internationalization/)
