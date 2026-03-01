import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import Avatar from '../components/Avatar'
import { Camera, Save } from 'lucide-react'

export default function AccountPage() {
  const { user, updateUser } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState(user?.name || '')
  const [defaultCurrency, setDefaultCurrency] = useState(user?.defaultCurrency || 'USD')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileRef = useRef()

  const { data: currencies = [] } = useQuery({ queryKey: ['currencies'], queryFn: () => api.get('/currencies').then(r => r.data) })

  const updateProfile = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('defaultCurrency', defaultCurrency)
      if (avatarFile) fd.append('avatar', avatarFile)
      return api.put('/users/me', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: (res) => {
      updateUser(res.data)
      toast.success('Profile updated!')
      setAvatarFile(null)
      setAvatarPreview(null)
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Account</h1>

      <div className="card space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <Avatar user={user} size="xl" />
            )}
            <button
              onClick={() => fileRef.current.click()}
              className="absolute bottom-0 right-0 w-7 h-7 bg-primary-500 rounded-full flex items-center justify-center shadow"
            >
              <Camera size={14} className="text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
          </div>
          <p className="text-sm text-gray-400 mt-2">Click to change photo</p>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Your name" />
          </div>
          <div>
            <label className="label">Email</label>
            <input value={user?.email || ''} disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="label">Default Currency</label>
            <select value={defaultCurrency} onChange={e => setDefaultCurrency(e.target.value)} className="input">
              {currencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={() => updateProfile.mutate()}
          disabled={updateProfile.isPending}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {updateProfile.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-800">Security</h2>
        <p className="text-sm text-gray-500">To change your password, use the "Forgot password" link on the login page.</p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-800">Account info</h2>
        <div className="text-sm text-gray-500 space-y-1">
          <p>Member since: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</p>
          <p>User ID: <span className="font-mono text-xs">{user?.id}</span></p>
        </div>
      </div>
    </div>
  )
}
