import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { Plus, UsersRound, Image, ChevronRight } from 'lucide-react'

const GROUP_TYPES = [
  { value: 'TRIP', label: 'Trip', emoji: '✈️' },
  { value: 'HOME', label: 'Home', emoji: '🏠' },
  { value: 'COUPLE', label: 'Couple', emoji: '❤️' },
  { value: 'OTHER', label: 'Other', emoji: '👥' },
]

export default function GroupsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [groupImage, setGroupImage] = useState(null)

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then(r => r.data),
  })

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.get('/friends').then(r => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { name: '', type: 'OTHER', simplifyDebts: false },
  })

  const createGroup = useMutation({
    mutationFn: (data) => {
      const fd = new FormData()
      fd.append('name', data.name)
      fd.append('type', data.type)
      fd.append('simplifyDebts', data.simplifyDebts)
      fd.append('memberIds', JSON.stringify(selectedMembers.map(m => m.id)))
      if (groupImage) fd.append('image', groupImage)
      return api.post('/groups', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      toast.success('Group created!')
      qc.invalidateQueries(['groups'])
      setShowCreate(false)
      reset()
      setSelectedMembers([])
      setGroupImage(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const toggleMember = (f) => {
    if (selectedMembers.find(m => m.id === f.id)) {
      setSelectedMembers(prev => prev.filter(m => m.id !== f.id))
    } else {
      setSelectedMembers(prev => [...prev, f])
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Groups</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Create group
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="card text-center py-12">
          <UsersRound size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">No groups yet. Create one for your trip or home!</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">Create your first group</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map(g => (
            <Link key={g.id} to={`/groups/${g.id}`} className="card hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {g.image
                  ? <img src={g.image} alt={g.name} className="w-full h-full object-cover" />
                  : <UsersRound size={22} className="text-primary-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{g.name}</p>
                <p className="text-xs text-gray-400">{g.members.length} members · {g._count.expenses} expenses</p>
                <div className="flex -space-x-1 mt-1.5">
                  {g.members.slice(0, 4).map(m => (
                    <Avatar key={m.user.id} user={m.user} size="xs" />
                  ))}
                  {g.members.length > 4 && <span className="text-xs text-gray-400 ml-2">+{g.members.length - 4}</span>}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); reset(); setSelectedMembers([]) }} title="Create Group">
        <form onSubmit={handleSubmit(d => createGroup.mutate(d))} className="space-y-5">
          <div>
            <label className="label">Group name</label>
            <input {...register('name', { required: 'Required' })} placeholder="Trip to Paris, Apartment 4B..." className="input" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {GROUP_TYPES.map(t => (
                <label key={t.value} className="cursor-pointer">
                  <input type="radio" {...register('type')} value={t.value} className="sr-only" />
                  <div className="border rounded-lg p-2 text-center text-xs hover:border-primary-300 transition-colors">
                    <div className="text-xl mb-1">{t.emoji}</div>
                    {t.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Group image (optional)</label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-200 rounded-lg px-3 py-2 hover:border-primary-300 transition-colors">
              <Image size={15} className="text-gray-400" />
              <span className="text-sm text-gray-400">{groupImage ? groupImage.name : 'Upload image'}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={e => setGroupImage(e.target.files[0])} />
            </label>
          </div>

          {friends.length > 0 && (
            <div>
              <label className="label">Add members</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {friends.map(f => {
                  const selected = selectedMembers.find(m => m.id === f.id)
                  return (
                    <label key={f.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={!!selected} onChange={() => toggleMember(f)} className="w-4 h-4 accent-primary-500" />
                      <Avatar user={f} size="xs" />
                      <span className="text-sm font-medium">{f.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" {...register('simplifyDebts')} id="simplify" className="w-4 h-4 accent-primary-500" />
            <label htmlFor="simplify" className="text-sm text-gray-600">Simplify debts (minimize transactions)</label>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createGroup.isPending} className="btn-primary flex-1">
              {createGroup.isPending ? 'Creating...' : 'Create group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
