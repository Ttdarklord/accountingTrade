import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit, CreditCard, Building, Users, Filter, Eye, X, User, Globe, Hash, ToggleRight, Download, Calendar } from 'lucide-react'
import { api } from '../lib/api'

interface BankAccount {
  id: number
  account_number: string
  bank_name: string
  currency: 'AED' | 'TOMAN'
  counterpart_id: number
  is_active: boolean
  created_at: string
  counterpart_name?: string
  receipt_count?: number
}

interface TradingParty {
  id: number
  name: string
  phone?: string
  email?: string
  national_id?: string
  notes?: string
  created_at: string
}

interface PaymentReceipt {
  id: number
  payer_id: number
  receiver_account_id: number
  tracking_last_5: string
  amount: number
  receipt_date: string
  notes?: string
  created_at: string
  payer_name?: string
  currency?: string // Added for CSV export
}

export default function Accounts() {
  const [searchTerm, setSearchTerm] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'AED' | 'TOMAN'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [selectedAccountReceipts, setSelectedAccountReceipts] = useState<{account: BankAccount, receipts: PaymentReceipt[]} | null>(null)
  
  // Receipt filtering state
  const [receiptFilters, setReceiptFilters] = useState({
    payerId: '',
    trackingSearch: '',
    startDate: '',
    endDate: ''
  })
  
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [datePickerStep, setDatePickerStep] = useState<'start' | 'end' | null>(null)
  const [tempStartDate, setTempStartDate] = useState('')
  const [tempEndDate, setTempEndDate] = useState('')
  
  const [formData, setFormData] = useState({
    account_number: '',
    bank_name: '',
    currency: 'TOMAN' as 'AED' | 'TOMAN',
    counterpart_id: 0,
    is_active: true
  })

  const queryClient = useQueryClient()

  // Fetch accounts
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get('/accounts')
      return response.data.data
    }
  })

  // Fetch trading parties for counterpart selection
  const { data: partiesData } = useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      const response = await api.get('/parties')
      return response.data.data
    }
  })

  // Create account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/accounts', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      resetForm()
      setShowModal(false)
    }
  })

  // Update account mutation
  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<typeof formData> }) => {
      const response = await api.put(`/accounts/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      resetForm()
      setShowModal(false)
    }
  })

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/accounts/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    }
  })

  // View receipts for account
  const viewReceipts = async (account: BankAccount) => {
    try {
      await fetchAccountReceipts(account)
      setShowReceiptModal(true)
    } catch (error) {
      console.error('Failed to fetch receipts:', error)
    }
  }

  // Fetch account receipts with filters
  const fetchAccountReceipts = async (account: BankAccount) => {
    const params = new URLSearchParams()
    if (receiptFilters.payerId) params.append('payer_id', receiptFilters.payerId)
    if (receiptFilters.trackingSearch) params.append('tracking_search', receiptFilters.trackingSearch)
    if (receiptFilters.startDate) params.append('start_date', receiptFilters.startDate)
    if (receiptFilters.endDate) params.append('end_date', receiptFilters.endDate)
    
    const queryString = params.toString()
    const response = await api.get(`/accounts/${account.id}${queryString ? `?${queryString}` : ''}`)
    setSelectedAccountReceipts(response.data.data)
  }

  // Export receipts to CSV
  const exportReceiptsToCSV = async () => {
    if (!selectedAccountReceipts) return
    
    try {
      const params = new URLSearchParams({ format: 'csv' })
      if (receiptFilters.payerId) params.append('payer_id', receiptFilters.payerId)
      if (receiptFilters.trackingSearch) params.append('tracking_search', receiptFilters.trackingSearch)
      if (receiptFilters.startDate) params.append('start_date', receiptFilters.startDate)
      if (receiptFilters.endDate) params.append('end_date', receiptFilters.endDate)
      
      const response = await fetch(`/api/accounts/${selectedAccountReceipts.account.id}?${params.toString()}`)
      const blob = await response.blob()
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${selectedAccountReceipts.account.bank_name}-receipts.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to export CSV:', error)
      alert('Failed to export CSV')
    }
  }

  // Real-time filtering with debouncing
  useEffect(() => {
    if (!selectedAccountReceipts) return
    
    const timeoutId = setTimeout(() => {
      fetchAccountReceipts(selectedAccountReceipts.account)
    }, 300) // 300ms debounce for text input
    
    return () => clearTimeout(timeoutId)
  }, [receiptFilters.trackingSearch])

  // Immediate filtering for dropdown and date changes
  useEffect(() => {
    if (!selectedAccountReceipts) return
    fetchAccountReceipts(selectedAccountReceipts.account)
  }, [receiptFilters.payerId, receiptFilters.startDate, receiptFilters.endDate])

  // Remove individual filter
  const removeFilter = (filterType: 'payerId' | 'trackingSearch' | 'startDate' | 'endDate') => {
    setReceiptFilters(prev => ({ ...prev, [filterType]: '' }))
  }

  // Handle smart date picker
  const handleDateSelect = (date: string) => {
    if (!tempStartDate || datePickerStep === 'start') {
      // First selection - set start date
      setTempStartDate(date)
      setTempEndDate('')
      setDatePickerStep('end')
    } else {
      // Second selection - set end date and apply
      if (date < tempStartDate) {
        // If selected date is before start date, swap them
        setReceiptFilters(prev => ({ ...prev, startDate: date, endDate: tempStartDate }))
      } else {
        setReceiptFilters(prev => ({ ...prev, startDate: tempStartDate, endDate: date }))
      }
      setShowDatePicker(false)
      setDatePickerStep(null)
      setTempStartDate('')
      setTempEndDate('')
    }
  }

  // Open date picker
  const openDatePicker = () => {
    setTempStartDate(receiptFilters.startDate)
    setTempEndDate(receiptFilters.endDate)
    setDatePickerStep(receiptFilters.startDate ? 'end' : 'start')
    setShowDatePicker(true)
  }

  // Clear date range
  const clearDateRange = () => {
    setReceiptFilters(prev => ({ ...prev, startDate: '', endDate: '' }))
    setShowDatePicker(false)
    setDatePickerStep(null)
    setTempStartDate('')
    setTempEndDate('')
  }

  // Check if date is in range for hover effect
  const isDateInRange = (date: string) => {
    if (!tempStartDate) return false
    if (!tempEndDate && datePickerStep === 'end') {
      // During hover, show potential range
      return date >= tempStartDate
    }
    return date >= tempStartDate && date <= tempEndDate
  }

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay()) // Start from Sunday
    
    const days = []
    const current = new Date(startDate)
    
    // Generate 6 weeks of days
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        days.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }
    }
    
    return days
  }

  // Get active filters count
  const activeFilters = [
    receiptFilters.payerId,
    receiptFilters.trackingSearch,
    receiptFilters.startDate
  ].filter(Boolean).length

  const resetForm = () => {
    setFormData({
      account_number: '',
      bank_name: '',
      currency: 'TOMAN',
      counterpart_id: 0,
      is_active: true
    })
    setEditingAccount(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.counterpart_id === 0) {
      alert('Please select a counterpart')
      return
    }

    if (editingAccount) {
      updateAccountMutation.mutate({ id: editingAccount.id, data: formData })
    } else {
      createAccountMutation.mutate(formData)
    }
  }

  const handleEdit = (account: BankAccount) => {
    setFormData({
      account_number: account.account_number,
      bank_name: account.bank_name,
      currency: account.currency,
      counterpart_id: account.counterpart_id,
      is_active: account.is_active
    })
    setEditingAccount(account)
    setShowModal(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this bank account?')) {
      deleteAccountMutation.mutate(id)
    }
  }

  const toggleStatus = (account: BankAccount) => {
    updateAccountMutation.mutate({
      id: account.id,
      data: { is_active: !account.is_active }
    })
  }

  // Filter accounts
  const filteredAccounts = (accountsData || []).filter((account: BankAccount) => {
    const matchesSearch = account.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (account.counterpart_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCurrency = currencyFilter === 'ALL' || account.currency === currencyFilter
    const matchesStatus = statusFilter === 'ALL' || 
                         (statusFilter === 'ACTIVE' && account.is_active) ||
                         (statusFilter === 'INACTIVE' && !account.is_active)
    
    return matchesSearch && matchesCurrency && matchesStatus
  })

  // Separate active and inactive accounts
  const activeAccounts = filteredAccounts.filter((account: BankAccount) => account.is_active)
  const inactiveAccounts = filteredAccounts.filter((account: BankAccount) => !account.is_active)
  const sortedAccounts = [...activeAccounts, ...inactiveAccounts]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bank Accounts</h1>
            <p className="text-gray-600 mt-1">Manage counterpart-linked bank accounts for payment processing</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Add Account</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value as any)}
              >
                <option value="ALL">All Currencies</option>
                <option value="AED">AED</option>
                <option value="TOMAN">TOMAN</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setCurrencyFilter('ALL')
                  setStatusFilter('ALL')
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Accounts</p>
                <p className="text-2xl font-bold text-gray-900">{accountsData?.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <ToggleRight className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accountsData?.filter((a: BankAccount) => a.is_active).length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Globe className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">AED Accounts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accountsData?.filter((a: BankAccount) => a.currency === 'AED').length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Hash className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">TOMAN Accounts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {accountsData?.filter((a: BankAccount) => a.currency === 'TOMAN').length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Accounts Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Bank Accounts</h2>
          </div>

          {sortedAccounts.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || currencyFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No accounts match your filters' : 'No bank accounts found'}
              </h3>
              <p className="text-gray-600">
                {!searchTerm && currencyFilter === 'ALL' && statusFilter === 'ALL' && 'Get started by adding your first bank account'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
              {sortedAccounts.map((account: BankAccount) => (
                <div key={account.id} className={`border rounded-lg p-6 transition-all duration-200 ${
                  account.is_active 
                    ? 'border-gray-200 hover:shadow-md bg-white' 
                    : 'border-gray-200 bg-gray-50 opacity-75'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        account.currency === 'AED' ? 'bg-green-100' : 'bg-purple-100'
                      }`}>
                        <CreditCard className={`h-5 w-5 ${
                          account.currency === 'AED' ? 'text-green-600' : 'text-purple-600'
                        }`} />
                      </div>
                      <div>
                        <div className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          account.currency === 'AED' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {account.currency}
                        </div>
                        {!account.is_active && (
                          <div className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 ml-2">
                            Inactive
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="relative">
                      <button 
                        className="text-gray-400 hover:text-gray-600 p-1"
                        onClick={() => {
                          const dropdown = document.getElementById(`dropdown-${account.id}`)
                          dropdown?.classList.toggle('hidden')
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <div id={`dropdown-${account.id}`} className="hidden absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={() => {
                            handleEdit(account)
                            document.getElementById(`dropdown-${account.id}`)?.classList.add('hidden')
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                        >
                          Edit Account
                        </button>
                        <button
                          onClick={() => {
                            viewReceipts(account)
                            document.getElementById(`dropdown-${account.id}`)?.classList.add('hidden')
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          View Receipts ({account.receipt_count || 0})
                        </button>
                        <button
                          onClick={() => {
                            toggleStatus(account)
                            document.getElementById(`dropdown-${account.id}`)?.classList.add('hidden')
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {account.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => {
                            handleDelete(account.id)
                            document.getElementById(`dropdown-${account.id}`)?.classList.add('hidden')
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{account.bank_name}</h3>
                      <p className="text-sm text-gray-600 font-mono">{account.account_number}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{account.counterpart_name}</span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-600">
                          {account.receipt_count || 0} receipts
                        </span>
                      </div>
                      <button
                        onClick={() => viewReceipts(account)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {editingAccount ? 'Edit Account' : 'Add New Account'}
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {editingAccount ? 'Update account details' : 'Create a counterpart-linked bank account'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetForm()
                    setShowModal(false)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Hash className="h-4 w-4 inline mr-1" />
                  Account Number *
                </label>
                <input
                  type="text"
                  placeholder="Enter account number"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building className="h-4 w-4 inline mr-1" />
                  Bank Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter bank name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Globe className="h-4 w-4 inline mr-1" />
                  Currency *
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'AED' | 'TOMAN' })}
                  required
                >
                  <option value="TOMAN">TOMAN</option>
                  <option value="AED">AED</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  Counterpart *
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={formData.counterpart_id}
                  onChange={(e) => setFormData({ ...formData, counterpart_id: parseInt(e.target.value) })}
                  required
                >
                  <option value={0}>Select a counterpart</option>
                  {(partiesData || []).map((party: TradingParty) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                    </option>
                  ))}
                </select>
              </div>

              {editingAccount && (
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Account is active
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    resetForm()
                    setShowModal(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                  disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
                >
                  {createAccountMutation.isPending || updateAccountMutation.isPending ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt History Modal */}
      {showReceiptModal && selectedAccountReceipts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    Receipt History
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {selectedAccountReceipts.account.bank_name} - ...{selectedAccountReceipts.account.account_number.slice(-5)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowReceiptModal(false)
                    setSelectedAccountReceipts(null)
                    setReceiptFilters({ payerId: '', trackingSearch: '', startDate: '', endDate: '' })
                    setDatePickerStep(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Filters Section */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Filter className="h-5 w-5 mr-2" />
                  Filters {activeFilters > 0 && <span className="ml-2 bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full">{activeFilters}</span>}
                </h4>
                <button
                  onClick={exportReceiptsToCSV}
                  className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all duration-200"
                  title="Export to CSV"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>

              {/* Filter Bubbles */}
              {activeFilters > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {receiptFilters.payerId && (
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center space-x-2">
                      <span>Payer: {partiesData?.find((p: any) => p.id == receiptFilters.payerId)?.name}</span>
                      <button
                        onClick={() => removeFilter('payerId')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {receiptFilters.trackingSearch && (
                    <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center space-x-2">
                      <span>Tracking: {receiptFilters.trackingSearch}</span>
                      <button
                        onClick={() => removeFilter('trackingSearch')}
                        className="text-purple-600 hover:text-purple-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {receiptFilters.startDate && (
                    <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm flex items-center space-x-2">
                      <span>
                        {receiptFilters.endDate 
                          ? `${receiptFilters.startDate} to ${receiptFilters.endDate}`
                          : `From ${receiptFilters.startDate}`
                        }
                      </span>
                      <button
                        onClick={clearDateRange}
                        className="text-orange-600 hover:text-orange-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payer</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={receiptFilters.payerId}
                    onChange={(e) => setReceiptFilters({ ...receiptFilters, payerId: e.target.value })}
                  >
                    <option value="">All Payers</option>
                    {partiesData && partiesData.map((party: any) => (
                      <option key={party.id} value={party.id}>
                        {party.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tracking Search</label>
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search tracking..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      value={receiptFilters.trackingSearch}
                      onChange={(e) => setReceiptFilters({ ...receiptFilters, trackingSearch: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range 
                    {datePickerStep === 'end' && <span className="text-xs text-blue-600 ml-1">(select end date)</span>}
                  </label>
                  <div className="relative">
                    <Calendar className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <button
                      type="button"
                      onClick={openDatePicker}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-left bg-white hover:bg-gray-50"
                    >
                      {receiptFilters.startDate && receiptFilters.endDate 
                        ? `${receiptFilters.startDate} to ${receiptFilters.endDate}`
                        : receiptFilters.startDate 
                          ? `From ${receiptFilters.startDate}`
                          : 'Select date range'
                      }
                    </button>
                    
                    {/* Calendar Dropdown */}
                    {showDatePicker && (
                      <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-64">
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            {datePickerStep === 'start' ? 'Select start date' : 'Select end date'}
                          </h4>
                        </div>
                        
                        {/* Calendar Header */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-xs font-medium text-gray-500 text-center p-1">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        {/* Calendar Days */}
                        <div className="grid grid-cols-7 gap-1">
                          {generateCalendarDays().map((date, index) => {
                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                            const isCurrentMonth = date.getMonth() === new Date().getMonth()
                            const isSelected = dateStr === tempStartDate || dateStr === tempEndDate
                            const isInRange = isDateInRange(dateStr)
                            const today = new Date()
                            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                            const isToday = dateStr === todayStr
                            
                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => handleDateSelect(dateStr)}
                                onMouseEnter={() => {
                                  if (datePickerStep === 'end' && tempStartDate) {
                                    setTempEndDate(dateStr)
                                  }
                                }}
                                className={`
                                  p-1 text-xs rounded transition-colors
                                  ${!isCurrentMonth ? 'text-gray-300' : ''}
                                  ${isToday ? 'ring-1 ring-blue-500' : ''}
                                  ${isSelected ? 'bg-blue-600 text-white' : ''}
                                  ${isInRange && !isSelected ? 'bg-blue-100 text-blue-700' : ''}
                                  ${isCurrentMonth && !isSelected && !isInRange ? 'hover:bg-gray-100' : ''}
                                `}
                              >
                                {date.getDate()}
                              </button>
                            )
                          })}
                        </div>
                        
                        {/* Calendar Footer */}
                        <div className="mt-4 flex justify-between">
                          <button
                            type="button"
                            onClick={clearDateRange}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDatePicker(false)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Owner:</span>
                    <span className="ml-2 font-medium">{selectedAccountReceipts.account.counterpart_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Currency:</span>
                    <span className="ml-2 font-medium">{selectedAccountReceipts.account.currency}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className="ml-2 font-medium">
                      {selectedAccountReceipts.account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Filtered Receipts:</span>
                    <span className="ml-2 font-medium">{selectedAccountReceipts.receipts.length}</span>
                  </div>
                </div>
              </div>

              {selectedAccountReceipts.receipts.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No receipts found</h4>
                  <p className="text-gray-600">
                    {receiptFilters.payerId || receiptFilters.trackingSearch || receiptFilters.startDate || receiptFilters.endDate 
                      ? 'No receipts match your current filters' 
                      : 'This account hasn\'t received any payments yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedAccountReceipts.receipts.map((receipt: PaymentReceipt) => (
                    <div key={receipt.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">Receipt #{receipt.id}</h4>
                          <p className="text-sm text-gray-600">{new Date(receipt.receipt_date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-green-600">
                            {receipt.amount.toLocaleString()} {receipt.currency || 'TOMAN'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Payer:</span>
                          <span className="ml-2 font-medium">{receipt.payer_name || 'Unknown'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Tracking:</span>
                          <span className="ml-2 font-mono bg-gray-100 px-2 py-1 rounded">...{receipt.tracking_last_5}</span>
                        </div>
                      </div>
                      
                      {receipt.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm text-gray-700">{receipt.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between">
                <button
                  onClick={() => {
                    setShowReceiptModal(false)
                    setSelectedAccountReceipts(null)
                    setReceiptFilters({ payerId: '', trackingSearch: '', startDate: '', endDate: '' })
                    setDatePickerStep(null)
                  }}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 