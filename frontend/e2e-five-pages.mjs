import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173'
const screenshotDir = path.resolve('test-screenshots-e2e')
const pages = [
  ['/picks', '今日选股'],
  ['/review', '策略复盘'],
  ['/analytics', '策略分析'],
  ['/data', '数据中台'],
  ['/ops', '运行控制台'],
]

await fs.mkdir(screenshotDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const consoleErrors = []
const failedResponses = []

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})

page.on('response', response => {
  const status = response.status()
  const url = response.url()
  if (status >= 500 || (status >= 400 && !url.includes('/api/auth/me'))) {
    failedResponses.push({ status, url })
  }
})

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('input[type="text"]').fill('LBK')
  await page.locator('input[type="password"]').fill('123456')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/picks', { timeout: 15000 })
  await page.waitForLoadState('networkidle')

  const results = []
  for (const [route, label] of pages) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: path.join(screenshotDir, `${route.slice(1)}.png`), fullPage: true })
    const bodyText = await page.locator('body').innerText()
    results.push({
      route,
      label,
      url: page.url(),
      hasLabel: bodyText.includes(label),
      redirectedToLogin: page.url().includes('/login'),
      visibleTextLength: bodyText.length,
    })
  }

  const failedPages = results.filter(item => !item.hasLabel || item.redirectedToLogin || item.visibleTextLength < 20)
  const report = { success: failedPages.length === 0 && consoleErrors.length === 0 && failedResponses.length === 0, results, consoleErrors, failedResponses }
  console.log(JSON.stringify(report, null, 2))
  if (!report.success) process.exitCode = 1
} finally {
  await browser.close()
}
