import { defineConfig } from '@antiwork/shortest';

export default defineConfig({
  testDir: './tests/shortest',
  headless: false,
  baseUrl: 'http://localhost:3000'
});
