import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import AddExpenseModal from '../components/AddExpenseModal'
import SettleUpModal from '../components/SettleUpModal'
import { ArrowLeft, Plus, UserPlus, LogOut, Trash2, Settings, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'

export default function GroupDetailPage() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('expenses')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showSettle, setShowSettle] = useState(null)
  const [memberEmail, setMemberEmail] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const { data: group, isLoading } = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => api.get(`/groups/${groupId}`).then(r => r.data),
  })

  const { data: balanceData } = useQuery({
    queryKey: ['balances', 'group', groupId],
    queryFn: () => api.get(`/balances/groups/${groupId}`).then(r => r.data),
  })

  const leaveGroup = useMutation({
    mutationFn: () => api.delete(`/groups/${groupId}/members/${user.id}`),
    onSuccess: () => { toast.success('Left group'); navigate('/groups') },
  })

  const deleteGroup = useMutation({
    mutationFn: () => api.delete(`/groups/${groupId}`),
    onSuccess: () => { toast.success('Group deleted'); navigate('/groups') },
  })

  const addMember = useMutation({
    mutationFn: () => api.post(`/groups/${groupId}/members`, { email: memberEmail }),
    onSuccess: () => { toast.success('Member added!'); setShowAddMember(false); setMemberEmail(''); qc.invalidateQueries(['groups', groupId]) },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const removeMember = useMutation({
    mutationFn: (uid) => api.delete(`/groups/${groupId}/members/${uid}`),
    onSuccess: () => { qc.invalidateQueries(['groups', groupId]); toast.success('Member removed') },
  })

  const deleteExpense = useMutation({
    mutationFn: (id) => api.delete(`/expenses/${id}`),
    onSuccess: () => { toast.success('Expense deleted'); qc.invalidateQueries(['groups', groupId]); qc.invalidateQueries(['balances', 'group', groupId]) },
  })

  const isAdmin = group?.members?.find(m => m.userId === user.id)?.role === 'ADMIN'
  const isCreator = group?.createdById === user.id

  if (isLoading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!group) return <p className="text-center text-gray-400 py-10">Group not found</p>

  const fmt = (amt) => `$${Math.abs(amt).toFixed(2)}`

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/groups')} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} className="text-gray-600" /></button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-primary-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {group.image ? <img src={group.image} alt={group.name} className="w-full h-full object-cover" /> : <span className="text-primary-500 font-bold">{group.name[0]}</span>}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{group.name}</h1>
            <p className="text-xs text-gray-400">{group.members.length} members</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddMember(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" title="Add member">
            <UserPlus size={18} />
          </button>
          <button onClick={() => leaveGroup.mutate()} className="p-2 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-500" title="Leave group">
            <LogOut size={18} />
          </button>
          {isCreator && (
            <button onClick={() => { if (confirm('Delete this group?')) deleteGroup.mutate() }} className="p-2 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-500" title="Delete group">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <button onClick={() => setShowAddExpense(true)} className="btn-primary w-full flex items-center justify-center gap-2">
        <Plus size={18} /> Add expense
      </button>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {['expenses', 'balances', 'members'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Expenses tab */}
      {activeTab === 'expenses' && (
        <div className="card">
          {!group.expenses?.length ? (
            <p className="text-center text-gray-400 py-8">No expenses yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {group.expenses.map(exp => {
                const userSplit = exp.splits.find(s => s.userId === user.id)
                const isOwed = exp.paidById === user.id
                return (
                  <div key={exp.id} className="py-3">
                    <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{exp.category}</span>
                        <p className="font-medium text-gray-800 mt-1">{exp.description}</p>
                        <p className="text-xs text-gray-400">{format(new Date(exp.date), 'MMM d, yyyy')} · Paid by {exp.paidBy.id === user.id ? 'you' : exp.paidBy.name}</p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="font-semibold text-gray-700">{exp.currency} {exp.amount.toFixed(2)}</p>
                        {userSplit && (
                          isOwed
                            ? <p className="text-xs text-green-600">you lent {fmt(exp.amount - userSplit.amount)}</p>
                            : <p className="text-xs text-red-500">you owe {fmt(userSplit.amount)}</p>
                        )}
                      </div>
                    </div>
                    {expandedId === exp.id && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <div className="flex flex-wrap gap-2">
                          {exp.splits.map(s => (
                            <div key={s.userId} className="flex items-center gap-1.5 text-xs bg-gray-50 rounded-full px-2.5 py-1">
                              <Avatar user={s.user} size="xs" />
                              <span>{s.user.id === user.id ? 'You' : s.user.name}: {exp.currency} {s.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        {exp.paidById === user.id && (
                          <button onClick={() => deleteExpense.mutate(exp.id)} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 mt-2">
                            <Trash2 size={13} /> Delete
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
      )}

      {/* Balances tab */}
      {activeTab === 'balances' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-4">Member Balances</h3>
            <div className="space-y-3">
              {balanceData?.memberBalances?.map(({ user: u, balance }) => (
                <div key={u?.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar user={u} size="sm" />
                    <span className="text-sm font-medium">{u?.id === user.id ? 'You' : u?.name}</span>
                  </div>
                  <span className={`text-sm font-semibold ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {balance > 0 ? '+' : ''}{fmt(balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {balanceData?.transactions?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-4">Suggested payments{balanceData.simplifyDebts ? ' (simplified)' : ''}</h3>
              <div className="space-y-3">
                {balanceData.transactions.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Avatar user={t.from} size="xs" />
                    <span className="text-sm text-gray-600">{t.from?.id === user.id ? 'You' : t.from?.name}</span>
                    <ArrowRight size={14} className="text-gray-400" />
                    <Avatar user={t.to} size="xs" />
                    <span className="text-sm text-gray-600">{t.to?.id === user.id ? 'You' : t.to?.name}</span>
                    <span className="text-sm font-semibold text-gray-800 ml-auto">${t.amount.toFixed(2)}</span>
                    {(t.from?.id === user.id || t.to?.id === user.id) && (
                      <button
                        onClick={() => setShowSettle({ friend: t.from?.id === user.id ? t.to : t.from, amount: t.amount })}
                        className="text-xs btn-primary py-1 px-3"
                      >
                        Settle
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {activeTab === 'members' && (
        <div className="card">
          <div className="space-y-3">
            {group.members.map(m => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar user={m.user} size="sm" />
                  <div>
                    <p className="text-sm font-medium">{m.user.id === user.id ? 'You' : m.user.name}</p>
                    <p className="text-xs text-gray-400">{m.role}</p>
                  </div>
                </div>
                {isAdmin && m.userId !== user.id && (
                  <button onClick={() => removeMember.mutate(m.userId)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <AddExpenseModal open={showAddExpense} onClose={() => setShowAddExpense(false)} groupId={groupId} />

      <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Add Member" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Email address</label>
            <input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="friend@example.com" type="email" className="input" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAddMember(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => addMember.mutate()} disabled={addMember.isPending} className="btn-primary flex-1">Add</button>
          </div>
        </div>
      </Modal>

      {showSettle && (
        <SettleUpModal
          open={!!showSettle}
          onClose={() => setShowSettle(null)}
          friend={showSettle.friend}
          groupId={groupId}
          defaultAmount={showSettle.amount?.toFixed(2) || ''}
        />
      )}
    </div>
  )
}
