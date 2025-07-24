import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Filter, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'

interface Trade {
  id: number
  trade_number: string
  trade_type: string
  status: string
  base_currency: string
  quote_currency: string
  amount: number
  rate: number
  total_value: number
  counterparty_name?: string
  trade_date: string
  created_at: string
  settlement_date_base: string
  settlement_date_quote: string
  
  // Settlement tracking
  base_settled_amount: number
  quote_settled_amount: number
  is_base_fully_settled: boolean
  is_quote_fully_settled: boolean
  last_settlement_date?: string
  
  // Progress with credit offsets (computed by backend)
  progressAED: number
  progressTOMAN: number
}

interface TradingParty {
  id: number
  name: string
}

interface Position {
  id: number
  currency: string
  remaining_amount: number
  average_cost_rate: number
  trade_number: string
}

export function Trades() {
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('')
  const [tradeType, setTradeType] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('')
  const [quoteCurrency, setQuoteCurrency] = useState('')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('')
  const [buyRate, setBuyRate] = useState('') // For BUY_SELL operations
  const [sellRate, setSellRate] = useState('') // For BUY_SELL operations
  const [buyCounterpartyId, setBuyCounterpartyId] = useState('')
  const [sellCounterpartyId, setSellCounterpartyId] = useState('')
  const [sellFromExistingPosition, setSellFromExistingPosition] = useState(true)
  const [selectedPositionId, setSelectedPositionId] = useState('')
  
  const queryClient = useQueryClient()
  
  const { data: tradesData, isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => api.get('/trades').then(res => res.data),
  })
  
  const { data: parties } = useQuery<TradingParty[]>({
    queryKey: ['parties'],
    queryFn: () => api.get('/parties').then(res => res.data.data),
  })
  
  const { data: positions } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: () => api.get('/trades/positions/outstanding').then(res => res.data.data),
    enabled: tradeType === 'SELL' && sellFromExistingPosition,
  })
  
  const createTradeMutation = useMutation({
    mutationFn: (tradeData: any) => api.post('/trades', tradeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      resetForm()
      setShowForm(false)
    },
  })

  const resetForm = () => {
    setTradeType('')
    setBaseCurrency('')
    setQuoteCurrency('')
    setAmount('')
    setRate('')
    setBuyRate('')
    setSellRate('')
    setBuyCounterpartyId('')
    setSellCounterpartyId('')
    setSellFromExistingPosition(true)
    setSelectedPositionId('')
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ` ${currency}`
  }

  const getStatusBadge = (trade: Trade) => {
    if (trade.status === 'COMPLETED') return 'bg-green-100 text-green-800'
    if (trade.status === 'PARTIAL') return 'bg-yellow-100 text-yellow-800'
    if (trade.status === 'CANCELLED') return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (trade: Trade) => {
    if (trade.status === 'COMPLETED') return 'Completed'
    if (trade.status === 'PARTIAL') {
      const baseDone = trade.is_base_fully_settled ? '✓' : '○'
      const quoteDone = trade.is_quote_fully_settled ? '✓' : '○'
      return `Partial (${baseDone}${trade.base_currency}/${quoteDone}${trade.quote_currency})`
    }
    if (trade.status === 'CANCELLED') return 'Cancelled'
    return 'Pending'
  }

  const SettlementProgressBar = ({ trade }: { trade: Trade }) => {
    // Use backend-computed progress that includes credit offsets
    const baseProgress = trade.base_currency === 'AED' 
      ? (trade.progressAED || 0) * 100 
      : (trade.progressTOMAN || 0) * 100
    const quoteProgress = trade.quote_currency === 'AED' 
      ? (trade.progressAED || 0) * 100 
      : (trade.progressTOMAN || 0) * 100
    
    return (
      <div className="space-y-1">
        <div className="flex items-center space-x-2 text-xs">
          <span className="w-8 font-mono">{trade.base_currency}</span>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                baseProgress === 100 ? 'bg-green-500' : baseProgress > 0 ? 'bg-blue-500' : 'bg-gray-300'
              }`}
              style={{ width: `${baseProgress}%` }}
            />
          </div>
          <span className="w-10 text-right">{baseProgress.toFixed(0)}%</span>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <span className="w-8 font-mono">{trade.quote_currency}</span>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                quoteProgress === 100 ? 'bg-green-500' : quoteProgress > 0 ? 'bg-blue-500' : 'bg-gray-300'
              }`}
              style={{ width: `${quoteProgress}%` }}
            />
          </div>
          <span className="w-10 text-right">{quoteProgress.toFixed(0)}%</span>
        </div>
      </div>
    )
  }

  // Calculate instant profit for BUY_SELL operations
  const calculateBuySellProfit = () => {
    if (!amount || !buyRate || !sellRate) return 0
    
    const amountNum = parseFloat(amount)
    const buyRateNum = parseFloat(buyRate)
    const sellRateNum = parseFloat(sellRate)
    
    if (isNaN(amountNum) || isNaN(buyRateNum) || isNaN(sellRateNum)) return 0
    
    const buyValue = amountNum * buyRateNum
    const sellValue = amountNum * sellRateNum
    return sellValue - buyValue
  }

  // Get available positions for the selected currency
  const availablePositions = positions?.filter(p => p.currency === baseCurrency) || []

  // Calculate total available position amount
  const totalAvailableAmount = availablePositions.reduce((sum, p) => sum + p.remaining_amount, 0)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    let tradeData: any = {
      trade_type: tradeType,
      base_currency: baseCurrency,
      quote_currency: quoteCurrency,
      amount: Number(amount),
      trade_date: formData.get('trade_date'),
      settlement_date_base: formData.get('settlement_date_base'),
      settlement_date_quote: formData.get('settlement_date_quote'),
    }

    // Handle different trade types
    if (tradeType === 'BUY_SELL') {
      tradeData.rate = Number(buyRate) // Use buy rate as the base rate
      tradeData.buy_rate = Number(buyRate)
      tradeData.sell_rate = Number(sellRate)
      tradeData.buy_counterparty_id = buyCounterpartyId ? Number(buyCounterpartyId) : undefined
      tradeData.sell_counterparty_id = sellCounterpartyId ? Number(sellCounterpartyId) : undefined
      
      // Validation: Require at least one counterparty for BUY_SELL
      if (!buyCounterpartyId && !sellCounterpartyId) {
        alert('Please select at least one counterparty for the transaction.')
        return
      }
    } else {
      tradeData.rate = Number(rate)
      if (tradeType === 'BUY') {
        if (!buyCounterpartyId) {
          alert('Please select a counterparty for the BUY transaction.')
          return
        }
        tradeData.counterparty_id = Number(buyCounterpartyId)
      } else if (tradeType === 'SELL') {
        if (!sellCounterpartyId) {
          alert('Please select a counterparty for the SELL transaction.')
          return
        }
        tradeData.counterparty_id = Number(sellCounterpartyId)
        if (sellFromExistingPosition && selectedPositionId) {
          tradeData.position_id = Number(selectedPositionId)
        }
      }
    }
    
    createTradeMutation.mutate(tradeData)
  }

  // Auto-select quote currency when base currency changes
  useEffect(() => {
    if (baseCurrency) {
      setQuoteCurrency(baseCurrency === 'AED' ? 'TOMAN' : 'AED')
    }
  }, [baseCurrency])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Trades</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Trade
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search trades..."
                  className="form-input pl-10"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </div>
            <button className="btn btn-secondary">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Trades Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">All Trades</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trade #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Currency Pair
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Counterparty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Settlement Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tradesData?.data?.map((trade: Trade) => (
                <tr key={trade.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {trade.trade_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`badge ${trade.trade_type === 'BUY' ? 'badge-success' : trade.trade_type === 'SELL' ? 'badge-danger' : 'badge-primary'}`}>
                      {trade.trade_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trade.base_currency}/{trade.quote_currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(trade.amount, trade.base_currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trade.rate.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(trade.total_value, trade.quote_currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {trade.counterparty_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(trade)}`}>
                      {getStatusText(trade)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <SettlementProgressBar trade={trade} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(trade.trade_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enhanced Trade Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Trade</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">Trade Type</label>
                  <select 
                    value={tradeType} 
                    onChange={(e) => setTradeType(e.target.value)}
                    className="form-input" 
                    required
                  >
                    <option value="">Select type</option>
                    <option value="BUY">Buy</option>
                    <option value="SELL">Sell</option>
                    <option value="BUY_SELL">Buy & Sell (Simultaneous)</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Base Currency</label>
                    <select 
                      value={baseCurrency}
                      onChange={(e) => setBaseCurrency(e.target.value)}
                      className="form-input" 
                      required
                    >
                      <option value="">Select</option>
                      <option value="AED">AED</option>
                      <option value="TOMAN">TOMAN</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Quote Currency</label>
                    <select 
                      value={quoteCurrency}
                      onChange={(e) => setQuoteCurrency(e.target.value)}
                      className="form-input" 
                      required
                    >
                      <option value="">Select</option>
                      <option value="AED">AED</option>
                      <option value="TOMAN">TOMAN</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="form-label">Amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    step="0.01"
                    className="form-input"
                    required
                  />
                </div>

                {/* SELL Type Specific Options */}
                {tradeType === 'SELL' && (
                  <div className="bg-yellow-50 p-4 rounded-md">
                    <h4 className="font-medium text-gray-900 mb-3">Sell Options</h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            checked={sellFromExistingPosition}
                            onChange={() => setSellFromExistingPosition(true)}
                            className="mr-2"
                          />
                          Sell from existing positions
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            checked={!sellFromExistingPosition}
                            onChange={() => setSellFromExistingPosition(false)}
                            className="mr-2"
                          />
                          Short sell (no existing position)
                        </label>
                      </div>
                      
                      {sellFromExistingPosition && baseCurrency && (
                        <div>
                          <div className="text-sm text-gray-600 mb-2">
                            Available {baseCurrency} positions: {formatCurrency(totalAvailableAmount, baseCurrency)}
                          </div>
                          {availablePositions.length > 0 ? (
                            <select 
                              value={selectedPositionId}
                              onChange={(e) => setSelectedPositionId(e.target.value)}
                              className="form-input"
                            >
                              <option value="">Sell from all positions (FIFO)</option>
                              {availablePositions.map((position) => (
                                <option key={position.id} value={position.id}>
                                  {position.trade_number} - {formatCurrency(position.remaining_amount, position.currency)} @ {position.average_cost_rate}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-red-600 text-sm">
                              No {baseCurrency} positions available. Consider short selling instead.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Rate Section */}
                {tradeType === 'BUY_SELL' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Buy Rate</label>
                      <input
                        type="number"
                        value={buyRate}
                        onChange={(e) => setBuyRate(e.target.value)}
                        step="0.000001"
                        className="form-input"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Sell Rate</label>
                      <input
                        type="number"
                        value={sellRate}
                        onChange={(e) => setSellRate(e.target.value)}
                        step="0.000001"
                        className="form-input"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="form-label">Rate</label>
                    <input
                      type="number"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      step="0.000001"
                      className="form-input"
                      required
                    />
                  </div>
                )}

                {/* Instant Profit Calculation for BUY_SELL */}
                {tradeType === 'BUY_SELL' && amount && buyRate && sellRate && (
                  <div className="bg-blue-50 p-4 rounded-md">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Instant Profit Calculation
                    </h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Buy Value:</span>
                        <span>{formatCurrency(parseFloat(amount) * parseFloat(buyRate), quoteCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sell Value:</span>
                        <span>{formatCurrency(parseFloat(amount) * parseFloat(sellRate), quoteCurrency)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1">
                        <span>Profit/Loss:</span>
                        <span className={`${calculateBuySellProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {calculateBuySellProfit() >= 0 ? '+' : ''}{formatCurrency(calculateBuySellProfit(), quoteCurrency)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Counterparty Section */}
                {tradeType === 'BUY_SELL' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Buy From (Seller)</label>
                      <select 
                        value={buyCounterpartyId}
                        onChange={(e) => setBuyCounterpartyId(e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select seller</option>
                        {parties?.map((party) => (
                          <option key={party.id} value={party.id}>
                            {party.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Sell To (Buyer)</label>
                      <select 
                        value={sellCounterpartyId}
                        onChange={(e) => setSellCounterpartyId(e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select buyer</option>
                        {parties?.map((party) => (
                          <option key={party.id} value={party.id}>
                            {party.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="form-label">
                      {tradeType === 'BUY' ? 'Buy From (Seller)' : 'Sell To (Buyer)'}
                    </label>
                    <select 
                      value={tradeType === 'BUY' ? buyCounterpartyId : sellCounterpartyId}
                      onChange={(e) => {
                        if (tradeType === 'BUY') {
                          setBuyCounterpartyId(e.target.value)
                        } else {
                          setSellCounterpartyId(e.target.value)
                        }
                      }}
                      className="form-input"
                    >
                      <option value="">Select counterparty</option>
                      {parties?.map((party) => (
                        <option key={party.id} value={party.id}>
                          {party.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="form-label">Trade Date</label>
                  <input
                    type="date"
                    name="trade_date"
                    className="form-input"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Settlement Date (Base)</label>
                    <input
                      type="date"
                      name="settlement_date_base"
                      className="form-input"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Settlement Date (Quote)</label>
                    <input
                      type="date"
                      name="settlement_date_quote"
                      className="form-input"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      resetForm()
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createTradeMutation.isPending}
                    className="btn btn-primary"
                  >
                    {createTradeMutation.isPending ? 'Creating...' : 'Create Trade'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 