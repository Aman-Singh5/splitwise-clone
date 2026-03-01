export default function Avatar({ user, size = 'md' }) {
  const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-12 h-12 text-lg', xl: 'w-16 h-16 text-xl' }
  const cls = sizes[size] || sizes.md

  if (user?.avatar) {
    return <img src={user.avatar} alt={user.name} className={`${cls} rounded-full object-cover flex-shrink-0`} />
  }
  return (
    <div className={`${cls} rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0`}>
      <span className="font-bold text-primary-700">{user?.name?.[0]?.toUpperCase() || '?'}</span>
    </div>
  )
}
