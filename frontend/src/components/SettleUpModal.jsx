import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import Avatar from './Avatar'

export default function SettleUpModal({ open, onClose, friend, groupId = null, defaultAmount = '' }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [amount, setAmount] = useState(defaultAmount)
  const [currency, setCurrency] = useState(user?.defaultCurrency || 'USD')
  const [notes, setNotes] = useState('')
  const [direction, setDirection] = useState('pay') // 'pay' = I pay friend, 'receive' = friend paid me

  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: () => api.get('/currencies').then(r => r.data) })

  const mutation = useMutation({
    mutationFn: () => api.post('/settlements', {
      toUserId: direction === 'pay' ? friend.id : user.id,
      fromUserId: direction === 'pay' ? user.id : friend.id,
      amount: parseFloat(amount),
      currency,
      groupId: groupId || null,
      notes,
    }).then(r => r.data),
    onSuccess: () => {
      toast.success('Payment recorded!')
      qc.invalidateQueries(['balances'])
      qc.invalidateQueries(['settlements'])
      qc.invalidateQueries(['activity'])
      onClose()
      setAmount('')
      setNotes('')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to record payment'),
  })

  // Fix: always fromUserId = current user
  const settle = () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter a valid amount'); return }
    api.post('/settlements', {
      toUserId: direction === 'pay' ? friend.id : user.id,
      amount: parseFloat(amount),
      currency,
      groupId: groupId || null,
      notes,
    }).then(() => {
      toast.success('Payment recorded!')
      qc.invalidateQueries(['balances'])
      qc.invalidateQueries(['settlements'])
      qc.invalidateQueries(['friends'])
      qc.invalidateQueries(['activity'])
      onClose()
    }).catch(err => toast.error(err.response?.data?.message || 'Failed'))
  }

  return (
    <Modal open={open} onClose={onClose} title="Settle Up" size="sm">
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <Avatar user={user} size="sm" />
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 border-t-2 border-dashed border-gray-300" />
            <span className="text-xs text-gray-400">payment</span>
            <div className="flex-1 border-t-2 border-dashed border-gray-300" />
          </div>
          <Avatar user={friend} size="sm" />
        </div>

        <div>
          <label className="label">Direction</label>
          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-center justify-center text-sm font-medium py-2.5 border rounded-lg cursor-pointer transition-colors ${direction === 'pay' ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600'}`}>
              <input type="radio" className="sr-only" checked={direction === 'pay'} onChange={() => setDirection('pay')} />
              You paid {friend?.name?.split(' ')[0]}
            </label>
            <label className={`flex items-center justify-center text-sm font-medium py-2.5 border rounded-lg cursor-pointer transition-colors ${direction === 'receive' ? 'bg-primary-500 text-white border-primary-500' : 'border-gray-200 text-gray-600'}`}>
              <input type="radio" className="sr-only" checked={direction === 'receive'} onChange={() => setDirection('receive')} />
              {friend?.name?.split(' ')[0]} paid you
            </label>
          </div>
        </div>

        <div>
          <label className="label">Amount</label>
          <div className="flex gap-2">
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="input w-24 flex-shrink-0">
              {currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <input
              type="number" step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00" className="input"
            />
          </div>
        </div>

        <div>
          <label className="label">Notes (optional)</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Cash, Venmo, etc." className="input" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={settle} className="btn-primary flex-1">Record payment</button>
        </div>
      </div>
    </Modal>
  )
}
