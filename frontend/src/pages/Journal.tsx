import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, DollarSign, TrendingUp, Users, Search } from 'lucide-react'
import { api } from '../lib/api'

interface JournalEntry {
  id: number
  entry_number: string
  trade_id?: number
  trade_number?: string
  description: string
  entry_date: string
  created_at: string
  lines: JournalEntryLine[]
}

interface JournalEntryLine {
  id: number
  journal_entry_id: number
  account_code: string
  account_name: string
  debit_amount: number
  credit_amount: number
  currency: string
  created_at: string
}

interface AccountBalance {
  account_code: string
  account_name: string
  account_type: string
  currency: string
  balance: number
}

interface CounterpartyBalance {
  counterparty_id: number
  counterparty_name: string
  aed_balance: number
  toman_balance: number
  total_trades: number
}

export function Journal() {
  const [searchTerm, setSearchTerm] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'entries' | 'balances' | 'counterparties'>('entries')
  
  const { data: journalEntries, isLoading: entriesLoading } = useQuery<JournalEntry[]>({
    queryKey: ['journal-entries'],
    queryFn: () => api.get('/journal/entries').then(res => res.data.data),
  })
  
  const { data: accountBalances, isLoading: balancesLoading } = useQuery<AccountBalance[]>({
    queryKey: ['account-balances'],
    queryFn: () => api.get('/journal/balances').then(res => res.data.data),
  })

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ` ${currency}`
  }

  const filteredEntries = journalEntries?.filter(entry => {
    const matchesSearch = 
      entry.entry_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.trade_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesAccount = !accountFilter || entry.lines.some(line => 
      line.account_code.includes(accountFilter) || 
      line.account_name.toLowerCase().includes(accountFilter.toLowerCase())
    )
    
    const matchesCurrency = !currencyFilter || entry.lines.some(line => 
      line.currency === currencyFilter
    )
    
    return matchesSearch && matchesAccount && matchesCurrency
  }) || []

  const filteredBalances = accountBalances?.filter(balance => {
    const matchesSearch = 
      balance.account_code.includes(searchTerm) ||
      balance.account_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCurrency = !currencyFilter || balance.currency === currencyFilter
    
    return matchesSearch && matchesCurrency
  }) || []

  if (entriesLoading || balancesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Calculate summary statistics
  const totalEntries = journalEntries?.length || 0
  const aedBalances = accountBalances?.filter(b => b.currency === 'AED') || []
  const tomanBalances = accountBalances?.filter(b => b.currency === 'TOMAN') || []
  const assetsAED = aedBalances.filter(b => b.account_type === 'ASSET').reduce((sum, b) => sum + b.balance, 0)
  const assetsTOMAN = tomanBalances.filter(b => b.account_type === 'ASSET').reduce((sum, b) => sum + b.balance, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Journal & Accounting</h1>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('entries')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'entries'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BookOpen className="h-4 w-4 inline mr-2" />
            Journal Entries
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'balances'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign className="h-4 w-4 inline mr-2" />
            Account Balances
          </button>
          <button
            onClick={() => setActiveTab('counterparties')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'counterparties'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Counterparty Balances
          </button>
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'entries' ? "Search entries, descriptions, or trade numbers..." : "Search accounts or counterparties..."}
                  className="form-input pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            {activeTab === 'entries' && (
              <input
                type="text"
                placeholder="Account filter"
                className="form-input w-40"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
              />
            )}
            
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="form-input w-32"
            >
              <option value="">All Currencies</option>
              <option value="AED">AED</option>
              <option value="TOMAN">TOMAN</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpen className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Total Entries</div>
                <div className="text-2xl font-bold text-gray-900">
                  {totalEntries}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-success-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Assets (AED)</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(assetsAED, 'AED')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-warning-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Assets (TOMAN)</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(assetsTOMAN, 'TOMAN')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Account Types</div>
                <div className="text-2xl font-bold text-gray-900">
                  {new Set(accountBalances?.map(b => b.account_type)).size}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Journal Entries Tab */}
      {activeTab === 'entries' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Journal Entries</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entry Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredEntries.map((entry) => (
                  entry.lines.map((line, index) => (
                    <tr key={`${entry.id}-${line.id}`} className={`${index === 0 ? 'border-t-2 border-primary-200' : ''} hover:bg-gray-50`}>
                      {index === 0 && (
                        <td className={`px-6 py-4 whitespace-nowrap border-r border-gray-200`} rowSpan={entry.lines.length}>
                          <div className="text-sm font-medium text-gray-900">
                            {entry.entry_number}
                          </div>
                          <div className="text-sm text-gray-500 max-w-xs">
                            {entry.description}
                          </div>
                          {entry.trade_number && (
                            <div className="text-xs text-primary-600 mt-1">
                              Trade: {entry.trade_number}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {line.account_code} - {line.account_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {line.currency}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {line.debit_amount > 0 ? formatCurrency(line.debit_amount, line.currency) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {line.credit_amount > 0 ? formatCurrency(line.credit_amount, line.currency) : '-'}
                      </td>
                      {index === 0 && (
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500`} rowSpan={entry.lines.length}>
                          {new Date(entry.entry_date).toLocaleDateString()}
                        </td>
                      )}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Account Balances Tab */}
      {activeTab === 'balances' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Account Balances</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Currency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBalances.map((balance) => (
                  <tr key={`${balance.account_code}-${balance.currency}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {balance.account_code} - {balance.account_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge ${
                        balance.account_type === 'ASSET' ? 'badge-success' :
                        balance.account_type === 'LIABILITY' ? 'badge-danger' :
                        balance.account_type === 'EQUITY' ? 'badge-primary' :
                        balance.account_type === 'REVENUE' ? 'badge-success' :
                        'badge-warning'
                      }`}>
                        {balance.account_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`badge ${balance.currency === 'AED' ? 'badge-success' : 'badge-warning'}`}>
                        {balance.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`${balance.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatCurrency(Math.abs(balance.balance), balance.currency)}
                        {balance.balance < 0 ? ' (CR)' : ' (DR)'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Counterparty Balances Tab */}
      {activeTab === 'counterparties' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Counterparty Balances</h3>
          </div>
          <div className="card-body">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Counterparty balance tracking coming soon...</p>
              <p className="text-sm text-gray-400 mt-2">
                This feature will show detailed balance tracking for each trading party
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 