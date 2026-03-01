import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import AddExpenseModal from '../components/AddExpenseModal'
import { Plus, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardPage() {
  const { user } = useAuth()
  const [showAddExpense, setShowAddExpense] = useState(false)

  const { data: balanceData } = useQuery({
    queryKey: ['balances'],
    queryFn: () => api.get('/balances').then(r => r.data),
  })

  const { data: activityData } = useQuery({
    queryKey: ['activity', 'dashboard'],
    queryFn: () => api.get('/activity?limit=8').then(r => r.data),
  })

  const { data: friendsData } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.get('/friends').then(r => r.data),
  })

  const fmt = (amt) => new Intl.NumberFormat('en-US', { style: 'currency', currency: user?.defaultCurrency || 'USD' }).format(Math.abs(amt || 0))

  const totalOwed = balanceData?.totalOwed || 0
  const totalOwing = Math.abs(balanceData?.totalOwing || 0)
  const netBalance = totalOwed - totalOwing

  const activityLabel = (type) => ({
    EXPENSE_ADDED: 'added expense',
    EXPENSE_UPDATED: 'updated expense',
    EXPENSE_DELETED: 'deleted expense',
    SETTLEMENT_CREATED: 'recorded a payment',
    FRIEND_REQUEST_SENT: 'sent a friend request',
    FRIEND_REQUEST_ACCEPTED: 'accepted friend request',
    GROUP_CREATED: 'created a group',
    GROUP_MEMBER_ADDED: 'added someone to a group',
    GROUP_MEMBER_REMOVED: 'removed someone from a group',
  }[type] || type)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back, {user?.name?.split(' ')[0]}</p>
        </div>
        <button onClick={() => setShowAddExpense(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add expense
        </button>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Total Balance</span>
            {netBalance >= 0
              ? <TrendingUp size={18} className="text-green-500" />
              : <TrendingDown size={18} className="text-red-500" />}
          </div>
          <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {netBalance >= 0 ? '' : '-'}{fmt(netBalance)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Overall net balance</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">You are owed</span>
            <TrendingUp size={18} className="text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{fmt(totalOwed)}</p>
          <p className="text-xs text-gray-400 mt-1">Friends owe you</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">You owe</span>
            <TrendingDown size={18} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-500">{fmt(totalOwing)}</p>
          <p className="text-xs text-gray-400 mt-1">You owe others</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balances with friends */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Balances</h2>
            <Link to="/friends" className="text-sm text-primary-600 hover:underline">See all</Link>
          </div>
          {!balanceData?.balances?.length ? (
            <div className="text-center py-6">
              <Minus size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">All settled up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {balanceData.balances.slice(0, 5).map(({ user: friend, balance }) => (
                <Link key={friend.id} to={`/friends/${friend.id}`} className="flex items-center justify-between py-1.5 hover:bg-gray-50 rounded-lg px-1 -mx-1 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar user={friend} size="sm" />
                    <span className="text-sm font-medium text-gray-700">{friend.name}</span>
                  </div>
                  <span className={`text-sm font-semibold ${balance > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {balance > 0 ? '+' : ''}{fmt(balance)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Recent Activity</h2>
            <Link to="/activity" className="text-sm text-primary-600 hover:underline">See all</Link>
          </div>
          {!activityData?.activities?.length ? (
            <div className="text-center py-6">
              <Clock size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activityData.activities.map(a => (
                <div key={a.id} className="flex items-start gap-3">
                  <Avatar user={a.user} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{a.user.name}</span>{' '}
                      {activityLabel(a.type)}
                      {a.metadata?.description && <span className="font-medium"> "{a.metadata.description}"</span>}
                    </p>
                    {a.metadata?.amount && (
                      <p className="text-xs text-gray-400">
                        {a.metadata.currency} {a.metadata.amount}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddExpenseModal open={showAddExpense} onClose={() => setShowAddExpense(false)} />
    </div>
  )
}
