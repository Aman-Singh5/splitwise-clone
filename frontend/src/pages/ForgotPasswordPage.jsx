import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/client'
import { Wallet } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Wallet size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Reset password</h1>
        </div>
        <div className="card shadow-md">
          {sent ? (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium">Check your email!</p>
              <p className="text-sm text-gray-500 mt-2">We sent a reset link to <strong>{email}</strong></p>
              <Link to="/login" className="mt-4 inline-block text-primary-600 hover:underline text-sm">Back to login</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input" required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <p className="text-center text-sm"><Link to="/login" className="text-primary-600 hover:underline">Back to login</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
