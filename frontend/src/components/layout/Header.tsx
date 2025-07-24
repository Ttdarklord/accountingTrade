import { useQuery } from '@tanstack/react-query'
import { Bell, Menu } from 'lucide-react'
import { api } from '../../lib/api'

export function Header() {
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(res => res.data.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ` ${currency}`
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600">
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="ml-2 text-2xl font-semibold text-gray-900">
            Currency Trading Dashboard
          </h1>
        </div>
        
        <div className="flex items-center space-x-6">
          {/* Company Balances */}
          {dashboardData?.balances && (
            <div className="flex items-center space-x-4 px-4 py-2 bg-gray-50 rounded-lg">
              {dashboardData.balances.map((balance: any) => (
                <div key={balance.currency} className="text-center">
                  <div className="text-xs text-gray-500 uppercase">
                    {balance.currency} Balance
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatCurrency(balance.balance, balance.currency)}
                  </div>
                  {balance.safe_balance > 0 && (
                    <div className="text-xs text-primary-600">
                      Safe: {formatCurrency(balance.safe_balance, balance.currency)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Notifications */}
          <button className="p-2 text-gray-400 hover:text-gray-600 relative">
            <Bell className="h-6 w-6" />
            {dashboardData?.pending_trades?.length > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-danger-600 rounded-full">
                {dashboardData.pending_trades.length}
              </span>
            )}
          </button>
          
          {/* User Info */}
          <div className="flex items-center">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">Agrivex Admin</div>
              <div className="text-xs text-gray-500">Currency Trader</div>
            </div>
            <div className="ml-3 h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">A</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
} 