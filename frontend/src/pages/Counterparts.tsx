import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Search,
  Users, 
  DollarSign,
  Download, 
  Calendar, 
  Filter, 
  Receipt, 
  TrendingUp, 
  TrendingDown, 
  FileText,
  FileSpreadsheet,
  FileImage
} from 'lucide-react'
import { api } from '../lib/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface TradingParty {
  id: number
  name: string
  phone?: string
  email?: string
  is_active: boolean
  created_at: string
}

interface CounterpartBalance {
  counterpart_id: number
  counterpart_name: string
  currency: 'AED' | 'TOMAN'
  balance: number
}

interface StatementLine {
  id: number
  counterpart_id: number
  currency: 'AED' | 'TOMAN'
  transaction_type: 'BUY' | 'SELL' | 'RECEIPT'
  trade_id?: number
  receipt_id?: number
  description: string
  debit_amount: number
  credit_amount: number
  balance_after: number
  transaction_date: string
  created_at: string
  trade_number?: string
  tracking_last_5?: string
}

export default function Counterparts() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCounterpart, setSelectedCounterpart] = useState<TradingParty | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<'AED' | 'TOMAN'>('TOMAN')
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportDateRange, setExportDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0] // today
  })

  // Fetch all counterpart balances
  const { data: balancesData } = useQuery({
    queryKey: ['counterparts', 'balances'],
    queryFn: async () => {
      const response = await api.get('/counterparts/balances')
      return response.data.data
    }
  })

  // Fetch trading parties
  const { data: partiesData } = useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      const response = await api.get('/parties')
      return response.data.data
    }
  })

  // Fetch statement for selected counterpart and currency
  const { data: statementData } = useQuery({
    queryKey: ['counterparts', selectedCounterpart?.id, 'statement', selectedCurrency],
    queryFn: async () => {
      if (!selectedCounterpart) return null
      const response = await api.get(`/counterparts/${selectedCounterpart.id}/statement?currency=${selectedCurrency}`)
      return response.data.data
    },
    enabled: !!selectedCounterpart
  })

  // CSV Export function
  const handleExportCSV = async () => {
    if (!selectedCounterpart) return
    
    try {
      const response = await api.get(
        `/counterparts/${selectedCounterpart.id}/statement?currency=${selectedCurrency}&start_date=${exportDateRange.startDate}&end_date=${exportDateRange.endDate}&format=csv`,
        { responseType: 'text' } // Important: tell axios to expect text, not JSON
      )
      
      // The response is already CSV content from the backend
      const csvContent = response.data
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedCounterpart.name}_${selectedCurrency}_Statement_${exportDateRange.startDate}_to_${exportDateRange.endDate}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      setShowExportModal(false)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export statement. Please try again.')
    }
  }

  // PDF Export function
  const handleExportPDF = async () => {
    if (!selectedCounterpart || !statementData) return
    
    try {
      // Get statement data for the specified date range
      const response = await api.get(
        `/counterparts/${selectedCounterpart.id}/statement?currency=${selectedCurrency}&start_date=${exportDateRange.startDate}&end_date=${exportDateRange.endDate}`
      )
      
      const statementForExport = response.data.data
      const lines = statementForExport.statement_lines || []
      
      // Create PDF document
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height
      const margin = 20
      
      // Helper function to format date for filename
      const formatDateForFilename = (dateStr: string) => {
        const date = new Date(dateStr)
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = String(date.getFullYear()).slice(-2)
        return `${day}${month}${year}`
      }
      
      // Helper function to format currency for filename
      const getCurrencyAbbrev = (currency: string) => {
        return currency === 'TOMAN' ? 'TMN' : 'AED'
      }
      
      // Generate filename
      const startDateFormatted = formatDateForFilename(exportDateRange.startDate)
      const endDateFormatted = formatDateForFilename(exportDateRange.endDate)
      const currencyAbbrev = getCurrencyAbbrev(selectedCurrency)
      const partyName = selectedCounterpart.name.replace(/[^a-zA-Z0-9]/g, '')
      const filename = `${currencyAbbrev}-${partyName}-${startDateFormatted}-${endDateFormatted}.pdf`
      
      // Header function for each page
      const addHeader = (doc: jsPDF, pageNum: number, totalPages: number) => {
        // Page number (top left)
        doc.setFontSize(10)
        doc.setTextColor(100, 100, 100)
        doc.text(`${pageNum}/${totalPages}`, margin, margin - 5)
        
        // Title
        doc.setFontSize(14)
        doc.setFont("helvetica", "bold")
        doc.text('ACCOUNT STATEMENT', pageWidth / 2, margin + 5, { align: 'center' })
        
        // Customer and currency info
        doc.setFontSize(12)
        doc.setFont("helvetica", "normal")
        doc.text(`Customer: ${selectedCounterpart.name}`, margin, margin + 20)
        doc.text(`Currency: ${selectedCurrency}`, margin, margin + 30)
        
        // Period
        const startDate = new Date(exportDateRange.startDate).toLocaleDateString('en-GB')
        const endDate = new Date(exportDateRange.endDate).toLocaleDateString('en-GB')
        doc.text(`Period: ${startDate} to ${endDate}`, margin, margin + 40)
        
        // Customer contact info (if available)
        let yPos = margin + 50
        if (selectedCounterpart.phone) {
          doc.setFontSize(10)
          doc.setTextColor(100, 100, 100)
          doc.text(`Phone: ${selectedCounterpart.phone}`, margin, yPos)
          yPos += 10
        }
        if (selectedCounterpart.email) {
          doc.setFontSize(10)
          doc.setTextColor(100, 100, 100)
          doc.text(`Email: ${selectedCounterpart.email}`, margin, yPos)
          yPos += 10
        }
        
        return yPos + 10 // Return the Y position where content should start
      }
      
      // Prepare table data - REVERSE ORDER (oldest first, newest last)
      const tableData = lines
        .sort((a: StatementLine, b: StatementLine) => 
          new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
        )
        .map((line: StatementLine) => {
          const date = new Date(line.transaction_date).toLocaleDateString('en-GB')
          const description = line.description
            .replace(/Receipt from.*?for trade /gi, 'Trade ') // Clean up redundant text
            .replace(/Payment for trade /gi, 'Trade ')
            .replace(/Trade obligation for trade /gi, 'Trade ')
          
          return [
            date,
            line.transaction_type,
            description,
            line.debit_amount > 0 ? formatAmount(line.debit_amount) : '—',
            line.credit_amount > 0 ? formatAmount(line.credit_amount) : '—',
            formatAmount(line.balance_after)
          ]
        })
      
      // Add content to first page
      const contentStartY = addHeader(doc, 1, 1) // We'll update total pages later
      
      // Currency-specific table styling
      const isToman = selectedCurrency === 'TOMAN'
      
      // Create table
      autoTable(doc, {
        head: [['Date', 'Type', 'Description', 'Debit', 'Credit', 'Balance']],
        body: tableData,
        startY: contentStartY,
        theme: 'grid',
        styles: {
          fontSize: isToman ? 8 : 9, // Smaller font for TOMAN to fit large numbers
          cellPadding: 3,
          overflow: 'linebreak',
          halign: 'left'
        },
        headStyles: {
          fillColor: selectedCurrency === 'TOMAN' ? [59, 130, 246] : [245, 158, 11], // Blue for TOMAN, Yellow for AED
          textColor: 255,
          fontStyle: 'bold',
          fontSize: isToman ? 9 : 10
        },
        columnStyles: {
          0: { cellWidth: isToman ? 22 : 25 }, // Date - smaller for TOMAN
          1: { cellWidth: isToman ? 18 : 20 }, // Type - smaller for TOMAN
          2: { cellWidth: isToman ? 60 : 70 }, // Description - smaller for TOMAN
          3: { cellWidth: isToman ? 30 : 25, halign: 'right' }, // Debit - wider for TOMAN
          4: { cellWidth: isToman ? 30 : 25, halign: 'right' }, // Credit - wider for TOMAN
          5: { cellWidth: isToman ? 30 : 25, halign: 'right', fontStyle: 'bold' } // Balance - wider for TOMAN
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: margin, right: margin },
        tableWidth: 'wrap', // Let table adjust its width
        didDrawPage: function() {
          // This will be called for each page
          // We'll update headers after we know total pages
        }
      })
      
      // Calculate totals
      const totalDebit = lines.reduce((sum: number, line: StatementLine) => sum + line.debit_amount, 0)
      const totalCredit = lines.reduce((sum: number, line: StatementLine) => sum + line.credit_amount, 0)
      const finalBalance = statementForExport.current_balance
      
      // Add summary on last page
      const finalY = (doc as any).lastAutoTable.finalY + 20
      
      // Check if we need a new page for summary
      if (finalY + 60 > pageHeight - margin) {
        doc.addPage()
        addHeader(doc, (doc as any).internal.getCurrentPageInfo().pageNumber, (doc as any).internal.getNumberOfPages())
      }
      
      // Add summary box
      const summaryY = Math.max(finalY, contentStartY)
      doc.setFillColor(250, 250, 250)
      doc.rect(margin, summaryY, pageWidth - 2 * margin, 50, 'F')
      doc.setDrawColor(200, 200, 200)
      doc.rect(margin, summaryY, pageWidth - 2 * margin, 50)
      
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0, 0, 0)
      doc.text('STATEMENT SUMMARY', margin + 10, summaryY + 15)
      
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(`Total Debits: ${formatAmount(totalDebit)} ${selectedCurrency}`, margin + 10, summaryY + 28)
      doc.text(`Total Credits: ${formatAmount(totalCredit)} ${selectedCurrency}`, margin + 10, summaryY + 38)
      
      doc.setFont("helvetica", "bold")
      const balanceColor = finalBalance >= 0 ? [0, 128, 0] : [220, 20, 60] // Green for positive, red for negative
      doc.setTextColor(balanceColor[0], balanceColor[1], balanceColor[2])
      doc.text(`Final Balance: ${formatAmount(finalBalance)} ${selectedCurrency}`, margin + 10, summaryY + 48)
      
      // Update headers with correct page numbers
      const totalPages = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        // Clear the old page number area
        doc.setFillColor(255, 255, 255)
        doc.rect(margin - 5, margin - 10, 30, 10, 'F')
        // Add new page number
        doc.setFontSize(10)
        doc.setTextColor(100, 100, 100)
        doc.text(`${i}/${totalPages}`, margin, margin - 5)
      }
      
      // Save the PDF
      doc.save(filename)
      setShowExportModal(false)
      
    } catch (error) {
      console.error('PDF Export failed:', error)
      alert('Failed to export PDF. Please try again.')
    }
  }

  // Filter parties for selection
  const filteredParties = (partiesData || []).filter((party: TradingParty) => {
    return party.name.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Group balances by counterpart
  const balancesByCounterpart = (balancesData || []).reduce((acc: any, balance: CounterpartBalance) => {
    if (!acc[balance.counterpart_id]) {
      acc[balance.counterpart_id] = {
        counterpart_name: balance.counterpart_name,
        balances: {}
      }
    }
    acc[balance.counterpart_id].balances[balance.currency] = balance.balance
    return acc
  }, {})

  const formatAmount = (amount: number) => {
    return amount.toLocaleString()
  }

  const getBalanceColor = (amount: number) => {
    if (amount > 0) return 'text-success'
    if (amount < 0) return 'text-error'
    return 'text-base-content'
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'BUY':
        return <TrendingUp className="h-4 w-4 text-success" />
      case 'SELL':
        return <TrendingDown className="h-4 w-4 text-warning" />
      case 'RECEIPT':
        return <Receipt className="h-4 w-4 text-info" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Counterpart Statements</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar - Counterpart Selection */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-body">
              <h3 className="text-lg font-medium mb-4">Select Counterpart</h3>
              
              {/* Search */}
              <div className="relative mb-4">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50" />
                <input
                  type="text"
                  placeholder="Search counterparts..."
                  className="input input-bordered w-full pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Counterpart List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredParties.map((party: TradingParty) => {
                  const balances = balancesByCounterpart[party.id]?.balances || {}
                  const aedBalance = balances.AED || 0
                  const tomanBalance = balances.TOMAN || 0
                  
                  return (
                    <div
                      key={party.id}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedCounterpart?.id === party.id 
                          ? 'border-primary bg-primary/10' 
                          : 'border-base-300 hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedCounterpart(party)}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <Users className="h-4 w-4 text-base-content/50" />
                        <span className="font-medium">{party.name}</span>
                      </div>
                      
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span>AED:</span>
                          <span className={`font-mono ${getBalanceColor(aedBalance)}`}>
                            {formatAmount(aedBalance)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>TOMAN:</span>
                          <span className={`font-mono ${getBalanceColor(tomanBalance)}`}>
                            {formatAmount(tomanBalance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Statement Details */}
        <div className="lg:col-span-2">
          {!selectedCounterpart ? (
            <div className="card">
              <div className="card-body text-center py-12">
                <Users className="h-12 w-12 text-base-content/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-base-content/70 mb-2">
                  Select a Counterpart
                </h3>
                <p className="text-base-content/50">
                  Choose a counterpart from the left to view their statement
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Counterpart Header */}
              <div className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{selectedCounterpart.name}</h2>
                      {selectedCounterpart.phone && (
                        <p className="text-base-content/70">Phone: {selectedCounterpart.phone}</p>
                      )}
                      {selectedCounterpart.email && (
                        <p className="text-base-content/70">Email: {selectedCounterpart.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Balance Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-base-200 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="h-5 w-5 text-success" />
                        <span className="font-medium">AED Balance</span>
                      </div>
                      <div className={`text-2xl font-bold font-mono ${getBalanceColor(balancesByCounterpart[selectedCounterpart.id]?.balances?.AED || 0)}`}>
                        {formatAmount(balancesByCounterpart[selectedCounterpart.id]?.balances?.AED || 0)}
                      </div>
                    </div>
                    
                    <div className="bg-base-200 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="h-5 w-5 text-warning" />
                        <span className="font-medium">TOMAN Balance</span>
                      </div>
                      <div className={`text-2xl font-bold font-mono ${getBalanceColor(balancesByCounterpart[selectedCounterpart.id]?.balances?.TOMAN || 0)}`}>
                        {formatAmount(balancesByCounterpart[selectedCounterpart.id]?.balances?.TOMAN || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Currency Toggle with Modern UI */}
              <div className="card bg-gradient-to-r from-blue-50 to-yellow-50 border-0">
                <div className="card-body">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Transaction Statement</h3>
                      
                      {/* Enhanced Currency Toggle */}
                      <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-200 inline-flex">
                        <button
                          onClick={() => setSelectedCurrency('TOMAN')}
                          className={`flex items-center space-x-3 px-6 py-3 rounded-lg transition-all duration-200 ${
                            selectedCurrency === 'TOMAN'
                              ? 'bg-blue-500 text-white shadow-md transform scale-105'
                              : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full ${
                            selectedCurrency === 'TOMAN' ? 'bg-white' : 'bg-gray-300'
                          }`} />
                          <span className="font-medium">TOMAN Statement</span>
                          {selectedCurrency === 'TOMAN' && 
                            <div className="bg-white bg-opacity-20 px-2 py-1 rounded text-xs">
                              Active
                            </div>
                          }
                        </button>
                        
                        <button
                          onClick={() => setSelectedCurrency('AED')}
                          className={`flex items-center space-x-3 px-6 py-3 rounded-lg transition-all duration-200 ${
                            selectedCurrency === 'AED'
                              ? 'bg-yellow-500 text-white shadow-md transform scale-105'
                              : 'text-gray-600 hover:text-yellow-600 hover:bg-yellow-50'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full ${
                            selectedCurrency === 'AED' ? 'bg-white' : 'bg-gray-300'
                          }`} />
                          <span className="font-medium">AED Statement</span>
                          {selectedCurrency === 'AED' && 
                            <div className="bg-white bg-opacity-20 px-2 py-1 rounded text-xs">
                              Active
                            </div>
                          }
                        </button>
                      </div>
                    </div>
                    
                    {/* Export Button */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowExportModal(true)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all ${
                          selectedCurrency === 'TOMAN'
                            ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                        }`}
                        disabled={!statementData || statementData.statement_lines.length === 0}
                      >
                        <Download className="h-4 w-4" />
                        <span className="font-medium">Export Statement</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statement Content */}
              <div className="card">
                <div className="card-body">
                  {!statementData || statementData.statement_lines.length === 0 ? (
                    <div className="text-center py-12">
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                        selectedCurrency === 'TOMAN' ? 'bg-blue-100' : 'bg-yellow-100'
                      }`}>
                        <FileText className={`h-8 w-8 ${
                          selectedCurrency === 'TOMAN' ? 'text-blue-500' : 'text-yellow-500'
                        }`} />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
                      <p className="text-gray-600">No {selectedCurrency} transactions available for this counterpart</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Current Balance Card */}
                      <div className={`rounded-xl p-6 border-l-4 ${
                        selectedCurrency === 'TOMAN' 
                          ? 'bg-blue-50 border-blue-500' 
                          : 'bg-yellow-50 border-yellow-500'
                      }`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Current Balance</h4>
                            <p className="text-sm text-gray-600">{selectedCurrency} Statement</p>
                          </div>
                          <div className="text-right">
                            <div className={`text-3xl font-bold font-mono ${getBalanceColor(statementData.current_balance)}`}>
                              {formatAmount(statementData.current_balance)}
                            </div>
                            <div className={`text-sm font-medium ${
                              selectedCurrency === 'TOMAN' ? 'text-blue-600' : 'text-yellow-600'
                            }`}>
                              {selectedCurrency}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Transaction List */}
                      <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                          <thead className="bg-base-200">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">Date</th>
                              <th className="px-4 py-3 text-left font-semibold">Type</th>
                              <th className="px-4 py-3 text-left font-semibold">Description</th>
                              <th className="px-4 py-3 text-right font-semibold">Debit</th>
                              <th className="px-4 py-3 text-right font-semibold">Credit</th>
                              <th className="px-4 py-3 text-right font-semibold">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statementData.statement_lines.map((line: StatementLine) => (
                              <tr key={line.id} className="hover:bg-base-100">
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                  {new Date(line.transaction_date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center space-x-2">
                                    {getTransactionIcon(line.transaction_type)}
                                    <span className="text-sm font-medium">
                                      {line.transaction_type}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-sm leading-relaxed">
                                    {line.description}
                                    {line.trade_number && (
                                      <div className="text-xs text-base-content/60 mt-1">
                                        Trade: {line.trade_number}
                                      </div>
                                    )}
                                    {line.tracking_last_5 && (
                                      <div className="text-xs text-base-content/60 mt-1">
                                        Tracking: ...{line.tracking_last_5}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {line.debit_amount > 0 ? (
                                    <span className="font-mono text-error font-medium">
                                      {formatAmount(line.debit_amount)}
                                    </span>
                                  ) : (
                                    <span className="text-base-content/40">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  {line.credit_amount > 0 ? (
                                    <span className="font-mono text-success font-medium">
                                      {formatAmount(line.credit_amount)}
                                    </span>
                                  ) : (
                                    <span className="text-base-content/40">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                  <span className={`font-mono font-semibold ${getBalanceColor(line.balance_after)}`}>
                                    {formatAmount(line.balance_after)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSV Export Modal */}
      {showExportModal && selectedCounterpart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Export Statement</h3>
                  <p className="text-gray-600 mt-1">
                    {selectedCounterpart.name} - {selectedCurrency} Statement
                  </p>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={exportDateRange.startDate}
                    onChange={(e) => setExportDateRange({
                      ...exportDateRange,
                      startDate: e.target.value
                    })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={exportDateRange.endDate}
                    onChange={(e) => setExportDateRange({
                      ...exportDateRange,
                      endDate: e.target.value
                    })}
                  />
                </div>
              </div>
              
              <div className={`p-4 rounded-lg border-l-4 ${
                selectedCurrency === 'TOMAN' ? 'bg-blue-50 border-blue-500' : 'bg-yellow-50 border-yellow-500'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  <Filter className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Export Summary</span>
                </div>
                <div className="text-sm text-gray-600">
                  <p>• Currency: {selectedCurrency}</p>
                  <p>• Date Range: {new Date(exportDateRange.startDate).toLocaleDateString()} to {new Date(exportDateRange.endDate).toLocaleDateString()}</p>
                  <p>• Format: CSV (Excel compatible)</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExportCSV}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center justify-center space-x-2 ${
                  selectedCurrency === 'TOMAN' 
                    ? 'bg-blue-500 hover:bg-blue-600' 
                    : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700"
              >
                <FileImage className="h-4 w-4" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 