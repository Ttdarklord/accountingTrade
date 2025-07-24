import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit, Trash2, Phone, Mail, User, FileText } from 'lucide-react'
import { api } from '../lib/api'

interface TradingParty {
  id: number
  name: string
  phone?: string
  email?: string
  national_id?: string
  notes?: string
  created_at: string
}

interface PartyFormData {
  name: string
  phone: string
  email: string
  national_id: string
  notes: string
}

export function Parties() {
  const [showForm, setShowForm] = useState(false)
  const [editingParty, setEditingParty] = useState<TradingParty | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  const queryClient = useQueryClient()
  
  const { data: parties, isLoading } = useQuery<TradingParty[]>({
    queryKey: ['parties'],
    queryFn: () => api.get('/parties').then(res => res.data.data),
  })
  
  const createPartyMutation = useMutation({
    mutationFn: (partyData: Partial<PartyFormData>) => api.post('/parties', partyData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] })
      setShowForm(false)
      setEditingParty(null)
    },
  })
  
  const updatePartyMutation = useMutation({
    mutationFn: ({ id, ...partyData }: { id: number } & Partial<PartyFormData>) => 
      api.put(`/parties/${id}`, partyData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] })
      setShowForm(false)
      setEditingParty(null)
    },
  })
  
  const deletePartyMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/parties/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] })
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const partyData = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string || undefined,
      email: formData.get('email') as string || undefined,
      national_id: formData.get('national_id') as string || undefined,
      notes: formData.get('notes') as string || undefined,
    }
    
    if (editingParty) {
      updatePartyMutation.mutate({ id: editingParty.id, ...partyData })
    } else {
      createPartyMutation.mutate(partyData)
    }
  }

  const handleEdit = (party: TradingParty) => {
    setEditingParty(party)
    setShowForm(true)
  }

  const handleDelete = (party: TradingParty) => {
    if (window.confirm(`Are you sure you want to delete "${party.name}"?`)) {
      deletePartyMutation.mutate(party.id)
    }
  }

  const filteredParties = parties?.filter(party =>
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.phone?.includes(searchTerm) ||
    party.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.national_id?.includes(searchTerm)
  ) || []

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
        <h1 className="text-3xl font-bold text-gray-900">Trading Parties</h1>
        <button
          onClick={() => {
            setEditingParty(null)
            setShowForm(true)
          }}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Trading Party
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="card-body">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, email, or ID..."
              className="form-input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Phone className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">Total Parties</div>
                <div className="text-2xl font-bold text-gray-900">
                  {parties?.length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Mail className="h-8 w-8 text-success-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">With Email</div>
                <div className="text-2xl font-bold text-gray-900">
                  {parties?.filter(p => p.email).length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <User className="h-8 w-8 text-warning-600" />
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-gray-500">With National ID</div>
                <div className="text-2xl font-bold text-gray-900">
                  {parties?.filter(p => p.national_id).length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Parties Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">All Trading Parties</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  National ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredParties.map((party) => (
                <tr key={party.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{party.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {party.phone && (
                        <div className="flex items-center mb-1">
                          <Phone className="h-3 w-3 mr-1 text-gray-400" />
                          {party.phone}
                        </div>
                      )}
                      {party.email && (
                        <div className="flex items-center">
                          <Mail className="h-3 w-3 mr-1 text-gray-400" />
                          {party.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {party.national_id || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {party.notes || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(party.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(party)}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(party)}
                      className="text-danger-600 hover:text-danger-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingParty ? 'Edit Trading Party' : 'Add New Trading Party'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingParty?.name || ''}
                    className="form-input"
                    placeholder="Trading party name"
                  />
                </div>
                
                <div>
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={editingParty?.phone || ''}
                    className="form-input"
                    placeholder="Phone number"
                  />
                </div>
                
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingParty?.email || ''}
                    className="form-input"
                    placeholder="Email address"
                  />
                </div>
                
                <div>
                  <label className="form-label">National ID</label>
                  <input
                    type="text"
                    name="national_id"
                    defaultValue={editingParty?.national_id || ''}
                    className="form-input"
                    placeholder="National ID number"
                  />
                </div>
                
                <div>
                  <label className="form-label">Notes</label>
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={editingParty?.notes || ''}
                    className="form-input"
                    placeholder="Additional notes..."
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={createPartyMutation.isPending || updatePartyMutation.isPending}
                    className="btn btn-primary flex-1"
                  >
                    {createPartyMutation.isPending || updatePartyMutation.isPending ? 'Saving...' : (editingParty ? 'Update' : 'Create')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingParty(null)
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