import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { BarChart2 } from 'lucide-react'

const COLORS = ['#1cc29f', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16']

const CATEGORIES = ['General', 'Food & Drink', 'Transport', 'Entertainment', 'Accommodation', 'Shopping', 'Utilities', 'Health', 'Travel', 'Other']

export default function ReportsPage() {
  const { user } = useAuth()
  const [months, setMonths] = useState(3)

  const { data: expenseData } = useQuery({
    queryKey: ['expenses', 'reports', months],
    queryFn: () => api.get(`/expenses?limit=500`).then(r => r.data),
  })

  const expenses = expenseData?.expenses || []

  const now = new Date()
  const filtered = expenses.filter(e => {
    const d = new Date(e.date)
    return d >= subMonths(now, months)
  })

  // Category breakdown
  const categoryMap = {}
  filtered.forEach(e => {
    const split = e.splits?.find(s => s.userId === user?.id)
    if (!split) return
    const cat = e.category || 'General'
    categoryMap[cat] = (categoryMap[cat] || 0) + split.amount
  })
  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)

  // Monthly trend
  const monthlyMap = {}
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i)
    const key = format(d, 'MMM yyyy')
    monthlyMap[key] = 0
  }
  filtered.forEach(e => {
    const key = format(new Date(e.date), 'MMM yyyy')
    const split = e.splits?.find(s => s.userId === user?.id)
    if (split && monthlyMap[key] !== undefined) {
      monthlyMap[key] += split.amount
    }
  })
  const monthlyData = Object.entries(monthlyMap).map(([month, amount]) => ({
    month,
    amount: Math.round(amount * 100) / 100,
  }))

  const totalSpent = filtered.reduce((s, e) => {
    const split = e.splits?.find(sp => sp.userId === user?.id)
    return s + (split?.amount || 0)
  }, 0)

  const fmt = (v) => `$${v.toFixed(2)}`

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <select value={months} onChange={e => setMonths(parseInt(e.target.value))} className="input w-36">
          <option value={1}>Last month</option>
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-1">Total spent</p>
          <p className="text-2xl font-bold text-primary-600">{fmt(totalSpent)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-1">Expenses</p>
          <p className="text-2xl font-bold text-gray-700">{filtered.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-1">Avg per month</p>
          <p className="text-2xl font-bold text-gray-700">{fmt(totalSpent / months)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Spending by Category</h2>
          {categoryData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48">
              <BarChart2 size={40} className="text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Line chart */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Monthly Spending</h2>
          {monthlyData.every(d => d.amount === 0) ? (
            <div className="flex flex-col items-center justify-center h-48">
              <BarChart2 size={40} className="text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="amount" stroke="#1cc29f" strokeWidth={2} dot={{ r: 4, fill: '#1cc29f' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Category table */}
      {categoryData.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Category Breakdown</h2>
          <div className="space-y-3">
            {categoryData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-sm text-gray-600 flex-1">{c.name}</span>
                <div className="flex-1 mx-2">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.value / (categoryData[0]?.value || 1)) * 100}%`,
                        background: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 w-20 text-right">{fmt(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
