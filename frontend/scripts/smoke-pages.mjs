import { spawn, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const PORT = 5188
const BASE_URL = `http://127.0.0.1:${PORT}`

function startVite() {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: new URL('..', import.meta.url),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', chunk => process.stdout.write(chunk))
  child.stderr.on('data', chunk => process.stderr.write(chunk))
  return child
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/login`)
      if (res.ok) return
    } catch {
      // Vite is still starting.
    }
    await delay(250)
  }
  throw new Error('Vite smoke server did not start')
}

async function fulfillJson(route, body, waitMs = 0) {
  if (waitMs) await delay(waitMs)
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockApis(page) {
  const user = { id: 1, username: 'guest', role: 'user', created_at: '2026-06-20 00:00:00' }
  await page.route('**/api/auth/guest', route => fulfillJson(route, { success: true, data: { token: 'smoke-token', user } }))
  await page.route('**/api/auth/me', route => fulfillJson(route, { success: true, data: user }))
  await page.route('**/api/dashboard', route => fulfillJson(route, {
    success: true,
    data: {
      today: '2026-06-20',
      trade_date: '2026-06-18',
      is_trade_day: false,
      pipeline: {
        data_status: 'success',
        snapshot_count: 5852,
        recommend_status: 'success',
        returns_status: 'active',
        last_fetch_status: 'success',
        last_run_at: '2026-06-19 16:10:00',
        last_run_result: 'skipped: non-trading day 2026-06-19',
      },
      today_picks: [],
      tracking_batches: [],
      strategy_summary: {
        total: 10,
        completed: 5,
        win_count: 3,
        win_rate: 60,
        avg_return: 1.2,
        avg_max_gain: 3.4,
        avg_max_drawdown: -1.1,
        avg_return_day3: 0.8,
        avg_return_day5: 1.5,
        avg_return_day7: 2.1,
        win_rate_day3: 55,
        win_rate_day5: 60,
        win_rate_day7: 65,
      },
      strategy_review: {
        verdict: '策略需要降温观察',
        tone: 'caution',
        summary: '短周期收益或胜率偏弱。',
        tracking_count: 10,
      },
    },
  }, 1200))
  await page.route('**/api/picks/trade-dates?**', route => fulfillJson(route, { success: true, data: ['2026-06-18', '2026-06-17'] }))
  await page.route('**/api/picks/daily?**', route => fulfillJson(route, {
    success: true,
    data: [
      {
        stock_code: '600667',
        stock_name: '太极实业',
        recommend_price: 20.92,
        reason: 'Momentum 9.99%, trend 1 day(s), turnover 17.67%, sector Unclassified. Score 64.8.',
        rank: 1,
        score: 64.8,
        strategy_version: 'qf-db-strength-v2',
        factor_snapshot: { momentum: 100, trend: 18, liquidity: 100 },
      },
    ],
  }))
  await page.route('**/api/review/history', route => fulfillJson(route, {
    success: true,
    data: [
      {
        id: 101,
        recommend_date: '2026-06-18',
        stock_code: '600667',
        stock_name: '太极实业',
        recommend_price: 20.92,
        current_price: 0,
        return_rate: 0,
        reason: 'Momentum 9.99%, trend 1 day(s), turnover 17.67%, sector Unclassified. Score 64.8.',
        rank: 1,
        score: 64.8,
        strategy_version: 'qf-db-strength-v2',
        factor_snapshot: { momentum: 100, trend: 18, liquidity: 100 },
        tracking_days: 0,
        status: 'tracking',
        price_day1: 0,
        price_day2: 0,
        price_day3: 0,
        price_day5: 0,
        price_day7: 0,
        return_rate_day1: 0,
        return_rate_day2: 0,
        return_rate_day3: 0,
        return_rate_day5: 0,
        return_rate_day7: 0,
        final_return_rate: 0,
        max_gain: 0,
        max_drawdown: 0,
      },
    ],
  }))
  await page.route('**/api/limit-up/dates?**', route => fulfillJson(route, { success: true, data: ['2026-06-19', '2026-06-18'] }))
  await page.route('**/api/limit-up?**', route => fulfillJson(route, limitUpPayload(), 1200))
  await page.route('**/api/limit-up', route => fulfillJson(route, limitUpPayload(), 1200))
}

function limitUpPayload() {
  return {
    success: true,
    data: {
      date: '2026-06-19',
      source: 'akshare',
      summary: {
        total: 91,
        max_board_count: 4,
        first_board_count: 79,
        break_rate: 59.34,
        avg_seal_strength: 18.63,
        total_seal_amount: 7584348721,
        top_industry: '汽车零部件',
      },
      industries: [
        { industry: '汽车零部件', count: 6, leader_code: '603211', leader_name: '晋拓股份', max_board_count: 1, avg_seal_strength: 20 },
      ],
      items: [
        {
          rank: 1,
          stock_code: '600353',
          stock_name: '旭光电子',
          change_pct: 10,
          latest_price: 12.3,
          amount: 1356910608,
          float_market_value: 0,
          market_value: 0,
          turnover_rate: 0,
          seal_amount: 347000000,
          first_limit_time: '09:31:35',
          last_limit_time: '09:31:35',
          break_count: 0,
          limit_stat: '4/4',
          limit_total: 4,
          limit_success: 4,
          board_count: 4,
          industry: '其他电子',
          seal_strength: 25.57,
        },
        {
          rank: 2,
          stock_code: '603211',
          stock_name: '晋拓股份',
          change_pct: 10,
          latest_price: 8.88,
          amount: 580000000,
          float_market_value: 0,
          market_value: 0,
          turnover_rate: 0,
          seal_amount: 210000000,
          first_limit_time: '09:42:10',
          last_limit_time: '09:42:10',
          break_count: 0,
          limit_stat: '3/3',
          limit_total: 3,
          limit_success: 3,
          board_count: 3,
          industry: '汽车零部件',
          seal_strength: 18.12,
        },
        {
          rank: 3,
          stock_code: '002001',
          stock_name: '新和成',
          change_pct: 10,
          latest_price: 22.18,
          amount: 860000000,
          float_market_value: 0,
          market_value: 0,
          turnover_rate: 0,
          seal_amount: 180000000,
          first_limit_time: '10:05:18',
          last_limit_time: '10:05:18',
          break_count: 1,
          limit_stat: '2/2',
          limit_total: 2,
          limit_success: 2,
          board_count: 2,
          industry: '化学制药',
          seal_strength: 12.34,
        },
        {
          rank: 4,
          stock_code: '300750',
          stock_name: '宁德时代',
          change_pct: 20,
          latest_price: 188.88,
          amount: 2600000000,
          float_market_value: 0,
          market_value: 0,
          turnover_rate: 0,
          seal_amount: 300000000,
          first_limit_time: '13:20:08',
          last_limit_time: '13:20:08',
          break_count: 0,
          limit_stat: '1/1',
          limit_total: 1,
          limit_success: 1,
          board_count: 1,
          industry: '电池',
          seal_strength: 11.58,
        },
      ],
    },
  }
}

function assertText(value, expected, label) {
  if (!value?.includes(expected)) {
    throw new Error(`${label} expected "${expected}", got "${value}"`)
  }
}

async function run() {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
  if (css.includes('\n.card:hover')) {
    throw new Error('legacy .card:hover must be scoped away from the light qv4 app')
  }
  if (!css.includes('button:focus-visible')) {
    throw new Error('buttons need visible keyboard focus styles')
  }

  const vite = startVite()
  try {
    await waitForServer()
    const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
    await mockApis(page)

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  assertText(await page.locator('h1').first().textContent(), '进入推荐收益闭环', 'login page')
    await page.getByRole('button', { name: '账号登录' }).focus()
    const focusOutline = await page.getByRole('button', { name: '账号登录' }).evaluate(el => getComputedStyle(el).outlineStyle)
    if (focusOutline === 'none') {
      throw new Error('focused buttons must show a visible outline')
    }
    if (await page.locator('input[type="password"]').count() !== 1) {
      throw new Error('login password input must be masked')
    }
    await page.getByRole('button', { name: '游客直接进入' }).click()
    await page.waitForURL('**/recommend')
    await page.waitForSelector('.qv4-status-skeleton')
    await page.waitForSelector('.qv4-pick-row')
    assertText(await page.locator('h1').first().textContent(), '推荐工作台', 'recommend page')
    assertText(await page.locator('.qv4-chip-row span').first().textContent(), '动量', 'factor label')
    const recommendText = await page.locator('.qv4-page').textContent()
    if (recommendText?.includes('行业 未分类')) {
      throw new Error('recommendation card should hide unclassified industry text')
    }
    assertText(recommendText, '建议观望 3 日', 'actionable strategy advice')
    assertText(recommendText, '当前价待更新', 'pending tracking price')
    if (recommendText?.includes('当前价 0.00')) {
      throw new Error('tracking card should not display zero price as real market data')
    }
    if (await page.getByText('立即更新收益跟踪').count()) {
      throw new Error('ordinary user should not see manual returns update button')
    }
    if (await page.locator('.qv4-date-card select, .qv4-panel-head select').count()) {
      throw new Error('recommend page should use the polished trade-date picker, not native selects')
    }
    await page.locator('.qv4-date-trigger').first().click()
    await page.getByRole('option', { name: /2026-06-17/ }).click()
    assertText(await page.locator('.qv4-date-trigger').first().textContent(), '2026-06-17', 'trade date picker')

    await page.getByRole('link', { name: /用户中心/ }).first().click()
    await page.waitForURL('**/account')
    assertText(await page.locator('h1').first().textContent(), '用户中心', 'account page')
    assertText(await page.locator('.qv4-membership-card').textContent(), '会员状态', 'membership card')
    assertText(await page.locator('.qv4-membership-card').textContent(), '联系管理员开通会员', 'membership upgrade')
    await page.getByRole('button', { name: '联系管理员开通会员' }).click()
    assertText(await page.locator('.qv4-contact-panel').textContent(), '管理员联系方式', 'membership contact feedback')

    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' })
    if (await page.locator('input[type="password"]').count() !== 2) {
      throw new Error('register password inputs must be masked')
    }

    await page.goto(`${BASE_URL}/limit-up`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.qv4-board-skeleton')
    await page.waitForSelector('.qv4-board-table-row')
    assertText(await page.locator('h1').first().textContent(), '涨停板分析', 'limit-up page')
    for (const label of ['4板', '3板', '2板', '首板']) {
      if (!await page.getByRole('heading', { name: label }).count()) {
        throw new Error(`limit-up page should group stocks by ${label}`)
      }
    }
    assertText(await page.locator('.qv4-board-table-row strong').first().textContent(), '旭光电子', 'real limit-up row')
    assertText(await page.locator('.qv4-board-section').filter({ hasText: '首板' }).textContent(), '宁德时代', 'first-board group')

    await browser.close()
    console.log('smoke pages ok')
  } finally {
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/pid', String(vite.pid), '/t', '/f'], { stdio: 'ignore' })
      } catch {
        vite.kill()
      }
    } else {
      vite.kill('SIGTERM')
    }
  }
}

run().catch(err => {
  console.error(err)
  process.exitCode = 1
})
