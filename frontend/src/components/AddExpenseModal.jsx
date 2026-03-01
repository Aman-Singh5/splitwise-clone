import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import Avatar from './Avatar'
import { Search, X, Plus, Upload } from 'lucide-react'

const CATEGORIES = ['General', 'Food & Drink', 'Transport', 'Entertainment', 'Accommodation', 'Shopping', 'Utilities', 'Health', 'Travel', 'Other']
const SPLIT_TYPES = [
  { value: 'EQUAL', label: 'Equal' },
  { value: 'EXACT', label: 'Exact amounts' },
  { value: 'PERCENT', label: 'Percentages' },
  { value: 'SHARES', label: 'Shares' },
]

export default function AddExpenseModal({ open, onClose, groupId = null, prefillFriendId = null, expense = null }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [userSearch, setUserSearch] = useState('')
  const [receipt, setReceipt] = useState(null)
  const isEdit = !!expense

  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: () => api.get('/currencies').then(r => r.data) })
  const { data: friends = [] } = useQuery({ queryKey: ['friends'], queryFn: () => api.get('/friends').then(r => r.data) })
  const { data: groups = [] } = useQuery({ queryKey: ['groups'], queryFn: () => api.get('/groups').then(r => r.data) })

  const defaultParticipants = [{ userId: user?.id, name: user?.name, avatar: user?.avatar, amount: '', percent: '', shares: '1' }]
  if (prefillFriendId) {
    const friend = friends?.find(f => f.id === prefillFriendId)
    if (friend) defaultParticipants.push({ userId: friend.id, name: friend.name, avatar: friend.avatar, amount: '', percent: '', shares: '1' })
  }

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm({
    defaultValues: {
      description: expense?.description || '',
      amount: expense?.amount || '',
      currency: expense?.currency || user?.defaultCurrency || 'USD',
      paidById: expense?.paidById || user?.id || '',
      groupId: groupId || expense?.groupId || '',
      category: expense?.category || 'General',
      date: expense?.date ? expense.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
      splitType: 'EQUAL',
      participants: defaultParticipants,
      notes: expense?.notes || '',
      isRecurring: expense?.isRecurring || false,
      recurringInterval: expense?.recurringInterval || 'monthly',
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'participants' })
  const watchedAmount = watch('amount')
  const watchedSplitType = watch('splitType')
  const watchedGroupId = watch('groupId')
  const watchedParticipants = watch('participants')

  const groupMembers = watchedGroupId
    ? groups?.find(g => g.id === watchedGroupId)?.members?.map(m => m.user) || []
    : []

  useEffect(() => {
    if (watchedGroupId && groupMembers.length > 0) {
      const memberParticipants = groupMembers.map(m => ({
        userId: m.id, name: m.name, avatar: m.avatar, amount: '', percent: '', shares: '1',
      }))
      setValue('participants', memberParticipants)
    }
  }, [watchedGroupId])

  const mutation = useMutation({
    mutationFn: async (data) => {
      const formData = new FormData()
      const body = {
        description: data.description,
        amount: parseFloat(data.amount),
        currency: data.currency,
        paidById: data.paidById,
        groupId: data.groupId || null,
        category: data.category,
        date: data.date,
        splitType: data.splitType,
        notes: data.notes,
        isRecurring: data.isRecurring,
        recurringInterval: data.recurringInterval,
        participants: data.participants.map(p => ({
          userId: p.userId,
          amount: parseFloat(p.amount) || 0,
          percent: parseFloat(p.percent) || 0,
          shares: parseFloat(p.shares) || 1,
        })),
      }
      if (receipt) {
        formData.append('receipt', receipt)
        formData.append('data', JSON.stringify(body))
        const config = { headers: { 'Content-Type': 'multipart/form-data' } }
        return isEdit
          ? api.put(`/expenses/${expense.id}`, formData, config)
          : api.post('/expenses', formData, config)
      }
      return isEdit ? api.put(`/expenses/${expense.id}`, body) : api.post('/expenses', body)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Expense updated!' : 'Expense added!')
      qc.invalidateQueries(['expenses'])
      qc.invalidateQueries(['balances'])
      qc.invalidateQueries(['activity'])
      qc.invalidateQueries(['notifications'])
      onClose()
      reset()
      setReceipt(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save expense'),
  })

  const filteredFriends = friends?.filter(f =>
    f.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    f.email.toLowerCase().includes(userSearch.toLowerCase())
  ) || []

  const addParticipant = (u) => {
    if (fields.some(f => f.userId === u.id)) return
    append({ userId: u.id, name: u.name, avatar: u.avatar, amount: '', percent: '', shares: '1' })
    setUserSearch('')
  }

  const equalShare = watchedParticipants?.length > 0 && watchedAmount
    ? (parseFloat(watchedAmount) / watchedParticipants.length).toFixed(2)
    : 0

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Expense' : 'Add Expense'} size="lg">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
        {/* Description + Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Description</label>
            <input {...register('description', { required: 'Required' })} placeholder="Dinner, taxi, rent..." className="input" />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>
          <div>
            <label className="label">Amount</label>
            <div className="flex gap-2">
              <select {...register('currency')} className="input w-28 flex-shrink-0">
                {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <input {...register('amount', { required: 'Required', min: 0.01 })} type="number" step="0.01" placeholder="0.00" className="input" />
            </div>
          </div>
        </div>

        {/* Paid by + Group */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Paid by</label>
            <select {...register('paidById')} className="input">
              <option value={user?.id}>You ({user?.name})</option>
              {fields.filter(f => f.userId !== user?.id).map(f => (
                <option key={f.userId} value={f.userId}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Group (optional)</label>
            <select {...register('groupId')} className="input">
              <option value="">No group</option>
              {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        {/* Category + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select {...register('category')} className="input">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input {...register('date')} type="date" className="input" />
          </div>
        </div>

        {/* Participants */}
        <div>
          <label className="label">Split between</label>
          {!watchedGroupId && (
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Add friend by name..."
                className="input pl-8"
              />
              {userSearch && (
                <div className="absolute z-10 w-full bg-white border border-gray-100 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {filteredFriends.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">No friends found</p>
                  ) : filteredFriends.map(f => (
                    <button key={f.id} type="button" onClick={() => addParticipant(f)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left">
                      <Avatar user={f} size="xs" />
                      <span className="text-sm">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {fields.map((field, i) => (
              <div key={field.id} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1">
                <Avatar user={{ name: field.name, avatar: field.avatar }} size="xs" />
                <span className="text-xs font-medium">{field.userId === user?.id ? 'You' : field.name}</span>
                {field.userId !== user?.id && (
                  <button type="button" onClick={() => remove(i)} className="ml-0.5">
                    <X size={12} className="text-gray-500 hover:text-red-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Split Type */}
        <div>
          <label className="label">Split type</label>
          <div className="grid grid-cols-4 gap-2">
            {SPLIT_TYPES.map(st => (
              <label key={st.value} className={`flex items-center justify-center text-xs font-medium py-2 border rounded-lg cursor-pointer transition-colors ${watchedSplitType === st.value ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
                <input type="radio" {...register('splitType')} value={st.value} className="sr-only" />
                {st.label}
              </label>
            ))}
          </div>

          {watchedSplitType === 'EQUAL' && watchedAmount && fields.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">Each person pays: <strong>{equalShare}</strong></p>
          )}

          {watchedSplitType !== 'EQUAL' && (
            <div className="mt-3 space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20 truncate">{field.userId === user?.id ? 'You' : field.name}</span>
                  {watchedSplitType === 'EXACT' && (
                    <input {...register(`participants.${i}.amount`)} type="number" step="0.01" placeholder="0.00" className="input text-sm" />
                  )}
                  {watchedSplitType === 'PERCENT' && (
                    <input {...register(`participants.${i}.percent`)} type="number" step="0.1" placeholder="0" className="input text-sm" suffix="%" />
                  )}
                  {watchedSplitType === 'SHARES' && (
                    <input {...register(`participants.${i}.shares`)} type="number" step="1" placeholder="1" className="input text-sm" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes + Receipt */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Notes (optional)</label>
            <input {...register('notes')} placeholder="Any details..." className="input" />
          </div>
          <div>
            <label className="label">Receipt (optional)</label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-200 rounded-lg px-3 py-2 hover:border-primary-300 transition-colors">
              <Upload size={15} className="text-gray-400" />
              <span className="text-sm text-gray-400">{receipt ? receipt.name : 'Upload image'}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={e => setReceipt(e.target.files[0])} />
            </label>
          </div>
        </div>

        {/* Recurring */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('isRecurring')} className="w-4 h-4 accent-primary-500" />
            <span className="text-sm text-gray-600">Recurring expense</span>
          </label>
          {watch('isRecurring') && (
            <select {...register('recurringInterval')} className="input w-36 text-sm">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? 'Saving...' : isEdit ? 'Update expense' : 'Add expense'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
