import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:5173/');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'C:/Users/Administrator/Desktop/quantforge_home.png', fullPage: true });
console.log('✅ 首页截图完成 (quantforge_home.png)');

await page.goto('http://localhost:5173/login');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);
await page.screenshot({ path: 'C:/Users/Administrator/Desktop/quantforge_login.png', fullPage: true });
console.log('✅ 登录页截图完成 (quantforge_login.png)');

await page.goto('http://localhost:5173/register');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);
await page.screenshot({ path: 'C:/Users/Administrator/Desktop/quantforge_register.png', fullPage: true });
console.log('✅ 注册页截图完成 (quantforge_register.png)');

await browser.close();
