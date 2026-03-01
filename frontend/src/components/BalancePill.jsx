export default function BalancePill({ amount, currency = 'USD' }) {
  if (Math.abs(amount) < 0.01) {
    return <span className="badge-gray">settled up</span>
  }
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Math.abs(amount))
  if (amount > 0) {
    return <span className="badge-green">owes you {fmt}</span>
  }
  return <span className="badge-red">you owe {fmt}</span>
}
