import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://arquitecloud.com/",
    title: "ArquiteCloud",
    description: "Conteúdo gratuito sobre AWS por Henrique Branco",
    author: "Henrique Branco",
    profile: "https://www.linkedin.com/in/henriqueajnb/",
    ogImage: "default-og.jpg",
    lang: "pt-BR",
    timezone: "America/Sao_Paulo",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: false,
    },
    search: "pagefind",
  },
  socials: [
    { name: "linkedin", url: "https://www.linkedin.com/in/henriqueajnb/" },
    { name: "github", url: "https://github.com/henry-branco" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail", url: "mailto:?subject=Veja%20este%20post&body=" },
  ],
});
