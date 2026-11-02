import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'orasna',
  description: 'Zero-dependency helpers on top of the native JavaScript Temporal API',
  // GitHub Pages serves the site from https://kosinix.github.io/orasna/
  base: '/orasna/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/compare' },
      { text: 'Recipes', link: '/guide/recipes' },
      { text: 'Changelog', link: 'https://github.com/kosinix/orasna/blob/master/CHANGELOG.md' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Why orasna', link: '/guide/why' },
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Recipes', link: '/guide/recipes' },
          { text: 'Errors', link: '/guide/errors' },
          { text: 'Already in Temporal', link: '/guide/already-in-temporal' },
        ],
      },
      {
        text: 'API',
        items: [
          { text: 'compare', link: '/api/compare' },
          { text: 'calendar', link: '/api/calendar' },
          { text: 'span', link: '/api/span' },
          { text: 'format', link: '/api/format' },
          { text: 'interval', link: '/api/interval' },
          { text: 'clock', link: '/api/clock' },
          { text: 'business', link: '/api/business' },
          { text: 'interop', link: '/api/interop' },
          { text: 'db', link: '/api/db' },
        ],
      },
    ],
    outline: 'deep',
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/kosinix/orasna' }],
    editLink: {
      pattern: 'https://github.com/kosinix/orasna/edit/master/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Released under the MIT License.',
    },
  },
});
