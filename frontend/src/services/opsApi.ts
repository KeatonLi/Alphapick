import { apiGet, apiPost } from './api'

export const opsApi = {
  runDaily: (date: string) => apiPost(`/ops/run-daily?date=${date}`),
  backtest: (startDate: string, endDate: string) => apiPost(`/ops/backtest?start_date=${startDate}&end_date=${endDate}`),
  fetch: (date: string) => apiPost(`/ops/fetch?date=${date}`),
  generatePicks: (date: string) => apiPost(`/ops/generate-picks?date=${date}`),
  updateReturns: () => apiPost('/ops/update-returns'),
  task: (taskId: number) => apiGet(`/ops/task/${taskId}`),
  schedule: () => apiGet('/ops/schedule'),
  saveSchedule: (enabled: boolean, runTime: string, runReport: boolean, runRecommend: boolean, runUpdateReturns: boolean) =>
    apiPost(`/ops/schedule?enabled=${enabled}&run_time=${runTime}&run_report=${runReport}&run_recommend=${runRecommend}&run_update_returns=${runUpdateReturns}`),
}
