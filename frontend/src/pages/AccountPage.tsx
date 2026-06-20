import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function membershipFor(user: { username: string; role: string } | null) {
  if (!user) {
    return {
      title: '未登录',
      status: '未开通会员',
      tone: 'neutral',
      description: '登录后可以查看推荐闭环、涨停分析和个人权限。',
      features: ['查看公开推荐数据', '查看涨停板分析'],
    }
  }
  if (user.role === 'admin') {
    return {
      title: '管理员会员',
      status: '已开通',
      tone: 'positive',
      description: '你拥有推荐任务、收益跟踪、数据采集和系统调度的管理权限。',
      features: ['管理推荐任务', '手动更新收益跟踪', '查看数据采集状态', '维护系统调度'],
    }
  }
  if (user.username === 'guest') {
    return {
      title: '游客体验',
      status: '未开通会员',
      tone: 'caution',
      description: '游客可以体验核心看板，但会员专属能力需要联系管理员开通。',
      features: ['查看推荐工作台', '查看收益跟踪结果', '查看涨停板分析'],
    }
  }
  return {
    title: '普通用户',
    status: '未开通会员',
    tone: 'neutral',
    description: '当前账号可查看核心数据，开通会员后可解锁后续高级策略能力。',
    features: ['查看推荐工作台', '查看收益跟踪结果', '查看涨停板分析'],
  }
}

export default function AccountPage() {
  const { user } = useAuth()
  const membership = membershipFor(user)
  const joinedAt = user?.created_at || '--'

  return (
    <div className="qv4-page">
      <section className="qv4-hero compact">
        <div className="qv4-hero-main qv4-reveal">
          <div className="qv4-kicker">账号与会员</div>
          <h1>用户中心</h1>
          <p>这里用来确认当前账号身份、会员状态和可用权限。支付系统上线前，会员开通先通过管理员处理。</p>
        </div>
        <div className="qv4-date-card qv4-account-hero qv4-reveal">
          <span>当前身份</span>
          <strong>{user?.username || '未登录'}</strong>
          <small>{user?.role === 'admin' ? '管理员权限' : '普通访问权限'}</small>
        </div>
      </section>

      <div className="qv4-account-grid">
        <section className={`qv4-panel qv4-membership-card qv4-reveal ${membership.tone}`}>
          <header className="qv4-panel-head">
            <div>
              <span>会员状态</span>
              <h2>{membership.title}</h2>
            </div>
            <b>{membership.status}</b>
          </header>
          <p>{membership.description}</p>
          <div className="qv4-membership-actions">
            <a className="qv4-primary" href="mailto:admin@quantforge.local?subject=开通 QuantForge 会员">联系管理员开通会员</a>
            <Link className="qv4-secondary" to="/recommend">返回推荐工作台</Link>
          </div>
        </section>

        <section className="qv4-panel qv4-reveal">
          <header className="qv4-panel-head">
            <div>
              <span>账号信息</span>
              <h2>基础资料</h2>
            </div>
          </header>
          <div className="qv4-profile-list">
            <div><span>用户名</span><strong>{user?.username || '--'}</strong></div>
            <div><span>账号角色</span><strong>{user?.role === 'admin' ? '管理员' : '普通用户'}</strong></div>
            <div><span>创建时间</span><strong>{joinedAt}</strong></div>
          </div>
        </section>

        <section className="qv4-panel qv4-reveal">
          <header className="qv4-panel-head">
            <div>
              <span>当前可用</span>
              <h2>功能权限</h2>
            </div>
          </header>
          <div className="qv4-feature-list">
            {membership.features.map(feature => (
              <div key={feature}>
                <i />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
