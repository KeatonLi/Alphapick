const limitRows = [
  { code: '002151', name: '北斗科技', boards: 4, theme: '卫星互联网', seal: 92, time: '09:36', turnover: '8.4亿' },
  { code: '300782', name: '卓胜微', boards: 2, theme: '半导体', seal: 86, time: '10:14', turnover: '12.7亿' },
  { code: '603019', name: '中科曙光', boards: 1, theme: '算力', seal: 79, time: '13:07', turnover: '21.3亿' },
  { code: '000977', name: '浪潮信息', boards: 1, theme: 'AI服务器', seal: 74, time: '14:22', turnover: '18.9亿' },
]

const themes = [
  { name: '卫星互联网', count: 9, strength: 91, leader: '北斗科技' },
  { name: '半导体', count: 7, strength: 84, leader: '卓胜微' },
  { name: '算力', count: 6, strength: 78, leader: '中科曙光' },
  { name: '机器人', count: 5, strength: 71, leader: '鸣志电器' },
]

export default function LimitUpPage() {
  return (
    <div className="qv4-page">
      <section className="qv4-hero compact">
        <div className="qv4-hero-main">
          <div className="qv4-kicker">Limit-up Analysis</div>
          <h1>涨停板股票分析</h1>
          <p>围绕每日涨停股票，观察连板高度、题材扩散、封单强度和炸板风险。这里先完成前端主框架，后续接入真实涨停池接口。</p>
        </div>
        <div className="qv4-date-card">
          <span>今日涨停</span>
          <strong>43</strong>
          <small>连板 11，只首板 32</small>
        </div>
      </section>

      <section className="qv4-status-grid">
        <div className="qv4-status-card good"><span>涨停数量</span><strong>43</strong><small>较昨日 +8</small></div>
        <div className="qv4-status-card"><span>最高连板</span><strong>4板</strong><small>卫星互联网</small></div>
        <div className="qv4-status-card"><span>炸板率</span><strong>18.6%</strong><small>风险可控</small></div>
        <div className="qv4-status-card"><span>市场热度</span><strong>82</strong><small>短线情绪偏强</small></div>
      </section>

      <div className="qv4-workspace">
        <section className="qv4-panel qv4-panel-large">
          <header className="qv4-panel-head">
            <div>
              <span>Limit-up Pool</span>
              <h2>涨停股票池</h2>
            </div>
            <button className="qv4-secondary">刷新涨停池</button>
          </header>
          <div className="qv4-limit-table">
            <div className="qv4-limit-head">
              <span>股票</span><span>连板</span><span>题材</span><span>封板强度</span><span>封板时间</span><span>成交额</span>
            </div>
            {limitRows.map(row => (
              <article key={row.code} className="qv4-limit-row">
                <div><strong>{row.name}</strong><small>{row.code}</small></div>
                <b>{row.boards}板</b>
                <span>{row.theme}</span>
                <div className="qv4-seal"><i style={{ width: `${row.seal}%` }} /><em>{row.seal}</em></div>
                <span className="mono">{row.time}</span>
                <span>{row.turnover}</span>
              </article>
            ))}
          </div>
        </section>

        <aside className="qv4-panel">
          <header className="qv4-panel-head">
            <div>
              <span>Theme Heat</span>
              <h2>题材热度</h2>
            </div>
          </header>
          <div className="qv4-theme-list">
            {themes.map(theme => (
              <div key={theme.name} className="qv4-theme-card">
                <div>
                  <strong>{theme.name}</strong>
                  <span>{theme.count} 只涨停，龙头 {theme.leader}</span>
                </div>
                <b>{theme.strength}</b>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="qv4-panel">
        <header className="qv4-panel-head">
          <div>
            <span>AI Review</span>
            <h2>涨停复盘摘要</h2>
          </div>
        </header>
        <div className="qv4-review-text">
          今日短线情绪主要集中在卫星互联网和半导体方向，高度板仍在抬升，但下午炸板率略有增加。明日重点观察高位连板是否继续晋级，以及首板题材能否扩散形成新的主线。
        </div>
      </section>
    </div>
  )
}
