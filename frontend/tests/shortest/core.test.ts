import { shortest } from '@antiwork/shortest';

shortest('Navigate to the app and verify the main title', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.expect('the main title "SpeechFlow" is visible in the sidebar');
});

shortest('Check if user can open settings', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.action('Click on the settings button');
  await page.expect('A settings dialog modal appears on the screen');
});
