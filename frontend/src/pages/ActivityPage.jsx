import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import Avatar from '../components/Avatar'
import { Clock } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

const activityLabel = (type, metadata) => {
  const map = {
    EXPENSE_ADDED: `added expense "${metadata?.description || ''}"`,
    EXPENSE_UPDATED: `updated expense "${metadata?.description || ''}"`,
    EXPENSE_DELETED: `deleted expense "${metadata?.description || ''}"`,
    SETTLEMENT_CREATED: `recorded a payment of ${metadata?.currency || ''} ${metadata?.amount || ''}`,
    FRIEND_REQUEST_SENT: 'sent a friend request',
    FRIEND_REQUEST_ACCEPTED: 'accepted a friend request',
    GROUP_CREATED: `created group "${metadata?.groupName || ''}"`,
    GROUP_MEMBER_ADDED: `added ${metadata?.userName || 'someone'} to a group`,
    GROUP_MEMBER_REMOVED: `removed someone from a group`,
  }
  return map[type] || type
}

const typeColors = {
  EXPENSE_ADDED: 'bg-primary-100 text-primary-600',
  EXPENSE_UPDATED: 'bg-blue-100 text-blue-600',
  EXPENSE_DELETED: 'bg-red-100 text-red-500',
  SETTLEMENT_CREATED: 'bg-green-100 text-green-600',
  FRIEND_REQUEST_SENT: 'bg-purple-100 text-purple-600',
  FRIEND_REQUEST_ACCEPTED: 'bg-purple-100 text-purple-600',
  GROUP_CREATED: 'bg-yellow-100 text-yellow-600',
  GROUP_MEMBER_ADDED: 'bg-yellow-100 text-yellow-600',
  GROUP_MEMBER_REMOVED: 'bg-gray-100 text-gray-500',
}

export default function ActivityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get('/activity?limit=50').then(r => r.data),
    refetchInterval: 30000,
  })

  const activities = data?.activities || []

  let lastDate = null

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">Activity</h1>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : activities.length === 0 ? (
        <div className="card text-center py-12">
          <Clock size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No activity yet</p>
        </div>
      ) : (
        <div className="card space-y-0 divide-y divide-gray-50">
          {activities.map((a) => {
            const dateStr = format(new Date(a.createdAt), 'MMMM d, yyyy')
            const showDate = dateStr !== lastDate
            lastDate = dateStr
            return (
              <div key={a.id}>
                {showDate && (
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-4 pb-2 first:pt-0">
                    {dateStr}
                  </p>
                )}
                <div className="flex items-start gap-3 py-3">
                  <Avatar user={a.user} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{a.user.name}</span>{' '}
                      {activityLabel(a.type, a.metadata)}
                    </p>
                    {a.group && (
                      <p className="text-xs text-gray-400 mt-0.5">in {a.group.name}</p>
                    )}
                    {a.metadata?.amount && !a.type.includes('SETTLEMENT') && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {a.metadata.currency} {a.metadata.amount}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[a.type] || 'bg-gray-100 text-gray-500'}`}>
                    {a.type.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
