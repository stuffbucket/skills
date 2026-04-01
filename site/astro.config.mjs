import { defineConfig } from 'astro/config';
import { resolve } from 'path';
import { codeInspectorPlugin } from 'code-inspector-plugin';

const GITHUB_USER = 'stuffbucket';
const REPO_NAME = 'skills';
const IS_USER_SITE = false;

export default defineConfig({
  site: `https://${GITHUB_USER}.github.io`,
  base: IS_USER_SITE ? '/' : `/${REPO_NAME}`,
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
  vite: {
    plugins: [codeInspectorPlugin({ bundler: 'vite' })],
    resolve: {
      alias: {
        '@skill-search': resolve('../plugins/stuffbucket/skills/skill-router/scripts/search.js'),
      },
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/, /skill-router\/scripts\/search/],
      },
    },
  },
});
