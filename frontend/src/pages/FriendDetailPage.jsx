import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import AddExpenseModal from '../components/AddExpenseModal'
import SettleUpModal from '../components/SettleUpModal'
import { ArrowLeft, Plus, HandCoins, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

export default function FriendDetailPage() {
  const { friendId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettle, setShowSettle] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const { data: friends = [] } = useQuery({ queryKey: ['friends'], queryFn: () => api.get('/friends').then(r => r.data) })
  const friend = friends.find(f => f.id === friendId)

  const { data, isLoading } = useQuery({
    queryKey: ['balances', 'friend', friendId],
    queryFn: () => api.get(`/balances/friends/${friendId}`).then(r => r.data),
    enabled: !!friendId,
  })

  const deleteExpense = useMutation({
    mutationFn: (id) => api.delete(`/expenses/${id}`),
    onSuccess: () => { toast.success('Expense deleted'); qc.invalidateQueries(['balances', 'friend', friendId]) },
    onError: () => toast.error('Failed to delete'),
  })

  const balance = data?.balance || 0
  const expenses = data?.expenses || []
  const settlements = data?.settlements || []

  const fmt = (amt) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amt))

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/friends')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} className="text-gray-600" /></button>
        <h1 className="text-xl font-bold text-gray-800">
          {friend ? friend.name : 'Friend'}
        </h1>
      </div>

      {/* Balance Card */}
      <div className={`card text-center py-6 ${balance > 0 ? 'bg-green-50 border-green-100' : balance < 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
        {friend && <div className="flex justify-center mb-3"><Avatar user={friend} size="lg" /></div>}
        {balance > 0 ? (
          <>
            <p className="text-sm text-green-600 font-medium">{friend?.name} owes you</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{fmt(balance)}</p>
          </>
        ) : balance < 0 ? (
          <>
            <p className="text-sm text-red-500 font-medium">You owe {friend?.name}</p>
            <p className="text-3xl font-bold text-red-500 mt-1">{fmt(balance)}</p>
          </>
        ) : (
          <p className="text-lg font-semibold text-gray-500">All settled up!</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => setShowAddExpense(true)} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <Plus size={16} /> Add expense
        </button>
        {Math.abs(balance) > 0.01 && (
          <button onClick={() => setShowSettle(true)} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <HandCoins size={16} /> Settle up
          </button>
        )}
      </div>

      {/* Expenses */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">Shared Expenses</h2>
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : expenses.length === 0 ? (
          <p className="text-center text-gray-400 py-6">No shared expenses yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {expenses.map(exp => {
              const userSplit = exp.splits.find(s => s.userId === user.id)
              const isOwed = exp.paidById === user.id
              const splitAmt = userSplit?.amount || 0

              return (
                <div key={exp.id} className="py-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{exp.category}</span>
                        {exp.isRecurring && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Recurring</span>}
                      </div>
                      <p className="font-medium text-gray-800 mt-1">{exp.description}</p>
                      <p className="text-xs text-gray-400">{format(new Date(exp.date), 'MMM d, yyyy')} · Paid by {exp.paidBy.name === user.name ? 'you' : exp.paidBy.name}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-semibold text-gray-700">{exp.currency} {exp.amount.toFixed(2)}</p>
                      {isOwed
                        ? <p className="text-xs text-green-600">you lent {fmt(exp.amount - splitAmt)}</p>
                        : <p className="text-xs text-red-500">you borrowed {fmt(splitAmt)}</p>
                      }
                    </div>
                  </div>
                  {expandedId === exp.id && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {exp.splits.map(s => (
                          <div key={s.userId} className="flex items-center gap-1.5 text-xs bg-gray-50 rounded-full px-2.5 py-1">
                            <Avatar user={s.user} size="xs" />
                            <span>{s.user.name === user.name ? 'You' : s.user.name}: {exp.currency} {s.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {exp.paidById === user.id && (
                        <button onClick={() => deleteExpense.mutate(exp.id)} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700">
                          <Trash2 size={13} /> Delete expense
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Settlement history */}
      {settlements.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Payments</h2>
          <div className="space-y-2">
            {settlements.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-600">
                  {s.fromUserId === user.id ? 'You paid' : `${friend?.name} paid`}
                </span>
                <span className="font-medium text-gray-800">{s.currency} {s.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {friend && (
        <>
          <AddExpenseModal open={showAddExpense} onClose={() => setShowAddExpense(false)} prefillFriendId={friendId} />
          <SettleUpModal open={showSettle} onClose={() => setShowSettle(false)} friend={friend} defaultAmount={Math.abs(balance).toFixed(2)} />
        </>
      )}
    </div>
  )
}
