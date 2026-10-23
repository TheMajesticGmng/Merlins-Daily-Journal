import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'merlins-daily-handbook';
export default defineConfig({plugins:[react()],base: process.env.GITHUB_PAGES === 'true' ? `/${repository}/` : '/'});
