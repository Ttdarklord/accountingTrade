import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Filter, Receipt, Eye, Banknote, DollarSign, Users, X, Archive, CheckCircle, CreditCard, UserCheck, Calendar, FileText, Edit as EditIcon } from 'lucide-react'
import { api } from '../lib/api'
import { format } from 'date-fns'

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
  receiver_account_number?: string
  receiver_bank_name?: string
  receiver_counterpart_name?: string
  currency?: 'AED' | 'TOMAN'
  receipt_type?: 'pay' | 'receive'
  individual_name?: string
  trading_party_id?: number
  trading_party_name?: string
  
  // Soft deletion and audit fields
  is_deleted?: boolean
  deleted_at?: string
  deletion_reason?: string
  deletion_reason_category?: 'duplicate' | 'funds_returned' | 'receipt_not_landed' | 'data_error' | 'other'
  deleted_by?: string
  
  // Restoration fields
  is_restored?: boolean
  restored_at?: string
  restoration_reason?: string
  restored_by?: string
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

interface BankAccount {
  id: number
  account_number: string
  bank_name: string
  currency: 'AED' | 'TOMAN'
  counterpart_id: number
  is_active: boolean
  created_at: string
  counterpart_name?: string
}

export default function Receipts() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null)
  const [receiptToEdit, setReceiptToEdit] = useState<PaymentReceipt | null>(null)
  const [receiptType, setReceiptType] = useState<'TOMAN' | 'AED'>('TOMAN')
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'TOMAN' | 'AED'>('ALL')
  const [accountSearchTerm, setAccountSearchTerm] = useState('')
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  // Form state for creating new receipts
  const [formData, setFormData] = useState({
    // Common fields
    amount: '',
    receipt_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    tracking_last_5: '', // Add tracking field for user input
    
    // TOMAN receipt fields
    payer_id: 0,
    receiver_account_id: 0,
    
    // AED receipt fields
    receipt_type: 'receive' as 'pay' | 'receive',
    trading_party_id: 0,
    individual_name: ''
  })

  // Deletion confirmation dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [receiptToDelete, setReceiptToDelete] = useState<PaymentReceipt | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteReasonCategory, setDeleteReasonCategory] = useState<'duplicate' | 'funds_returned' | 'receipt_not_landed' | 'data_error' | 'other'>('duplicate')
  
  // View mode for archived receipts
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active')
  
  // Restoration dialog state
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [receiptToRestore, setReceiptToRestore] = useState<PaymentReceipt | null>(null)
  const [restoreReason, setRestoreReason] = useState('')

  const queryClient = useQueryClient()

  // Fetch receipts
  const { data: receiptsData } = useQuery({
    queryKey: ['receipts', viewMode],
    queryFn: () => {
      const params = new URLSearchParams()
      if (viewMode === 'archived') {
        params.append('only_deleted', 'true')
      }
      const queryString = params.toString()
      return api.get(`/receipts${queryString ? `?${queryString}` : ''}`).then(res => res.data.data)
    },
  })

  // Fetch trading parties for payer selection
  const { data: partiesData } = useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      const response = await api.get('/parties')
      return response.data.data
    }
  })

  // Fetch active bank accounts for receiver selection
  const { data: accountsData } = useQuery({
    queryKey: ['accounts', 'active'],
    queryFn: async () => {
      const response = await api.get('/accounts?active=true')
      return response.data.data
    }
  })

  // Create receipt mutation
  const createReceiptMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/receipts', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] }) // Add this line - settlement processing updates trade data
      setShowModal(false)
      resetForm()
      // Show success message
      alert('Receipt created successfully!')
    },
    onError: (error: any) => {
      console.error('Error creating receipt:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred'
      alert(`Failed to create receipt: ${errorMessage}`)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: ({ receiptId, reason, reasonCategory }: { receiptId: number, reason: string, reasonCategory: string }) => 
      api.put(`/receipts/${receiptId}/delete`, {
        reason,
        reason_category: reasonCategory,
        deleted_by: 'User' // You can enhance this with actual user tracking
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['counterparts'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] }) // Add this line - settlement reversal updates trade data
      setShowDeleteConfirm(false)
      setReceiptToDelete(null)
      setDeleteReason('')
      setDeleteReasonCategory('duplicate')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: ({ receiptId, reason }: { receiptId: number, reason: string }) => 
      api.put(`/receipts/${receiptId}/restore`, {
        reason,
        restored_by: 'User' // You can enhance this with actual user tracking
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['counterparts'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] }) // Add this line - settlement reprocessing updates trade data
      setShowRestoreConfirm(false)
      setReceiptToRestore(null)
      setRestoreReason('')
    },
  })

  // Edit receipt mutation
  const editReceiptMutation = useMutation({
    mutationFn: async ({ receiptId, data }: { receiptId: number, data: any }) => {
      const response = await api.put(`/receipts/${receiptId}/edit`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['counterparts'] })
      setShowEditModal(false)
      setReceiptToEdit(null)
      resetForm()
      alert('Receipt updated successfully!')
    },
    onError: (error: any) => {
      console.error('Error updating receipt:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred'
      alert(`Failed to update receipt: ${errorMessage}`)
    }
  })

  const resetForm = () => {
    setFormData({
      amount: '',
      receipt_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      tracking_last_5: '',
      payer_id: 0,
      receiver_account_id: 0,
      receipt_type: 'receive',
      trading_party_id: 0,
      individual_name: ''
    })
    setAccountSearchTerm('')
    setShowAccountDropdown(false)
    setSelectedAccount(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (receiptType === 'TOMAN') {
      if (formData.payer_id === 0) {
        alert('Please select a payer')
        return
      }

      if (formData.receiver_account_id === 0) {
        alert('Please select a receiver account')
        return
      }

      if (!formData.tracking_last_5.trim()) {
        alert('Please enter a tracking number')
        return
      }
    } else {
      // AED receipt validation
      if (formData.trading_party_id === 0) {
        alert('Please select a trading party')
        return
      }

      if (!formData.individual_name.trim()) {
        alert('Please enter the individual name')
        return
      }
    }

    // Prepare payload based on receipt type
    let payload: any = {
      amount: Number(formData.amount.replace(/,/g, '')),
      currency: receiptType,
      receipt_date: formData.receipt_date,
      notes: formData.notes
    }

    if (receiptType === 'TOMAN') {
      // For TOMAN receipts, use user-provided tracking number
      payload.payer_id = formData.payer_id
      payload.receiver_account_id = formData.receiver_account_id
      payload.tracking_last_5 = formData.tracking_last_5
    } else {
      // For AED receipts, auto-generate 5-digit tracking number
      const autoTracking = Math.floor(10000 + Math.random() * 90000).toString()
      payload.tracking_last_5 = autoTracking
      payload.receipt_type = formData.receipt_type
      payload.trading_party_id = formData.trading_party_id
      payload.individual_name = formData.individual_name
    }

    if (showEditModal && receiptToEdit) {
      editReceiptMutation.mutate({ receiptId: receiptToEdit.id, data: payload })
    } else {
      createReceiptMutation.mutate(payload)
    }
  }

  const handleDelete = (receipt: PaymentReceipt) => {
    setReceiptToDelete(receipt)
    setShowDeleteConfirm(true)
  }

  const handleEdit = (receipt: PaymentReceipt) => {
    setReceiptToEdit(receipt)
    setReceiptType(receipt.currency as 'TOMAN' | 'AED')
    
    // For TOMAN receipts, find and set the selected account
    if (receipt.currency === 'TOMAN' && receipt.receiver_account_id && accountsData) {
      const account = accountsData.find((acc: BankAccount) => acc.id === receipt.receiver_account_id)
      if (account) {
        setSelectedAccount(account)
        setAccountSearchTerm(`${account.counterpart_name} - ${account.bank_name}`)
      }
    }
    
    // Populate form with existing data
    setFormData({
      amount: receipt.amount.toLocaleString(),
      receipt_date: receipt.receipt_date,
      notes: receipt.notes || '',
      tracking_last_5: receipt.tracking_last_5,
      payer_id: receipt.payer_id || 0,
      receiver_account_id: receipt.receiver_account_id || 0,
      receipt_type: receipt.receipt_type as 'pay' | 'receive' || 'receive',
      trading_party_id: receipt.trading_party_id || 0,
      individual_name: receipt.individual_name || ''
    })
    
    setShowEditModal(true)
  }

  const handleDeleteConfirm = () => {
    if (!receiptToDelete || !deleteReason.trim()) {
      alert('Please provide a reason for deletion')
      return
    }
    
    deleteMutation.mutate({
      receiptId: receiptToDelete.id,
      reason: deleteReason,
      reasonCategory: deleteReasonCategory
    })
  }

  const handleRestore = (receipt: PaymentReceipt) => {
    setReceiptToRestore(receipt)
    setShowRestoreConfirm(true)
  }

  const handleRestoreConfirm = () => {
    if (!receiptToRestore || !restoreReason.trim()) {
      alert('Please provide a reason for restoration')
      return
    }
    
    restoreMutation.mutate({
      receiptId: receiptToRestore.id,
      reason: restoreReason
    })
  }

  const formatAmount = (amount: number) => {
    return amount.toLocaleString()
  }

  // Filter receipts
  const filteredReceipts = (receiptsData || []).filter((receipt: PaymentReceipt) => {
    const matchesSearch = 
      (receipt.payer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.tracking_last_5.includes(searchTerm) ||
      (receipt.receiver_bank_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (receipt.receiver_counterpart_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (receipt.individual_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCurrency = currencyFilter === 'ALL' || 
      (currencyFilter === 'TOMAN' && (!receipt.currency || receipt.currency === 'TOMAN')) ||
      (currencyFilter === 'AED' && receipt.currency === 'AED')
    
    return matchesSearch && matchesCurrency
  })

  // selectedAccount is managed as state for both creation and editing

  // Calculate stats by currency
  const tomanReceipts = (receiptsData || []).filter((r: PaymentReceipt) => !r.currency || r.currency === 'TOMAN')
  const aedReceipts = (receiptsData || []).filter((r: PaymentReceipt) => r.currency === 'AED')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Receipts</h1>
            <p className="text-gray-600 mt-1">Track and manage TOMAN & AED payment receipts with automatic balance updates</p>
          </div>
          <div className="flex items-center space-x-3">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('active')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'active'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Receipt className="h-4 w-4 mr-2 inline" />
                Active
              </button>
              <button
                onClick={() => setViewMode('archived')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'archived'
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Archive className="h-4 w-4 mr-2 inline" />
                Archived
              </button>
            </div>
            
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
              disabled={viewMode === 'archived'}
            >
              <Plus className="h-5 w-5" />
              <span>Add Receipt</span>
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by payer, tracking number, bank, counterpart, or individual..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Currency Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                className="border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value as 'ALL' | 'TOMAN' | 'AED')}
              >
                <option value="ALL">All Currency</option>
                <option value="TOMAN">TOMAN Only</option>
                <option value="AED">AED Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Receipts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {receiptsData?.length || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Banknote className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">TOMAN Total</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatAmount(tomanReceipts.reduce((sum: number, r: PaymentReceipt) => sum + r.amount, 0))}
                  <span className="text-sm font-medium text-gray-600 ml-1">T</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">AED Total</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatAmount(aedReceipts.reduce((sum: number, r: PaymentReceipt) => sum + r.amount, 0))}
                  <span className="text-sm font-medium text-gray-600 ml-1">AED</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Parties</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(receiptsData?.map((r: PaymentReceipt) => r.payer_id || r.trading_party_id) || []).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Receipts Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {viewMode === 'active' ? 'Active Receipts' : 'Archived Receipts'}
            </h2>
          </div>
          
          {filteredReceipts.length === 0 ? (
            <div className="text-center py-12">
              {viewMode === 'active' ? (
                <>
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm ? 'No receipts match your search' : 'No active receipts found'}
                  </h3>
                  <p className="text-gray-600">
                    {!searchTerm && 'Get started by adding your first receipt'}
                  </p>
                </>
              ) : (
                <>
                  <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm ? 'No archived receipts match your search' : 'No archived receipts'}
                  </h3>
                  <p className="text-gray-600">
                    Deleted receipts will appear here and can be restored if needed
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
              {filteredReceipts.map((receipt: PaymentReceipt) => (
                <div key={receipt.id} className={`border-2 rounded-lg p-5 hover:shadow-md transition-shadow duration-200 ${
                  receipt.currency === 'AED' 
                    ? 'border-yellow-200 bg-yellow-50' 
                    : 'border-blue-200 bg-blue-50'
                } ${viewMode === 'archived' ? 'opacity-75 border-dashed' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        receipt.currency === 'AED' 
                          ? 'bg-yellow-100' 
                          : 'bg-blue-100'
                      }`}>
                        {viewMode === 'archived' ? (
                          <Archive className={`h-4 w-4 ${
                            receipt.currency === 'AED' 
                              ? 'text-yellow-600' 
                              : 'text-blue-600'
                          }`} />
                        ) : (
                          <Receipt className={`h-4 w-4 ${
                            receipt.currency === 'AED' 
                              ? 'text-yellow-600' 
                              : 'text-blue-600'
                          }`} />
                        )}
                      </div>
                      <span className="font-medium text-gray-900">#{receipt.id}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        receipt.currency === 'AED' 
                          ? 'bg-yellow-200 text-yellow-800' 
                          : 'bg-blue-200 text-blue-800'
                      }`}>
                        {receipt.currency || 'TOMAN'}
                      </span>
                      {viewMode === 'archived' && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          ARCHIVED
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(receipt.receipt_date).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Show deletion info for archived receipts */}
                    {viewMode === 'archived' && receipt.deleted_at && (
                      <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                        <p className="text-xs text-red-600 font-medium">
                          Deleted: {new Date(receipt.deleted_at).toLocaleDateString()}
                        </p>
                        {receipt.deletion_reason && (
                          <p className="text-xs text-red-700 mt-1">
                            {receipt.deletion_reason_category}: {receipt.deletion_reason}
                          </p>
                        )}
                        {receipt.restored_at && (
                          <p className="text-xs text-green-700 mt-1 font-medium">
                            ↻ Restored: {new Date(receipt.restored_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}

                    {receipt.currency === 'AED' ? (
                      <>
                        {/* AED Receipt Fields */}
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Receipt Type</p>
                          <p className="font-medium text-gray-900 capitalize">
                            {receipt.receipt_type === 'pay' 
                              ? `Agrivex → ${receipt.trading_party_name || 'Unknown'}`
                              : `${receipt.trading_party_name || 'Unknown'} → Agrivex`
                            }
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* TOMAN Receipt Fields */}
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Payer</p>
                          <p className="font-medium text-gray-900">{receipt.payer_name || 'Unknown'}</p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Receiver</p>
                          <p className="font-medium text-gray-900">{receipt.receiver_counterpart_name}</p>
                          <p className="text-sm text-gray-600">
                            {receipt.receiver_bank_name}
                            {receipt.receiver_account_number && (
                              <span className="ml-1 font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
                                ...{receipt.receiver_account_number.slice(-5)}
                              </span>
                            )}
                          </p>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          {receipt.currency === 'AED' ? 'Reference' : 'Tracking'}
                        </p>
                        <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          ...{receipt.tracking_last_5}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Amount</p>
                        <p className={`font-bold text-lg ${
                          receipt.currency === 'AED' 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}>
                          {formatAmount(receipt.amount)}
                          <span className="text-sm font-medium text-gray-600 ml-1">
                            {receipt.currency === 'AED' ? 'AED' : 'T'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {receipt.notes && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Notes</p>
                        <p className="text-sm text-gray-700">{receipt.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setSelectedReceipt(receipt)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                      {viewMode === 'active' && (
                        <button
                          onClick={() => handleEdit(receipt)}
                          className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center space-x-1"
                        >
                          <EditIcon className="h-4 w-4" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                    {viewMode === 'active' ? (
                      <button
                        onClick={() => handleDelete(receipt)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestore(receipt)}
                        className="text-green-600 hover:text-green-700 text-sm font-medium"
                        disabled={restoreMutation.isPending}
                      >
                        {restoreMutation.isPending ? 'Restoring...' : 'Restore'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Add New Receipt</h3>
                  <p className="text-gray-600 mt-1">Record a payment with automatic balance updates</p>
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
            
            {/* Info Banner */}
            <div className="p-6 bg-blue-50 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Automatic Processing</p>
                  <p className="text-sm text-blue-700">
                    {receiptType === 'TOMAN' 
                      ? 'Bank transfer receipts in TOMAN. Counterpart balances will be updated automatically.'
                      : 'Cash transaction receipts in AED. Individual cash collection/payment tracking.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Currency Toggle */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Receipt Type
                </h4>
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => setReceiptType('TOMAN')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      receiptType === 'TOMAN'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${receiptType === 'TOMAN' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <span className="font-medium">TOMAN Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptType('AED')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      receiptType === 'AED'
                        ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${receiptType === 'AED' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                    <span className="font-medium">AED Receipt</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {receiptType === 'TOMAN' 
                    ? 'Bank transfer between trading party accounts'
                    : 'Cash payment to/from individuals for AED transactions'
                  }
                </p>
              </div>

              {receiptType === 'TOMAN' ? (
                <>
                  {/* TOMAN Receipt Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Users className="h-4 w-4 inline mr-1" />
                        Who Paid? *
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData.payer_id}
                        onChange={(e) => setFormData({ ...formData, payer_id: parseInt(e.target.value) })}
                        required
                      >
                        <option value={0}>Select the payer</option>
                        {(partiesData || []).map((party: TradingParty) => (
                          <option key={party.id} value={party.id}>
                            {party.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <CreditCard className="h-4 w-4 inline mr-1" />
                        Receiver Account *
                      </label>
                      
                      {/* Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search by trading party or account number..."
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={accountSearchTerm}
                          onChange={(e) => {
                            setAccountSearchTerm(e.target.value)
                            setShowAccountDropdown(true)
                          }}
                          onFocus={() => setShowAccountDropdown(true)}
                        />
                        <Search className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                      
                      {/* Dropdown */}
                      {showAccountDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {(() => {
                            const filteredAccounts = (accountsData || [])
                              .filter((account: BankAccount) => account.currency === 'TOMAN')
                              .filter((account: BankAccount) => {
                                const searchLower = accountSearchTerm.toLowerCase()
                                const last5Digits = account.account_number.slice(-5)
                                return (
                                  (account.counterpart_name || '').toLowerCase().includes(searchLower) ||
                                  account.bank_name.toLowerCase().includes(searchLower) ||
                                  last5Digits.includes(searchLower) ||
                                  account.account_number.includes(searchLower)
                                )
                              })
                            
                            if (filteredAccounts.length === 0) {
                              return (
                                <div className="p-4 text-center text-gray-500">
                                  No accounts found matching your search
                                </div>
                              )
                            }
                            
                            return filteredAccounts.map((account: BankAccount) => {
                              const last5Digits = account.account_number.slice(-5)
                              return (
                                <button
                                  key={account.id}
                                  type="button"
                                  className={`w-full text-left p-4 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                                    formData.receiver_account_id === account.id ? 'bg-blue-50 border-blue-200' : ''
                                  }`}
                                  onClick={() => {
                                    setFormData({ ...formData, receiver_account_id: account.id })
                                    setAccountSearchTerm(`${account.counterpart_name} - ${account.bank_name} (...${last5Digits})`)
                                    setShowAccountDropdown(false)
                                  }}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        {account.counterpart_name}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {account.bank_name}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                        ...{last5Digits}
                                      </div>
                                      <div className="text-xs text-blue-600 mt-1">
                                        {account.currency}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              )
                            })
                          })()}
                        </div>
                      )}
                      
                      {/* Click outside to close dropdown */}
                      {showAccountDropdown && (
                        <div 
                          className="fixed inset-0 z-5" 
                          onClick={() => setShowAccountDropdown(false)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Account Details */}
                  {selectedAccount && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Selected Account Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Owner:</span>
                          <span className="ml-2 font-medium">{selectedAccount.counterpart_name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Bank:</span>
                          <span className="ml-2 font-medium">
                            {selectedAccount.bank_name}
                            <span className="ml-1 font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
                              ...{selectedAccount.account_number.slice(-5)}
                            </span>
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Account:</span>
                          <span className="ml-2 font-mono">{selectedAccount.account_number}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Currency:</span>
                          <span className="ml-2 font-medium">{selectedAccount.currency}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tracking Number for TOMAN */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Receipt className="h-4 w-4 inline mr-1" />
                      Tracking Number *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter tracking number (e.g., 12345)"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.tracking_last_5}
                      onChange={(e) => setFormData({ ...formData, tracking_last_5: e.target.value })}
                      required
                      maxLength={20}
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter the tracking number for this transfer</p>
                  </div>
                </>
              ) : (
                <>
                  {/* AED Receipt Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Users className="h-4 w-4 inline mr-1" />
                        Receipt Type *
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        value={formData.receipt_type}
                        onChange={(e) => setFormData({ ...formData, receipt_type: e.target.value as 'pay' | 'receive' })}
                        required
                      >
                        <option value="pay">Pay (Agrivex pays to individual)</option>
                        <option value="receive">Receive (Individual pays to Agrivex)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Users className="h-4 w-4 inline mr-1" />
                        Trading Party *
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        value={formData.trading_party_id}
                        onChange={(e) => setFormData({ ...formData, trading_party_id: parseInt(e.target.value) })}
                        required
                      >
                        <option value={0}>Select trading party</option>
                        {(partiesData || []).map((party: TradingParty) => (
                          <option key={party.id} value={party.id}>
                            {party.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <UserCheck className="h-4 w-4 inline mr-1" />
                      Individual Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Name of person handling cash collection/payment"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      value={formData.individual_name}
                      onChange={(e) => setFormData({ ...formData, individual_name: e.target.value })}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Name of the individual who collected/paid cash</p>
                  </div>
                </>
              )}

              {/* Common Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    Amount {receiptType === 'AED' ? '(AED)' : '(TOMAN)'} *
                  </label>
                  <input
                    type="text"
                    placeholder={receiptType === 'TOMAN' ? '1,000,000' : '1,000'}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.amount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/,/g, '')
                      if (/^\d*$/.test(value)) {
                        setFormData({ ...formData, amount: value ? parseInt(value).toLocaleString() : '' })
                      }
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Receipt Date *
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.receipt_date}
                  onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4 inline mr-1" />
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Add any additional notes about this receipt..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Actions */}
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
                  className={`px-6 py-3 ${receiptType === 'TOMAN' 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' 
                    : 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800'
                  } text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50`}
                  disabled={createReceiptMutation.isPending}
                >
                  {createReceiptMutation.isPending ? 'Creating...' : `Create ${receiptType} Receipt`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Receipt Modal */}
      {showEditModal && receiptToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Edit Receipt</h3>
                  <p className="text-gray-600 mt-1">Update receipt information and balances will be adjusted</p>
                </div>
                <button
                  onClick={() => {
                    resetForm()
                    setShowEditModal(false)
                    setReceiptToEdit(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            {/* Info Banner */}
            <div className="p-6 bg-yellow-50 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <EditIcon className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">Editing Receipt</p>
                  <p className="text-sm text-yellow-700">
                    Changes will update accounting records and counterpart balances automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Currency Toggle - Read Only for Edit */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Receipt Type (Cannot be changed)
                </h4>
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 ${
                    receiptType === 'TOMAN'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-yellow-500 bg-yellow-50 text-yellow-700'
                  }`}>
                    <div className={`w-3 h-3 rounded-full ${receiptType === 'TOMAN' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                    <span className="font-medium">{receiptType} Receipt</span>
                  </div>
                </div>
              </div>

              {receiptType === 'TOMAN' ? (
                <>
                  {/* TOMAN Receipt Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Users className="h-4 w-4 inline mr-1" />
                        Who Paid? *
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData.payer_id}
                        onChange={(e) => setFormData({ ...formData, payer_id: parseInt(e.target.value) })}
                        required
                      >
                        <option value={0}>Select the payer</option>
                        {(partiesData || []).map((party: TradingParty) => (
                          <option key={party.id} value={party.id}>
                            {party.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <CreditCard className="h-4 w-4 inline mr-1" />
                        Receiver Account *
                      </label>
                      
                      {/* Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search by trading party or account number..."
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={accountSearchTerm}
                          onChange={(e) => {
                            setAccountSearchTerm(e.target.value)
                            setShowAccountDropdown(true)
                          }}
                          onFocus={() => setShowAccountDropdown(true)}
                        />
                        <Search className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                      
                      {/* Dropdown */}
                      {showAccountDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {(() => {
                            const filteredAccounts = (accountsData || [])
                              .filter((account: BankAccount) => account.currency === 'TOMAN')
                              .filter((account: BankAccount) => {
                                const searchLower = accountSearchTerm.toLowerCase()
                                const last5Digits = account.account_number.slice(-5)
                                return (
                                  (account.counterpart_name || '').toLowerCase().includes(searchLower) ||
                                  account.bank_name.toLowerCase().includes(searchLower) ||
                                  account.account_number.toLowerCase().includes(searchLower) ||
                                  last5Digits.includes(searchLower)
                                )
                              })

                            if (filteredAccounts.length === 0) {
                              return (
                                <div className="p-3 text-gray-500 text-center">
                                  No accounts found
                                </div>
                              )
                            }

                            return filteredAccounts.map((account: BankAccount) => (
                              <button
                                key={account.id}
                                type="button"
                                className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                onClick={() => {
                                  setFormData({ ...formData, receiver_account_id: account.id })
                                  setSelectedAccount(account)
                                  setAccountSearchTerm('')
                                  setShowAccountDropdown(false)
                                }}
                              >
                                <div className="font-medium text-gray-900">
                                  {account.counterpart_name}
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {account.bank_name} • ...{account.account_number.slice(-5)}
                                </div>
                              </button>
                            ))
                          })()}
                        </div>
                      )}
                      
                      {/* Click outside to close dropdown */}
                      {showAccountDropdown && (
                        <div 
                          className="fixed inset-0 z-5" 
                          onClick={() => setShowAccountDropdown(false)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Tracking Number for TOMAN */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Receipt className="h-4 w-4 inline mr-1" />
                      Tracking Number *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter tracking number (e.g., 12345)"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.tracking_last_5}
                      onChange={(e) => setFormData({ ...formData, tracking_last_5: e.target.value })}
                      required
                      maxLength={20}
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter the tracking number for this transfer</p>
                  </div>
                </>
              ) : (
                <>
                  {/* AED Receipt Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Users className="h-4 w-4 inline mr-1" />
                        Receipt Type *
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        value={formData.receipt_type}
                        onChange={(e) => setFormData({ ...formData, receipt_type: e.target.value as 'pay' | 'receive' })}
                        required
                      >
                        <option value="pay">Pay (Agrivex pays to individual)</option>
                        <option value="receive">Receive (Individual pays to Agrivex)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Users className="h-4 w-4 inline mr-1" />
                        Trading Party *
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        value={formData.trading_party_id}
                        onChange={(e) => setFormData({ ...formData, trading_party_id: parseInt(e.target.value) })}
                        required
                      >
                        <option value={0}>Select trading party</option>
                        {(partiesData || []).map((party: TradingParty) => (
                          <option key={party.id} value={party.id}>
                            {party.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <UserCheck className="h-4 w-4 inline mr-1" />
                      Individual Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Name of person handling cash collection/payment"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      value={formData.individual_name}
                      onChange={(e) => setFormData({ ...formData, individual_name: e.target.value })}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Name of the individual who collected/paid cash</p>
                  </div>
                </>
              )}

              {/* Common Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="h-4 w-4 inline mr-1" />
                    Amount {receiptType === 'AED' ? '(AED)' : '(TOMAN)'} *
                  </label>
                  <input
                    type="text"
                    placeholder={receiptType === 'TOMAN' ? '1,000,000' : '1,000'}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.amount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/,/g, '')
                      if (/^\d*$/.test(value)) {
                        setFormData({ ...formData, amount: value ? parseInt(value).toLocaleString() : '' })
                      }
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Receipt Date *
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.receipt_date}
                  onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4 inline mr-1" />
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Add any additional notes about this receipt..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    resetForm()
                    setShowEditModal(false)
                    setReceiptToEdit(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-6 py-3 ${receiptType === 'TOMAN' 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' 
                    : 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800'
                  } text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50`}
                  disabled={editReceiptMutation.isPending}
                >
                  {editReceiptMutation.isPending ? 'Updating...' : `Update ${receiptType} Receipt`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Details Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Receipt Details</h3>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatAmount(selectedReceipt.amount)} {selectedReceipt.currency || 'TOMAN'}
                  </div>
                  <div className="text-sm text-green-700">
                    {selectedReceipt.currency === 'AED' && selectedReceipt.receipt_type === 'pay' 
                      ? 'Amount Paid' 
                      : 'Amount Received'
                    }
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Receipt ID:</span>
                    <span className="ml-2 font-medium">#{selectedReceipt.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-2 font-medium">{new Date(selectedReceipt.receipt_date).toLocaleDateString()}</span>
                  </div>
                  
                  {selectedReceipt.currency === 'AED' ? (
                    <>
                      <div>
                        <span className="text-gray-600">
                          {selectedReceipt.receipt_type === 'pay' ? 'Receiver:' : 'Payer:'}
                        </span>
                        <span className="ml-2 font-medium">{selectedReceipt.trading_party_name || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">
                          {selectedReceipt.receipt_type === 'pay' ? 'Payer:' : 'Receiver:'}
                        </span>
                        <span className="ml-2 font-medium">Agrivex</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Individual:</span>
                        <span className="ml-2 font-medium">{selectedReceipt.individual_name || 'Not specified'}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-gray-600">Payer:</span>
                        <span className="ml-2 font-medium">{selectedReceipt.payer_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Receiver:</span>
                        <span className="ml-2 font-medium">{selectedReceipt.receiver_counterpart_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Bank:</span>
                        <span className="ml-2 font-medium">
                          {selectedReceipt.receiver_bank_name}
                          {selectedReceipt.receiver_account_number && (
                            <span className="ml-1 font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
                              ...{selectedReceipt.receiver_account_number.slice(-5)}
                            </span>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  
                  <div>
                    <span className="text-gray-600">
                      {selectedReceipt.currency === 'AED' ? 'Reference:' : 'Tracking:'}
                    </span>
                    <span className="ml-2 font-mono">...{selectedReceipt.tracking_last_5}</span>
                  </div>
                </div>

                {selectedReceipt.notes && (
                  <div>
                    <span className="text-gray-600 text-sm">Notes:</span>
                    <p className="mt-1 text-gray-900">{selectedReceipt.notes}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

             {/* Deletion Confirmation Dialog */}
       {showDeleteConfirm && receiptToDelete && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold text-red-600">Delete Receipt</h3>
               <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 hover:text-gray-600">
                 <X className="h-6 w-6" />
               </button>
             </div>
             
             <div className="mb-6">
               <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                 <p className="text-red-800 font-medium">⚠️ Warning: This action will reverse all accounting entries</p>
                 <p className="text-red-700 text-sm mt-1">Receipt #{receiptToDelete.id} for {receiptToDelete.amount.toLocaleString()} {receiptToDelete.currency || 'TOMAN'}</p>
               </div>

               <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Reason for deletion</label>
                   <select
                     value={deleteReasonCategory}
                     onChange={(e) => setDeleteReasonCategory(e.target.value as any)}
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                   >
                     <option value="duplicate">Duplicate entry</option>
                     <option value="funds_returned">Funds were returned</option>
                     <option value="receipt_not_landed">Receipt did not land in account</option>
                     <option value="data_error">Data entry error</option>
                     <option value="other">Other reason</option>
                   </select>
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Detailed explanation</label>
                   <textarea
                     value={deleteReason}
                     onChange={(e) => setDeleteReason(e.target.value)}
                     placeholder="Please provide specific details about why this receipt is being deleted..."
                     className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 h-20 resize-none"
                     required
                   />
                 </div>
               </div>
             </div>

             <div className="flex flex-col-reverse sm:flex-row gap-3">
               <button
                 onClick={() => setShowDeleteConfirm(false)}
                 className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
               >
                 Cancel
               </button>
               <button
                 onClick={handleDeleteConfirm}
                 className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                 disabled={deleteMutation.isPending || !deleteReason.trim()}
               >
                 {deleteMutation.isPending ? 'Deleting...' : 'Delete Receipt'}
               </button>
             </div>
           </div>
         </div>
       )}

             {/* Restoration Confirmation Dialog */}
       {showRestoreConfirm && receiptToRestore && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold text-green-600">Restore Receipt</h3>
               <button onClick={() => setShowRestoreConfirm(false)} className="text-gray-400 hover:text-gray-600">
                 <X className="h-6 w-6" />
               </button>
             </div>
             
             <div className="mb-6">
               <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                 <p className="text-green-800 font-medium">✅ This will restore all accounting entries</p>
                 <p className="text-green-700 text-sm mt-1">Receipt #{receiptToRestore.id} for {receiptToRestore.amount.toLocaleString()} {receiptToRestore.currency || 'TOMAN'}</p>
                 {receiptToRestore.deletion_reason && (
                   <p className="text-green-700 text-sm mt-1">
                     <strong>Originally deleted:</strong> {receiptToRestore.deletion_reason}
                   </p>
                 )}
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">Reason for restoration</label>
                 <textarea
                   value={restoreReason}
                   onChange={(e) => setRestoreReason(e.target.value)}
                   placeholder="Please explain why this receipt is being restored (e.g., payment was verified, funds landed in account, error was corrected)..."
                   className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 h-20 resize-none"
                   required
                 />
               </div>
             </div>

             <div className="flex flex-col-reverse sm:flex-row gap-3">
               <button
                 onClick={() => setShowRestoreConfirm(false)}
                 className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
               >
                 Cancel
               </button>
               <button
                 onClick={handleRestoreConfirm}
                 className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                 disabled={restoreMutation.isPending || !restoreReason.trim()}
               >
                 {restoreMutation.isPending ? 'Restoring...' : 'Restore Receipt'}
               </button>
             </div>
           </div>
         </div>
       )}
    </div>
  )
} 