import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Market from './pages/Market'
import Analysis from './pages/Analysis'
import StockAnalysis from './pages/StockAnalysis'
import DailyReport from './pages/DailyReport'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-primary bg-grid relative">
        {/* 顶部渐变光晕 */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <Navbar />

        <main className="relative z-10">
          <Routes>
            <Route path="/market" element={<Market />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/stock" element={<StockAnalysis />} />
            <Route path="/recommend" element={<DailyReport />} />
            <Route path="*" element={<Navigate to="/market" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-border-default py-6 mt-12 bg-white/50">
          <div className="max-w-6xl mx-auto px-6 text-center text-xs text-text-muted">
            QuantForge · 量化锻造 · AI 驱动的 A 股分析平台 · 数据仅供参考，不构成投资建议
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}
