import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, TrendingUp, DollarSign, TrendingDown } from 'lucide-react'
import { api } from '../lib/api'

interface Position {
  id: number
  original_trade_id: number
  currency: string
  original_amount: number
  remaining_amount: number
  average_cost_rate: number
  trade_number: string
  trade_date: string
  created_at: string
}

interface TradingParty {
  id: number
  name: string
}

interface SellFromPositionRequest {
  position_id: number
  amount: number
  rate: number
  counterparty_id?: number
  settlement_date_base: string
  settlement_date_quote: string
}

export function Positions() {
  const [showSellModal, setShowSellModal] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [sellAmount, setSellAmount] = useState('')
  const [sellRate, setSellRate] = useState('')
  
  const queryClient = useQueryClient()
  
  const { data: positions, isLoading } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: () => api.get('/trades/positions/outstanding').then(res => res.data.data),
  })
  
  const { data: parties } = useQuery<TradingParty[]>({
    queryKey: ['parties'],
    queryFn: () => api.get('/parties').then(res => res.data.data),
  })
  
  const sellFromPositionMutation = useMutation({
    mutationFn: (request: SellFromPositionRequest) => api.post('/trades/positions/sell', request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setShowSellModal(false)
      setSelectedPosition(null)
      setSellAmount('')
      setSellRate('')
    },
  })

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ` ${currency}`
  }

  const calculatePotentialProfit = () => {
    if (!selectedPosition || !sellAmount || !sellRate) return 0
    
    const amount = parseFloat(sellAmount)
    const rate = parseFloat(sellRate)
    
    if (isNaN(amount) || isNaN(rate)) return 0
    
    const saleValue = amount * rate
    const costBasis = amount * selectedPosition.average_cost_rate
    return saleValue - costBasis
  }

  const handleSellFromPosition = (position: Position) => {
    setSelectedPosition(position)
    setSellAmount(position.remaining_amount.toString())
    setShowSellModal(true)
  }

  const handleSubmitSell = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!selectedPosition) return
    
    const formData = new FormData(e.currentTarget)
    const counterpartyId = formData.get('counterparty_id') as string
    
    // Validation: Require counterparty selection
    if (!counterpartyId) {
      alert('Please select a counterparty for the position sale.')
      return
    }
    
    const today = new Date().toISOString().split('T')[0]
    
    const request: SellFromPositionRequest = {
      position_id: selectedPosition.id,
      amount: parseFloat(formData.get('amount') as string),
      rate: parseFloat(formData.get('rate') as string),
      counterparty_id: parseInt(counterpartyId),
      settlement_date_base: formData.get('settlement_date_base') as string || today,
      settlement_date_quote: formData.get('settlement_date_quote') as string || today,
    }
    
    sellFromPositionMutation.mutate(request)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const totalAEDPositions = positions?.filter(p => p.currency === 'AED').reduce((sum, p) => sum + p.remaining_amount, 0) || 0
  const totalTOMANPositions = positions?.filter(p => p.currency === 'TOMAN').reduce((sum, p) => sum + p.remaining_amount, 0) || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Outstanding Positions</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Total Positions</div>
                <div className="text-2xl font-bold text-gray-900">
                  {positions?.length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-8 w-8 text-success-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">AED Positions</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalAEDPositions, 'AED')}
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
                <div className="text-sm font-medium text-gray-500">TOMAN Positions</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalTOMANPositions, 'TOMAN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">All Outstanding Positions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Original Trade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Currency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Original Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remaining Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Average Cost Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trade Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {positions?.map((position) => (
                <tr key={position.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {position.trade_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`badge ${position.currency === 'AED' ? 'badge-success' : 'badge-warning'}`}>
                      {position.currency}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(position.original_amount, position.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(position.remaining_amount, position.currency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {position.average_cost_rate.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(position.trade_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => handleSellFromPosition(position)}
                      className="btn btn-primary btn-sm"
                    >
                      Sell from Position
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sell from Position Modal */}
      {showSellModal && selectedPosition && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Sell from Position: {selectedPosition.trade_number}
              </h3>
              
              {/* Position Info */}
              <div className="bg-gray-50 p-4 rounded-md mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Currency:</span>
                    <span className="ml-2 font-medium">{selectedPosition.currency}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Available:</span>
                    <span className="ml-2 font-medium">{formatCurrency(selectedPosition.remaining_amount, selectedPosition.currency)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Cost:</span>
                    <span className="ml-2 font-medium">{selectedPosition.average_cost_rate.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Trade Date:</span>
                    <span className="ml-2 font-medium">{new Date(selectedPosition.trade_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <form onSubmit={handleSubmitSell} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Amount to Sell *</label>
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      max={selectedPosition.remaining_amount}
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Sale Rate *</label>
                    <input
                      type="number"
                      name="rate"
                      step="0.000001"
                      value={sellRate}
                      onChange={(e) => setSellRate(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </div>
                
                {/* Profit Calculation */}
                {sellAmount && sellRate && (
                  <div className="bg-blue-50 p-4 rounded-md">
                    <div className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span>Sale Value:</span>
                        <span className="font-medium">
                          {formatCurrency(parseFloat(sellAmount) * parseFloat(sellRate), selectedPosition.currency === 'AED' ? 'TOMAN' : 'AED')}
                        </span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>Cost Basis:</span>
                        <span className="font-medium">
                          {formatCurrency(parseFloat(sellAmount) * selectedPosition.average_cost_rate, selectedPosition.currency === 'AED' ? 'TOMAN' : 'AED')}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1">
                        <span>Profit/Loss:</span>
                        <span className={`${calculatePotentialProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {calculatePotentialProfit() >= 0 ? '+' : ''}{formatCurrency(calculatePotentialProfit(), selectedPosition.currency === 'AED' ? 'TOMAN' : 'AED')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="form-label">Counterparty *</label>
                  <select name="counterparty_id" className="form-input" required>
                    <option value="">Select counterparty</option>
                    {parties?.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.name}
                      </option>
                    ))}
                  </select>
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
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={sellFromPositionMutation.isPending}
                    className="btn btn-primary flex-1"
                  >
                    {sellFromPositionMutation.isPending ? 'Selling...' : 'Sell Position'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSellModal(false)
                      setSelectedPosition(null)
                      setSellAmount('')
                      setSellRate('')
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
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