import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'

const svg = readFileSync('/Users/libokai/IdeaProjects/QuantForge/frontend/public/assets/alphapick-icon.svg', 'utf8')
const html = `<!DOCTYPE html><html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="1024" height="1024"></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } })
await page.setContent(html)
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/alphapick-icon.png' })
await browser.close()
console.log('done')
