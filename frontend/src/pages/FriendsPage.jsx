import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { UserPlus, Check, X, ChevronRight, Search } from 'lucide-react'

export default function FriendsPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [activeTab, setActiveTab] = useState('friends')

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.get('/friends').then(r => r.data),
  })

  const { data: requests } = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => api.get('/friends/requests').then(r => r.data),
  })

  const { data: balanceData } = useQuery({
    queryKey: ['balances'],
    queryFn: () => api.get('/balances').then(r => r.data),
  })

  const balanceMap = Object.fromEntries((balanceData?.balances || []).map(b => [b.user.id, b.balance]))

  const sendRequest = useMutation({
    mutationFn: (email) => api.post('/friends/request', { email }).then(r => r.data),
    onSuccess: (data) => {
      toast.success(data?.message || 'Friend request sent!')
      qc.invalidateQueries(['friend-requests'])
      setShowAdd(false)
      setSearchInput('')
      setInviteEmail('')
      setSearchResults([])
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const acceptRequest = useMutation({
    mutationFn: (id) => api.put(`/friends/${id}/accept`),
    onSuccess: () => { toast.success('Friend request accepted!'); qc.invalidateQueries(['friends']); qc.invalidateQueries(['friend-requests']) },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const declineRequest = useMutation({
    mutationFn: (id) => api.put(`/friends/${id}/decline`),
    onSuccess: () => { qc.invalidateQueries(['friend-requests']); toast.success('Request declined') },
  })

  const searchUsers = async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
      setSearchResults(res.data)
    } finally {
      setSearching(false)
    }
  }

  const pendingCount = (requests?.received?.length || 0)

  const fmt = (amt, pos) => {
    const abs = Math.abs(amt || 0)
    if (abs < 0.01) return null
    const sign = amt > 0 ? '+' : '-'
    return { text: `${sign}$${abs.toFixed(2)}`, positive: amt > 0 }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Friends</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <UserPlus size={18} /> Add friend
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[{ key: 'friends', label: 'Friends' }, { key: 'requests', label: `Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}` }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'friends' && (
        <div className="card">
          {isLoading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : friends.length === 0 ? (
            <div className="text-center py-10">
              <UserPlus size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">No friends yet. Add some!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {friends.map(f => {
                const balance = balanceMap[f.id] || 0
                return (
                  <Link key={f.id} to={`/friends/${f.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar user={f} size="md" />
                      <div>
                        <p className="font-medium text-gray-800">{f.name}</p>
                        <p className="text-xs text-gray-400">{f.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {Math.abs(balance) > 0.01 && (
                        <span className={`text-sm font-semibold ${balance > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {balance > 0 ? `+$${balance.toFixed(2)}` : `-$${Math.abs(balance).toFixed(2)}`}
                        </span>
                      )}
                      {Math.abs(balance) < 0.01 && <span className="text-xs text-gray-400">settled up</span>}
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-4">
          {requests?.received?.length > 0 && (
            <div className="card">
              <h3 className="font-medium text-gray-700 mb-3">Incoming requests</h3>
              <div className="space-y-3">
                {requests.received.map(r => (
                  <div key={r.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar user={r.user} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{r.user.name}</p>
                        <p className="text-xs text-gray-400">{r.user.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptRequest.mutate(r.id)} className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 transition-colors">
                        <Check size={16} className="text-green-600" />
                      </button>
                      <button onClick={() => declineRequest.mutate(r.id)} className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 transition-colors">
                        <X size={16} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {requests?.sent?.length > 0 && (
            <div className="card">
              <h3 className="font-medium text-gray-700 mb-3">Sent requests</h3>
              <div className="space-y-3">
                {requests.sent.map(r => (
                  <div key={r.id} className="flex items-center gap-3">
                    <Avatar user={r.friend} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{r.friend.name}</p>
                      <p className="text-xs text-gray-400">Pending</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!requests?.received?.length && !requests?.sent?.length && (
            <div className="card text-center py-10">
              <p className="text-gray-400">No pending requests</p>
            </div>
          )}
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); setSearchInput(''); setInviteEmail(''); setSearchResults([]) }} title="Add Friend">
        <div className="space-y-4">
          <div>
            <label className="label">Search by name or email</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                value={searchInput}
                onChange={e => { setSearchInput(e.target.value); searchUsers(e.target.value) }}
                placeholder="Search by name or email..."
                className="input pl-8"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="border border-gray-100 rounded-lg mt-2 divide-y divide-gray-50 shadow-sm">
                {searchResults.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar user={u} size="xs" />
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => sendRequest.mutate(u.email)}
                      disabled={sendRequest.isPending}
                      className="text-xs btn-primary py-1 px-3"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400">or invite directly by email</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
          <div>
            <label className="label">Invite by email address</label>
            <div className="flex gap-2">
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="friend@example.com"
                type="email"
                className="input"
              />
              <button
                onClick={() => {
                  if (!inviteEmail.trim()) { toast.error('Please enter an email address'); return }
                  sendRequest.mutate(inviteEmail.trim())
                }}
                disabled={sendRequest.isPending}
                className="btn-primary whitespace-nowrap"
              >
                Send invite
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
