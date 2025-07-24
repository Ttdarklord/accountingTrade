import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Package, DollarSign, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

interface DashboardData {
  balances: Array<{
    currency: string
    balance: number
    safe_balance: number
  }>
  pending_trades: Array<any>
  outstanding_positions: Array<any>
  recent_transactions: Array<any>
  profit_summary: {
    total_profit_toman: number
    total_profit_aed: number
    monthly_profit_toman: number
    monthly_profit_aed: number
  }
  trade_status_counts: {
    pending_count: number
    partial_count: number
    completed_count: number
  }
}



export function Dashboard() {
  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(res => res.data.data),
    refetchInterval: 30000,
  })

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ` ${currency}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Calculate settlement stats from dashboard data
  const completedTrades = dashboardData?.trade_status_counts.completed_count || 0
  const partialTrades = dashboardData?.trade_status_counts.partial_count || 0
  const pendingTrades = dashboardData?.trade_status_counts.pending_count || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Trading Dashboard</h1>
        <Link
          to="/trades"
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Trade
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Settlement Status Cards */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">
                  Completed Trades
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {completedTrades}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">
                  Partial Settlements
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {partialTrades}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">
                  Pending Trades
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {pendingTrades}
                </div>
              </div>
            </div>
          </div>
        </div>
        {dashboardData?.balances.map((balance) => (
          <div key={balance.currency} className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DollarSign className="h-8 w-8 text-primary-600" />
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500">
                    {balance.currency} Balance
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(balance.balance, balance.currency)}
                  </div>
                  {balance.safe_balance > 0 && (
                    <div className="text-sm text-gray-600">
                      Safe: {formatCurrency(balance.safe_balance, balance.currency)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-success-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">
                  Monthly Profit (Toman)
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(dashboardData?.profit_summary.monthly_profit_toman || 0, 'TOMAN')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-8 w-8 text-warning-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">
                  Outstanding Positions
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {dashboardData?.outstanding_positions.length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Trades */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Pending Trades</h3>
          </div>
          <div className="card-body">
            {dashboardData?.pending_trades.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No pending trades</p>
            ) : (
              <div className="space-y-3">
                {dashboardData?.pending_trades.slice(0, 5).map((trade: any) => (
                  <div key={trade.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{trade.trade_number}</div>
                      <div className="text-sm text-gray-600">
                        {trade.trade_type}: {formatCurrency(trade.amount, trade.base_currency)} @ {trade.rate}
                      </div>
                    </div>
                    <span className={`badge ${trade.status === 'PENDING' ? 'badge-warning' : 'badge-primary'}`}>
                      {trade.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link to="/trades" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View all trades →
              </Link>
            </div>
          </div>
        </div>

        {/* Outstanding Positions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Outstanding Positions</h3>
          </div>
          <div className="card-body">
            {dashboardData?.outstanding_positions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No outstanding positions</p>
            ) : (
              <div className="space-y-3">
                {dashboardData?.outstanding_positions.slice(0, 5).map((position: any) => (
                  <div key={position.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(position.remaining_amount, position.currency)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Avg Cost: {position.average_cost_rate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {position.trade_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(position.trade_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link to="/positions" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View all positions →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 