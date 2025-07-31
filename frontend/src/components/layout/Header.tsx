import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Menu, X, Check, CheckCheck } from 'lucide-react'
import { api } from '../../lib/api'

interface Notification {
  id: number;
  type: 'trade' | 'receipt' | 'edit' | 'delete' | 'restore';
  title: string;
  message: string;
  entity_type: 'trade' | 'receipt' | 'account' | 'party';
  entity_id: number;
  is_read: boolean;
  created_at: string;
}

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false)
  const queryClient = useQueryClient()

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(res => res.data.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch notifications
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=20').then(res => res.data.data),
    refetchInterval: 15000, // Refresh every 15 seconds
  })

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) => api.put(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
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
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-gray-400 hover:text-gray-600 relative"
            >
              <Bell className="h-6 w-6" />
              {notificationsData && notificationsData.filter((n: Notification) => !n.is_read).length > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                  {notificationsData.filter((n: Notification) => !n.is_read).length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <>
                {/* Overlay */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowNotifications(false)}
                />
                
                {/* Dropdown */}
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-96 overflow-hidden">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                    <div className="flex items-center space-x-2">
                      {notificationsData && notificationsData.filter((n: Notification) => !n.is_read).length > 0 && (
                        <button
                          onClick={() => markAllAsReadMutation.mutate()}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                          disabled={markAllAsReadMutation.isPending}
                        >
                          <CheckCheck className="h-4 w-4" />
                          <span>Mark all read</span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Notifications List */}
                  <div className="max-h-80 overflow-y-auto">
                    {notificationsData && notificationsData.length > 0 ? (
                      notificationsData.map((notification: Notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                            !notification.is_read ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => {
                            if (!notification.is_read) {
                              markAsReadMutation.mutate(notification.id)
                            }
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h4 className={`text-sm font-medium ${
                                  !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                                }`}>
                                  {notification.title}
                                </h4>
                                {!notification.is_read && (
                                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              notification.type === 'trade' ? 'bg-green-100 text-green-800' :
                              notification.type === 'receipt' ? 'bg-blue-100 text-blue-800' :
                              notification.type === 'edit' ? 'bg-yellow-100 text-yellow-800' :
                              notification.type === 'delete' ? 'bg-red-100 text-red-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {notification.type}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                        <p>No notifications yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          
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