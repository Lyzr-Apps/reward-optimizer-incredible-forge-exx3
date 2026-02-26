'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { FiGrid, FiTrendingUp, FiLayers, FiAward, FiPlus, FiTrash2, FiEdit2, FiSend, FiChevronDown, FiChevronUp, FiCreditCard, FiDollarSign, FiStar, FiCheck, FiX, FiAlertCircle, FiRefreshCw, FiFilter } from 'react-icons/fi'

// --- TYPES ---

interface RewardCategory {
  category: string
  rate: string
}

interface CreditCard {
  id: string
  name: string
  issuer: string
  annualFee: number
  rewardCategories: RewardCategory[]
  pointsBalance: number
}

interface Expense {
  id: string
  category: string
  amount: number
  source: string
}

interface OptRecommendation {
  category?: string
  recommended_card?: string
  reward_rate?: string
  estimated_monthly_points?: string
  improvement_vs_current?: string
  reasoning?: string
}

interface OptResult {
  recommendations?: OptRecommendation[]
  total_projected_rewards?: string
  summary?: string
}

interface AltCard {
  card_name?: string
  issuer?: string
  annual_fee?: string
  key_reward_rates?: string
  estimated_annual_rewards?: string
  net_value_comparison?: string
  why_this_card?: string
  best_for?: string
}

interface AltResult {
  alternatives?: AltCard[]
  current_portfolio_summary?: string
  summary?: string
}

interface Strategy {
  card_name?: string
  current_balance?: string
  redemption_option?: string
  redemption_type?: string
  estimated_value_per_point?: string
  total_estimated_value?: string
  recommendation_badge?: string
  details?: string
}

interface RewardsResult {
  strategies?: Strategy[]
  total_portfolio_value?: string
  summary?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// --- CONSTANTS ---

const AGENT_IDS = {
  optimizer: '69a01adb9f922f4da1a06bc1',
  alternatives: '69a01adb92d75158491bbadf',
  rewards: '69a01adb92d75158491bbae1',
}

const AGENTS_INFO = [
  { id: AGENT_IDS.optimizer, name: 'Card Optimizer', purpose: 'Best card per spending category' },
  { id: AGENT_IDS.alternatives, name: 'Card Alternatives', purpose: 'Discover better credit cards' },
  { id: AGENT_IDS.rewards, name: 'Rewards Strategist', purpose: 'Optimal redemption strategies' },
]

const SAMPLE_CARDS: CreditCard[] = [
  {
    id: 'sc1',
    name: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    annualFee: 95,
    rewardCategories: [
      { category: 'Travel', rate: '5x points' },
      { category: 'Dining', rate: '3x points' },
      { category: 'Streaming', rate: '3x points' },
    ],
    pointsBalance: 48500,
  },
  {
    id: 'sc2',
    name: 'Amex Blue Cash Preferred',
    issuer: 'American Express',
    annualFee: 95,
    rewardCategories: [
      { category: 'Groceries', rate: '6% cashback' },
      { category: 'Streaming', rate: '6% cashback' },
      { category: 'Transit', rate: '3% cashback' },
    ],
    pointsBalance: 12300,
  },
  {
    id: 'sc3',
    name: 'Citi Double Cash',
    issuer: 'Citi',
    annualFee: 0,
    rewardCategories: [
      { category: 'Everything', rate: '2% cashback' },
    ],
    pointsBalance: 7800,
  },
]

const SAMPLE_EXPENSES: Expense[] = [
  { id: 'se1', category: 'Groceries', amount: 650, source: 'manual' },
  { id: 'se2', category: 'Dining', amount: 420, source: 'manual' },
  { id: 'se3', category: 'Travel', amount: 350, source: 'manual' },
  { id: 'se4', category: 'Gas', amount: 200, source: 'manual' },
  { id: 'se5', category: 'Streaming', amount: 85, source: 'manual' },
  { id: 'se6', category: 'Shopping', amount: 300, source: 'manual' },
]

const EXPENSE_CATEGORIES = [
  'Groceries', 'Dining', 'Travel', 'Gas', 'Streaming', 'Shopping',
  'Utilities', 'Transit', 'Entertainment', 'Healthcare', 'Insurance', 'Other'
]

// --- HELPERS ---

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function parseAgentResponse(result: any): any {
  let data = result?.response?.result
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { /* keep as string */ }
  }
  if (typeof result?.response?.result === 'string' && !data) {
    try { data = JSON.parse(result.response.result) } catch { /* fallback */ }
  }
  return data
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1 font-serif">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1 font-serif">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2 font-serif">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm leading-relaxed">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm leading-relaxed">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

// --- ERROR BOUNDARY ---

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[hsl(0,0%,99%)] text-[hsl(30,5%,15%)]">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2 font-serif">Something went wrong</h2>
            <p className="text-[hsl(30,5%,50%)] mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-[hsl(40,30%,45%)] text-white text-sm tracking-wider uppercase">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- SKELETON ---

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 bg-[hsl(30,8%,92%)] w-2/3" />
      <div className="h-4 bg-[hsl(30,8%,92%)] w-full" />
      <div className="h-4 bg-[hsl(30,8%,92%)] w-5/6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="border border-[hsl(30,10%,88%)] p-6">
            <div className="h-4 bg-[hsl(30,8%,92%)] w-1/2 mb-3" />
            <div className="h-3 bg-[hsl(30,8%,92%)] w-3/4 mb-2" />
            <div className="h-3 bg-[hsl(30,8%,92%)] w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

// --- CHAT PANEL ---

function ChatPanel({ agentId, agentName, sessionId }: {
  agentId: string
  agentName: string
  sessionId: string | null
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const result = await callAIAgent(userMsg, agentId, sessionId ? { session_id: sessionId } : undefined)
      let text = ''
      if (result.success) {
        const data = parseAgentResponse(result)
        if (typeof data === 'string') {
          text = data
        } else if (data?.summary) {
          text = data.summary
        } else if (result?.response?.message) {
          text = result.response.message
        } else {
          text = JSON.stringify(data, null, 2)
        }
      } else {
        text = result?.error ?? 'Something went wrong. Please try again.'
      }
      setMessages(prev => [...prev, { role: 'assistant', content: text }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'An error occurred.' }])
    }
    setLoading(false)
  }, [input, loading, agentId, sessionId])

  return (
    <div className="mt-8 border border-[hsl(30,10%,88%)] bg-white">
      <div className="px-6 py-4 border-b border-[hsl(30,10%,88%)]">
        <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans">Follow-up with {agentName}</p>
      </div>
      {messages.length > 0 && (
        <div className="max-h-64 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-[hsl(30,10%,95%)] text-[hsl(30,5%,15%)]' : 'bg-white border border-[hsl(30,10%,88%)]'}`}>
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 bg-white border border-[hsl(30,10%,88%)] text-sm text-[hsl(30,5%,50%)] animate-pulse">Thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
      <div className="flex border-t border-[hsl(30,10%,88%)]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a follow-up question..."
          className="flex-1 px-4 py-3 text-sm bg-transparent outline-none placeholder:text-[hsl(30,5%,50%)] font-sans"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-4 py-3 text-[hsl(40,30%,45%)] hover:text-[hsl(40,40%,50%)] disabled:opacity-30 transition-colors"
        >
          <FiSend size={16} />
        </button>
      </div>
    </div>
  )
}

// --- DASHBOARD TAB ---

function DashboardTab({
  cards, setCards, expenses, setExpenses, sampleMode
}: {
  cards: CreditCard[]
  setCards: React.Dispatch<React.SetStateAction<CreditCard[]>>
  expenses: Expense[]
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>
  sampleMode: boolean
}) {
  const [showAddCard, setShowAddCard] = useState(false)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [cardForm, setCardForm] = useState({ name: '', issuer: '', annualFee: '', rewardCategories: [{ category: '', rate: '' }] as RewardCategory[] })
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expForm, setExpForm] = useState({ category: '', amount: '' })
  const [editingExpId, setEditingExpId] = useState<string | null>(null)
  const [editExpAmount, setEditExpAmount] = useState('')

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0)
  const totalPoints = cards.reduce((s, c) => s + c.pointsBalance, 0)

  const resetCardForm = () => {
    setCardForm({ name: '', issuer: '', annualFee: '', rewardCategories: [{ category: '', rate: '' }] })
  }

  const handleAddCard = () => {
    if (!cardForm.name.trim()) return
    const newCard: CreditCard = {
      id: generateId(),
      name: cardForm.name.trim(),
      issuer: cardForm.issuer.trim(),
      annualFee: parseFloat(cardForm.annualFee) || 0,
      rewardCategories: cardForm.rewardCategories.filter(r => r.category.trim()),
      pointsBalance: 0,
    }
    setCards(prev => [...prev, newCard])
    resetCardForm()
    setShowAddCard(false)
  }

  const handleEditCard = (card: CreditCard) => {
    setEditingCardId(card.id)
    setCardForm({
      name: card.name,
      issuer: card.issuer,
      annualFee: card.annualFee.toString(),
      rewardCategories: card.rewardCategories.length > 0 ? card.rewardCategories : [{ category: '', rate: '' }],
    })
    setShowAddCard(true)
  }

  const handleSaveEditCard = () => {
    if (!cardForm.name.trim() || !editingCardId) return
    setCards(prev => prev.map(c => c.id === editingCardId ? {
      ...c,
      name: cardForm.name.trim(),
      issuer: cardForm.issuer.trim(),
      annualFee: parseFloat(cardForm.annualFee) || 0,
      rewardCategories: cardForm.rewardCategories.filter(r => r.category.trim()),
    } : c))
    resetCardForm()
    setShowAddCard(false)
    setEditingCardId(null)
  }

  const handleDeleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id))
  }

  const handleAddExpense = () => {
    if (!expForm.category.trim() || !expForm.amount.trim()) return
    const newExp: Expense = {
      id: generateId(),
      category: expForm.category.trim(),
      amount: parseFloat(expForm.amount) || 0,
      source: 'manual',
    }
    setExpenses(prev => [...prev, newExp])
    setExpForm({ category: '', amount: '' })
    setShowAddExpense(false)
  }

  const handleUpdateExpense = (id: string) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, amount: parseFloat(editExpAmount) || 0 } : e))
    setEditingExpId(null)
    setEditExpAmount('')
  }

  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const addRewardRow = () => {
    setCardForm(prev => ({ ...prev, rewardCategories: [...prev.rewardCategories, { category: '', rate: '' }] }))
  }

  const removeRewardRow = (index: number) => {
    setCardForm(prev => ({
      ...prev,
      rewardCategories: prev.rewardCategories.filter((_, i) => i !== index),
    }))
  }

  const updateRewardRow = (index: number, field: 'category' | 'rate', value: string) => {
    setCardForm(prev => ({
      ...prev,
      rewardCategories: prev.rewardCategories.map((r, i) => i === index ? { ...r, [field]: value } : r),
    }))
  }

  return (
    <div>
      <div className="mb-10">
        <h2 className="text-2xl font-serif font-light tracking-wider uppercase mb-2">Dashboard</h2>
        <p className="text-sm text-[hsl(30,5%,50%)] leading-relaxed font-sans">Manage your credit card portfolio and track monthly expenses.</p>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="border border-[hsl(30,10%,88%)] bg-white p-6">
          <div className="flex items-center gap-3 mb-2">
            <FiCreditCard className="text-[hsl(40,30%,45%)]" size={18} />
            <span className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans">Total Cards</span>
          </div>
          <p className="text-2xl font-serif font-light">{cards.length}</p>
        </div>
        <div className="border border-[hsl(30,10%,88%)] bg-white p-6">
          <div className="flex items-center gap-3 mb-2">
            <FiDollarSign className="text-[hsl(40,30%,45%)]" size={18} />
            <span className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans">Monthly Spend</span>
          </div>
          <p className="text-2xl font-serif font-light">${totalSpend.toLocaleString()}</p>
        </div>
        <div className="border border-[hsl(30,10%,88%)] bg-white p-6">
          <div className="flex items-center gap-3 mb-2">
            <FiStar className="text-[hsl(40,30%,45%)]" size={18} />
            <span className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans">Points Tracked</span>
          </div>
          <p className="text-2xl font-serif font-light">{totalPoints.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - My Cards */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans font-medium">My Cards</h3>
            <button
              onClick={() => { setShowAddCard(!showAddCard); setEditingCardId(null); resetCardForm() }}
              className="flex items-center gap-2 px-4 py-2 text-xs tracking-wider uppercase bg-[hsl(40,30%,45%)] text-white hover:bg-[hsl(40,30%,40%)] transition-colors font-sans"
            >
              <FiPlus size={14} /> Add Card
            </button>
          </div>

          {/* Add / Edit Card Form */}
          {showAddCard && (
            <div className="border border-[hsl(30,10%,88%)] bg-white p-6 mb-6">
              <h4 className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-4">
                {editingCardId ? 'Edit Card' : 'New Card'}
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] mb-1 font-sans">Card Name</label>
                  <input
                    type="text"
                    value={cardForm.name}
                    onChange={(e) => setCardForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Chase Sapphire Preferred"
                    className="w-full border border-[hsl(30,10%,88%)] px-3 py-2 text-sm outline-none focus:border-[hsl(40,30%,45%)] bg-transparent font-sans"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] mb-1 font-sans">Issuer</label>
                    <input
                      type="text"
                      value={cardForm.issuer}
                      onChange={(e) => setCardForm(prev => ({ ...prev, issuer: e.target.value }))}
                      placeholder="Chase"
                      className="w-full border border-[hsl(30,10%,88%)] px-3 py-2 text-sm outline-none focus:border-[hsl(40,30%,45%)] bg-transparent font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] mb-1 font-sans">Annual Fee ($)</label>
                    <input
                      type="number"
                      value={cardForm.annualFee}
                      onChange={(e) => setCardForm(prev => ({ ...prev, annualFee: e.target.value }))}
                      placeholder="95"
                      className="w-full border border-[hsl(30,10%,88%)] px-3 py-2 text-sm outline-none focus:border-[hsl(40,30%,45%)] bg-transparent font-sans"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] mb-2 font-sans">Reward Categories</label>
                  {cardForm.rewardCategories.map((rc, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={rc.category}
                        onChange={(e) => updateRewardRow(idx, 'category', e.target.value)}
                        placeholder="Category (e.g. Dining)"
                        className="flex-1 border border-[hsl(30,10%,88%)] px-3 py-2 text-sm outline-none focus:border-[hsl(40,30%,45%)] bg-transparent font-sans"
                      />
                      <input
                        type="text"
                        value={rc.rate}
                        onChange={(e) => updateRewardRow(idx, 'rate', e.target.value)}
                        placeholder="Rate (e.g. 3x points)"
                        className="flex-1 border border-[hsl(30,10%,88%)] px-3 py-2 text-sm outline-none focus:border-[hsl(40,30%,45%)] bg-transparent font-sans"
                      />
                      {cardForm.rewardCategories.length > 1 && (
                        <button onClick={() => removeRewardRow(idx)} className="text-[hsl(0,50%,45%)] hover:text-[hsl(0,50%,35%)] px-2">
                          <FiX size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addRewardRow} className="text-xs text-[hsl(40,30%,45%)] hover:text-[hsl(40,30%,35%)] tracking-wider uppercase font-sans mt-1">
                    + Add Category
                  </button>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={editingCardId ? handleSaveEditCard : handleAddCard}
                    className="px-4 py-2 text-xs tracking-wider uppercase bg-[hsl(40,30%,45%)] text-white hover:bg-[hsl(40,30%,40%)] transition-colors font-sans"
                  >
                    {editingCardId ? 'Save Changes' : 'Add Card'}
                  </button>
                  <button
                    onClick={() => { setShowAddCard(false); setEditingCardId(null); resetCardForm() }}
                    className="px-4 py-2 text-xs tracking-wider uppercase border border-[hsl(30,10%,88%)] text-[hsl(30,5%,50%)] hover:bg-[hsl(30,10%,95%)] transition-colors font-sans"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Card List */}
          {cards.length === 0 ? (
            <div className="border border-dashed border-[hsl(30,10%,88%)] p-10 text-center">
              <FiCreditCard className="mx-auto mb-3 text-[hsl(30,5%,50%)]" size={28} />
              <p className="text-sm text-[hsl(30,5%,50%)] leading-relaxed font-sans">
                No credit cards added yet. Add your first card to get started with personalized optimization.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cards.map(card => (
                <div key={card.id} className="border border-[hsl(30,10%,88%)] bg-white p-6 group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-serif text-base font-normal">{card.name}</h4>
                      <p className="text-xs text-[hsl(30,5%,50%)] font-sans mt-1">{card.issuer}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditCard(card)} className="p-1.5 text-[hsl(30,5%,50%)] hover:text-[hsl(40,30%,45%)]">
                        <FiEdit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteCard(card.id)} className="p-1.5 text-[hsl(30,5%,50%)] hover:text-[hsl(0,50%,45%)]">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {Array.isArray(card.rewardCategories) && card.rewardCategories.map((rc, i) => (
                      <span key={i} className="px-2 py-1 text-xs bg-[hsl(30,10%,95%)] text-[hsl(30,5%,30%)] font-sans">
                        {rc.category}: {rc.rate}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-[hsl(30,5%,50%)] font-sans">
                    Annual fee: ${card.annualFee}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - My Expenses */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans font-medium">My Expenses</h3>
            <button
              onClick={() => setShowAddExpense(!showAddExpense)}
              className="flex items-center gap-2 px-4 py-2 text-xs tracking-wider uppercase bg-[hsl(40,30%,45%)] text-white hover:bg-[hsl(40,30%,40%)] transition-colors font-sans"
            >
              <FiPlus size={14} /> Add Expense
            </button>
          </div>

          {/* Add Expense Form */}
          {showAddExpense && (
            <div className="border border-[hsl(30,10%,88%)] bg-white p-6 mb-6">
              <h4 className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-4">New Expense</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] mb-1 font-sans">Category</label>
                  <select
                    value={expForm.category}
                    onChange={(e) => setExpForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full border border-[hsl(30,10%,88%)] px-3 py-2 text-sm outline-none focus:border-[hsl(40,30%,45%)] bg-transparent font-sans"
                  >
                    <option value="">Select category...</option>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] mb-1 font-sans">Monthly Amount ($)</label>
                  <input
                    type="number"
                    value={expForm.amount}
                    onChange={(e) => setExpForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="500"
                    className="w-full border border-[hsl(30,10%,88%)] px-3 py-2 text-sm outline-none focus:border-[hsl(40,30%,45%)] bg-transparent font-sans"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAddExpense}
                    className="px-4 py-2 text-xs tracking-wider uppercase bg-[hsl(40,30%,45%)] text-white hover:bg-[hsl(40,30%,40%)] transition-colors font-sans"
                  >
                    Add Expense
                  </button>
                  <button
                    onClick={() => setShowAddExpense(false)}
                    className="px-4 py-2 text-xs tracking-wider uppercase border border-[hsl(30,10%,88%)] text-[hsl(30,5%,50%)] hover:bg-[hsl(30,10%,95%)] transition-colors font-sans"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Expense Table */}
          {expenses.length === 0 ? (
            <div className="border border-dashed border-[hsl(30,10%,88%)] p-10 text-center">
              <FiDollarSign className="mx-auto mb-3 text-[hsl(30,5%,50%)]" size={28} />
              <p className="text-sm text-[hsl(30,5%,50%)] leading-relaxed font-sans">
                No expenses added. Track your monthly spending to receive optimization insights.
              </p>
            </div>
          ) : (
            <div className="border border-[hsl(30,10%,88%)] bg-white">
              <div className="grid grid-cols-3 px-6 py-3 border-b border-[hsl(30,10%,88%)] bg-[hsl(30,10%,95%)]">
                <span className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans font-medium">Category</span>
                <span className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans font-medium">Monthly Amount</span>
                <span className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans font-medium text-right">Actions</span>
              </div>
              {expenses.map(exp => (
                <div key={exp.id} className="grid grid-cols-3 px-6 py-4 border-b border-[hsl(30,10%,88%)] last:border-b-0 items-center group">
                  <span className="text-sm font-sans">{exp.category}</span>
                  {editingExpId === exp.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editExpAmount}
                        onChange={(e) => setEditExpAmount(e.target.value)}
                        className="w-24 border border-[hsl(30,10%,88%)] px-2 py-1 text-sm outline-none focus:border-[hsl(40,30%,45%)] bg-transparent font-sans"
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateExpense(exp.id)}
                      />
                      <button onClick={() => handleUpdateExpense(exp.id)} className="text-[hsl(40,30%,45%)]"><FiCheck size={14} /></button>
                      <button onClick={() => setEditingExpId(null)} className="text-[hsl(30,5%,50%)]"><FiX size={14} /></button>
                    </div>
                  ) : (
                    <span className="text-sm font-sans">${exp.amount.toLocaleString()}</span>
                  )}
                  <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingExpId(exp.id); setEditExpAmount(exp.amount.toString()) }}
                      className="p-1.5 text-[hsl(30,5%,50%)] hover:text-[hsl(40,30%,45%)]"
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 text-[hsl(30,5%,50%)] hover:text-[hsl(0,50%,45%)]">
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 px-6 py-3 bg-[hsl(30,10%,95%)]">
                <span className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans font-medium">Total</span>
                <span className="text-sm font-serif font-normal">${totalSpend.toLocaleString()}</span>
                <span />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- OPTIMIZE TAB ---

function OptimizeTab({ cards, expenses }: { cards: CreditCard[]; expenses: Expense[] }) {
  const [result, setResult] = useState<OptResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0)

  const handleOptimize = useCallback(async () => {
    if (cards.length === 0 || expenses.length === 0) return
    setLoading(true)
    setError(null)
    setActiveAgentId(AGENT_IDS.optimizer)

    const message = `Analyze my credit card portfolio and recommend the best card for each expense category.

My Cards:
${cards.map(c => `- ${c.name} (${c.issuer}): ${Array.isArray(c.rewardCategories) ? c.rewardCategories.map(r => `${r.category}: ${r.rate}`).join(', ') : 'No categories'}. Annual fee: $${c.annualFee}`).join('\n')}

My Monthly Expenses:
${expenses.map(e => `- ${e.category}: $${e.amount}`).join('\n')}

Total Monthly Spend: $${totalSpend}`

    try {
      const res = await callAIAgent(message, AGENT_IDS.optimizer)
      if (res.success) {
        const data = parseAgentResponse(res)
        setResult(data as OptResult)
        if (res.session_id) setSessionId(res.session_id)
      } else {
        setError(res?.error ?? 'Failed to optimize. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred.')
    }
    setLoading(false)
    setActiveAgentId(null)
  }, [cards, expenses, totalSpend])

  if (cards.length === 0 || expenses.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-serif font-light tracking-wider uppercase mb-2">Optimize</h2>
        <div className="border border-dashed border-[hsl(30,10%,88%)] p-12 text-center mt-8">
          <FiTrendingUp className="mx-auto mb-4 text-[hsl(30,5%,50%)]" size={32} />
          <p className="text-sm text-[hsl(30,5%,50%)] leading-relaxed font-sans mb-2">Add cards and expenses in the Dashboard first</p>
          <p className="text-xs text-[hsl(30,5%,50%)] font-sans">The optimizer needs your card portfolio and spending data to provide recommendations.</p>
        </div>
      </div>
    )
  }

  const recommendations = Array.isArray(result?.recommendations) ? result.recommendations : []

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-serif font-light tracking-wider uppercase mb-2">Optimize</h2>
        <p className="text-sm text-[hsl(30,5%,50%)] leading-relaxed font-sans">Get per-category card recommendations to maximize your rewards.</p>
      </div>

      {/* Expense Summary Bar */}
      <div className="border border-[hsl(30,10%,88%)] bg-white p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-1">Total Monthly Spend</p>
            <p className="text-xl font-serif font-light">${totalSpend.toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {expenses.slice(0, 5).map(e => (
              <span key={e.id} className="px-2 py-1 text-xs bg-[hsl(30,10%,95%)] text-[hsl(30,5%,30%)] font-sans">
                {e.category}: ${e.amount}
              </span>
            ))}
            {expenses.length > 5 && (
              <span className="px-2 py-1 text-xs text-[hsl(30,5%,50%)] font-sans">+{expenses.length - 5} more</span>
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleOptimize}
        disabled={loading}
        className="w-full py-4 text-sm tracking-wider uppercase bg-[hsl(40,30%,45%)] text-white hover:bg-[hsl(40,30%,40%)] disabled:opacity-50 transition-colors font-sans mb-8 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <FiRefreshCw className="animate-spin" size={16} />
            Analyzing your spending...
          </>
        ) : (
          <>
            <FiTrendingUp size={16} />
            Optimize My Spending
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="border border-[hsl(0,50%,45%)] bg-[hsl(0,50%,97%)] p-4 mb-6 flex items-start gap-3">
          <FiAlertCircle className="text-[hsl(0,50%,45%)] flex-shrink-0 mt-0.5" size={16} />
          <div>
            <p className="text-sm text-[hsl(0,50%,45%)] font-sans">{error}</p>
            <button onClick={handleOptimize} className="text-xs text-[hsl(40,30%,45%)] hover:underline mt-1 font-sans">Retry</button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && <SkeletonLoader />}

      {/* Results */}
      {!loading && result && (
        <div>
          {/* Total projected rewards */}
          {result?.total_projected_rewards && (
            <div className="border border-[hsl(40,30%,45%)] bg-[hsl(40,40%,97%)] p-6 mb-6">
              <p className="text-xs tracking-wider uppercase text-[hsl(40,30%,45%)] font-sans mb-1">Total Projected Rewards</p>
              <p className="text-2xl font-serif font-light text-[hsl(40,30%,35%)]">{result.total_projected_rewards}</p>
            </div>
          )}

          {/* Recommendations grid */}
          {recommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {recommendations.map((rec, i) => (
                <div key={i} className="border border-[hsl(30,10%,88%)] bg-white p-6">
                  <div className="flex items-start justify-between mb-3">
                    <span className="px-2 py-1 text-xs bg-[hsl(30,10%,95%)] text-[hsl(30,5%,30%)] font-sans tracking-wider uppercase">
                      {rec?.category ?? 'Category'}
                    </span>
                    <span className="text-xs text-[hsl(40,30%,45%)] font-sans font-medium">{rec?.reward_rate ?? ''}</span>
                  </div>
                  <h4 className="font-serif text-base font-normal mb-2">{rec?.recommended_card ?? 'Recommended Card'}</h4>
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs font-sans">
                      <span className="text-[hsl(30,5%,50%)]">Est. Monthly Points</span>
                      <span>{rec?.estimated_monthly_points ?? '--'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-sans">
                      <span className="text-[hsl(30,5%,50%)]">Improvement</span>
                      <span className="text-[hsl(40,30%,45%)]">{rec?.improvement_vs_current ?? '--'}</span>
                    </div>
                  </div>
                  {rec?.reasoning && (
                    <div>
                      <button
                        onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                        className="flex items-center gap-1 text-xs text-[hsl(40,30%,45%)] hover:text-[hsl(40,30%,35%)] font-sans"
                      >
                        {expandedIdx === i ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                        Reasoning
                      </button>
                      {expandedIdx === i && (
                        <div className="mt-2 text-xs text-[hsl(30,5%,40%)] leading-relaxed font-sans border-t border-[hsl(30,10%,88%)] pt-2">
                          {renderMarkdown(rec.reasoning)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {result?.summary && (
            <div className="border border-[hsl(30,10%,88%)] bg-white p-6 mb-6">
              <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-3">Analysis Summary</p>
              <div className="text-sm text-[hsl(30,5%,25%)] font-sans">{renderMarkdown(result.summary)}</div>
            </div>
          )}

          {/* Chat */}
          <ChatPanel agentId={AGENT_IDS.optimizer} agentName="Card Optimizer" sessionId={sessionId} />
        </div>
      )}
    </div>
  )
}

// --- ALTERNATIVES TAB ---

function AlternativesTab({ cards, expenses }: { cards: CreditCard[]; expenses: Expense[] }) {
  const [result, setResult] = useState<AltResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0)
  const totalFees = cards.reduce((s, c) => s + c.annualFee, 0)

  const handleFind = useCallback(async () => {
    if (cards.length === 0) return
    setLoading(true)
    setError(null)

    const message = `Based on my spending patterns and current card portfolio, find better credit card alternatives.

My Current Cards:
${cards.map(c => `- ${c.name} (${c.issuer}): ${Array.isArray(c.rewardCategories) ? c.rewardCategories.map(r => `${r.category}: ${r.rate}`).join(', ') : 'No categories'}. Annual fee: $${c.annualFee}`).join('\n')}

My Monthly Spending by Category:
${expenses.map(e => `- ${e.category}: $${e.amount}/month ($${e.amount * 12}/year)`).join('\n')}

Total Annual Spend: $${totalSpend * 12}
Total Annual Card Fees: $${totalFees}`

    try {
      const res = await callAIAgent(message, AGENT_IDS.alternatives)
      if (res.success) {
        const data = parseAgentResponse(res)
        setResult(data as AltResult)
        if (res.session_id) setSessionId(res.session_id)
      } else {
        setError(res?.error ?? 'Failed to find alternatives.')
      }
    } catch {
      setError('An unexpected error occurred.')
    }
    setLoading(false)
  }, [cards, expenses, totalSpend, totalFees])

  if (cards.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-serif font-light tracking-wider uppercase mb-2">Alternatives</h2>
        <div className="border border-dashed border-[hsl(30,10%,88%)] p-12 text-center mt-8">
          <FiLayers className="mx-auto mb-4 text-[hsl(30,5%,50%)]" size={32} />
          <p className="text-sm text-[hsl(30,5%,50%)] leading-relaxed font-sans mb-2">Add your current cards in the Dashboard first</p>
          <p className="text-xs text-[hsl(30,5%,50%)] font-sans">We need your existing portfolio to suggest better alternatives.</p>
        </div>
      </div>
    )
  }

  const alternatives = Array.isArray(result?.alternatives) ? result.alternatives : []

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-serif font-light tracking-wider uppercase mb-2">Alternatives</h2>
        <p className="text-sm text-[hsl(30,5%,50%)] leading-relaxed font-sans">Discover credit cards that could offer better value for your spending patterns.</p>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-[hsl(30,10%,88%)] bg-white p-6">
          <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-1">Total Annual Fees</p>
          <p className="text-xl font-serif font-light">${totalFees.toLocaleString()}</p>
        </div>
        <div className="border border-[hsl(30,10%,88%)] bg-white p-6">
          <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-1">Annual Spend</p>
          <p className="text-xl font-serif font-light">${(totalSpend * 12).toLocaleString()}</p>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleFind}
        disabled={loading}
        className="w-full py-4 text-sm tracking-wider uppercase bg-[hsl(40,30%,45%)] text-white hover:bg-[hsl(40,30%,40%)] disabled:opacity-50 transition-colors font-sans mb-8 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <FiRefreshCw className="animate-spin" size={16} />
            Searching for alternatives...
          </>
        ) : (
          <>
            <FiLayers size={16} />
            Find Better Cards
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="border border-[hsl(0,50%,45%)] bg-[hsl(0,50%,97%)] p-4 mb-6 flex items-start gap-3">
          <FiAlertCircle className="text-[hsl(0,50%,45%)] flex-shrink-0 mt-0.5" size={16} />
          <div>
            <p className="text-sm text-[hsl(0,50%,45%)] font-sans">{error}</p>
            <button onClick={handleFind} className="text-xs text-[hsl(40,30%,45%)] hover:underline mt-1 font-sans">Retry</button>
          </div>
        </div>
      )}

      {loading && <SkeletonLoader />}

      {!loading && result && (
        <div>
          {/* Portfolio summary text */}
          {result?.current_portfolio_summary && (
            <div className="border border-[hsl(30,10%,88%)] bg-white p-6 mb-6">
              <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-3">Current Portfolio Summary</p>
              <div className="text-sm text-[hsl(30,5%,25%)] font-sans">{renderMarkdown(result.current_portfolio_summary)}</div>
            </div>
          )}

          {/* Alternatives cards */}
          {alternatives.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {alternatives.map((alt, i) => (
                <div key={i} className="border border-[hsl(30,10%,88%)] bg-white p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-serif text-base font-normal">{alt?.card_name ?? 'Card'}</h4>
                      <p className="text-xs text-[hsl(30,5%,50%)] font-sans mt-0.5">{alt?.issuer ?? ''}</p>
                    </div>
                    {alt?.best_for && (
                      <span className="px-2 py-1 text-xs bg-[hsl(40,40%,95%)] text-[hsl(40,30%,35%)] font-sans tracking-wider uppercase border border-[hsl(40,30%,80%)]">
                        {alt.best_for}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-xs font-sans">
                      <span className="text-[hsl(30,5%,50%)]">Annual Fee</span>
                      <span>{alt?.annual_fee ?? '--'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-sans">
                      <span className="text-[hsl(30,5%,50%)]">Key Reward Rates</span>
                      <span className="text-right max-w-[60%]">{alt?.key_reward_rates ?? '--'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-sans">
                      <span className="text-[hsl(30,5%,50%)]">Est. Annual Rewards</span>
                      <span className="text-[hsl(40,30%,45%)]">{alt?.estimated_annual_rewards ?? '--'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-sans">
                      <span className="text-[hsl(30,5%,50%)]">Net Value vs Current</span>
                      <span>{alt?.net_value_comparison ?? '--'}</span>
                    </div>
                  </div>
                  {alt?.why_this_card && (
                    <div>
                      <button
                        onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                        className="flex items-center gap-1 text-xs text-[hsl(40,30%,45%)] hover:text-[hsl(40,30%,35%)] font-sans"
                      >
                        {expandedIdx === i ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                        Why this card
                      </button>
                      {expandedIdx === i && (
                        <div className="mt-2 text-xs text-[hsl(30,5%,40%)] leading-relaxed font-sans border-t border-[hsl(30,10%,88%)] pt-2">
                          {renderMarkdown(alt.why_this_card)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {result?.summary && (
            <div className="border border-[hsl(30,10%,88%)] bg-white p-6 mb-6">
              <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-3">Summary</p>
              <div className="text-sm text-[hsl(30,5%,25%)] font-sans">{renderMarkdown(result.summary)}</div>
            </div>
          )}

          <ChatPanel agentId={AGENT_IDS.alternatives} agentName="Card Alternatives" sessionId={sessionId} />
        </div>
      )}
    </div>
  )
}

// --- REWARDS TAB ---

function RewardsTab({ cards, setCards }: { cards: CreditCard[]; setCards: React.Dispatch<React.SetStateAction<CreditCard[]>> }) {
  const [result, setResult] = useState<RewardsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null)
  const [balanceInput, setBalanceInput] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const totalPoints = cards.reduce((s, c) => s + c.pointsBalance, 0)

  const handleUpdateBalance = (cardId: string) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, pointsBalance: parseInt(balanceInput) || 0 } : c))
    setEditingBalanceId(null)
    setBalanceInput('')
  }

  const handleOptimize = useCallback(async () => {
    if (cards.length === 0) return
    setLoading(true)
    setError(null)

    const message = `Analyze my rewards balances and recommend optimal redemption strategies.

My Cards and Points:
${cards.map(c => `- ${c.name} (${c.issuer}): ${c.pointsBalance || 0} points`).join('\n')}

Total Points: ${totalPoints}`

    try {
      const res = await callAIAgent(message, AGENT_IDS.rewards)
      if (res.success) {
        const data = parseAgentResponse(res)
        setResult(data as RewardsResult)
        if (res.session_id) setSessionId(res.session_id)
      } else {
        setError(res?.error ?? 'Failed to analyze rewards.')
      }
    } catch {
      setError('An unexpected error occurred.')
    }
    setLoading(false)
  }, [cards, totalPoints])

  if (cards.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-serif font-light tracking-wider uppercase mb-2">Rewards</h2>
        <div className="border border-dashed border-[hsl(30,10%,88%)] p-12 text-center mt-8">
          <FiAward className="mx-auto mb-4 text-[hsl(30,5%,50%)]" size={32} />
          <p className="text-sm text-[hsl(30,5%,50%)] leading-relaxed font-sans mb-2">Add your cards in the Dashboard first</p>
          <p className="text-xs text-[hsl(30,5%,50%)] font-sans">Then enter your points balances here for redemption optimization.</p>
        </div>
      </div>
    )
  }

  const strategies = Array.isArray(result?.strategies) ? result.strategies : []
  const FILTER_TYPES = ['All', 'Travel', 'Cashback', 'Gift Cards', 'Transfers']

  const filteredStrategies = filterType === 'All'
    ? strategies
    : strategies.filter(s => (s?.redemption_type ?? '').toLowerCase().includes(filterType.toLowerCase()))

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-serif font-light tracking-wider uppercase mb-2">Rewards</h2>
        <p className="text-sm text-[hsl(30,5%,50%)] leading-relaxed font-sans">Track your points balances and discover the highest-value redemption paths.</p>
      </div>

      {/* Points Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map(card => (
          <div key={card.id} className="border border-[hsl(30,10%,88%)] bg-white p-6">
            <h4 className="font-serif text-sm font-normal mb-1">{card.name}</h4>
            <p className="text-xs text-[hsl(30,5%,50%)] font-sans mb-3">{card.issuer}</p>
            {editingBalanceId === card.id ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  className="w-full border border-[hsl(30,10%,88%)] px-2 py-1 text-sm outline-none focus:border-[hsl(40,30%,45%)] bg-transparent font-sans"
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateBalance(card.id)}
                  placeholder="Enter points"
                />
                <button onClick={() => handleUpdateBalance(card.id)} className="text-[hsl(40,30%,45%)]"><FiCheck size={14} /></button>
                <button onClick={() => setEditingBalanceId(null)} className="text-[hsl(30,5%,50%)]"><FiX size={14} /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-lg font-serif font-light">{card.pointsBalance.toLocaleString()} <span className="text-xs text-[hsl(30,5%,50%)] font-sans">pts</span></p>
                <button
                  onClick={() => { setEditingBalanceId(card.id); setBalanceInput(card.pointsBalance.toString()) }}
                  className="p-1.5 text-[hsl(30,5%,50%)] hover:text-[hsl(40,30%,45%)]"
                >
                  <FiEdit2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Total Points */}
      <div className="border border-[hsl(40,30%,45%)] bg-[hsl(40,40%,97%)] p-6 mb-6">
        <p className="text-xs tracking-wider uppercase text-[hsl(40,30%,45%)] font-sans mb-1">Total Portfolio Points</p>
        <p className="text-2xl font-serif font-light text-[hsl(40,30%,35%)]">{totalPoints.toLocaleString()}</p>
      </div>

      {/* CTA */}
      <button
        onClick={handleOptimize}
        disabled={loading}
        className="w-full py-4 text-sm tracking-wider uppercase bg-[hsl(40,30%,45%)] text-white hover:bg-[hsl(40,30%,40%)] disabled:opacity-50 transition-colors font-sans mb-8 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <FiRefreshCw className="animate-spin" size={16} />
            Analyzing redemption options...
          </>
        ) : (
          <>
            <FiAward size={16} />
            Optimize Rewards
          </>
        )}
      </button>

      {error && (
        <div className="border border-[hsl(0,50%,45%)] bg-[hsl(0,50%,97%)] p-4 mb-6 flex items-start gap-3">
          <FiAlertCircle className="text-[hsl(0,50%,45%)] flex-shrink-0 mt-0.5" size={16} />
          <div>
            <p className="text-sm text-[hsl(0,50%,45%)] font-sans">{error}</p>
            <button onClick={handleOptimize} className="text-xs text-[hsl(40,30%,45%)] hover:underline mt-1 font-sans">Retry</button>
          </div>
        </div>
      )}

      {loading && <SkeletonLoader />}

      {!loading && result && (
        <div>
          {/* Total Portfolio Value */}
          {result?.total_portfolio_value && (
            <div className="border border-[hsl(30,10%,88%)] bg-white p-6 mb-6">
              <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-1">Total Portfolio Value</p>
              <p className="text-xl font-serif font-light">{result.total_portfolio_value}</p>
            </div>
          )}

          {/* Filter Buttons */}
          {strategies.length > 0 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              {FILTER_TYPES.map(ft => (
                <button
                  key={ft}
                  onClick={() => setFilterType(ft)}
                  className={`px-3 py-1.5 text-xs tracking-wider uppercase font-sans transition-colors border ${filterType === ft ? 'bg-[hsl(40,30%,45%)] text-white border-[hsl(40,30%,45%)]' : 'bg-white text-[hsl(30,5%,50%)] border-[hsl(30,10%,88%)] hover:border-[hsl(40,30%,45%)]'}`}
                >
                  {ft}
                </button>
              ))}
            </div>
          )}

          {/* Strategy Cards */}
          {filteredStrategies.length > 0 && (
            <div className="space-y-4 mb-6">
              {filteredStrategies.map((strat, i) => (
                <div key={i} className="border border-[hsl(30,10%,88%)] bg-white p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-serif text-base font-normal">{strat?.card_name ?? 'Card'}</h4>
                      <p className="text-xs text-[hsl(30,5%,50%)] font-sans mt-0.5">{strat?.redemption_option ?? ''}</p>
                    </div>
                    {strat?.recommendation_badge && (
                      <span className="px-2 py-1 text-xs bg-[hsl(40,40%,95%)] text-[hsl(40,30%,35%)] font-sans tracking-wider uppercase border border-[hsl(40,30%,80%)]">
                        {strat.recommendation_badge}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-[hsl(30,5%,50%)] font-sans mb-0.5">Balance</p>
                      <p className="text-sm font-sans">{strat?.current_balance ?? '--'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(30,5%,50%)] font-sans mb-0.5">Type</p>
                      <p className="text-sm font-sans">{strat?.redemption_type ?? '--'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(30,5%,50%)] font-sans mb-0.5">Value/Point</p>
                      <p className="text-sm font-sans text-[hsl(40,30%,45%)]">{strat?.estimated_value_per_point ?? '--'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[hsl(30,5%,50%)] font-sans mb-0.5">Total Value</p>
                      <p className="text-sm font-serif font-normal">{strat?.total_estimated_value ?? '--'}</p>
                    </div>
                  </div>
                  {strat?.details && (
                    <div>
                      <button
                        onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                        className="flex items-center gap-1 text-xs text-[hsl(40,30%,45%)] hover:text-[hsl(40,30%,35%)] font-sans"
                      >
                        {expandedIdx === i ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                        Details
                      </button>
                      {expandedIdx === i && (
                        <div className="mt-2 text-xs text-[hsl(30,5%,40%)] leading-relaxed font-sans border-t border-[hsl(30,10%,88%)] pt-2">
                          {renderMarkdown(strat.details)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {filteredStrategies.length === 0 && strategies.length > 0 && (
            <div className="border border-dashed border-[hsl(30,10%,88%)] p-8 text-center mb-6">
              <p className="text-sm text-[hsl(30,5%,50%)] font-sans">No strategies match the "{filterType}" filter.</p>
            </div>
          )}

          {/* Summary */}
          {result?.summary && (
            <div className="border border-[hsl(30,10%,88%)] bg-white p-6 mb-6">
              <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-3">Strategy Summary</p>
              <div className="text-sm text-[hsl(30,5%,25%)] font-sans">{renderMarkdown(result.summary)}</div>
            </div>
          )}

          <ChatPanel agentId={AGENT_IDS.rewards} agentName="Rewards Strategist" sessionId={sessionId} />
        </div>
      )}
    </div>
  )
}

// --- SIDEBAR ITEM ---

function SidebarItem({ icon, label, active, onClick }: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left text-sm tracking-wider font-sans transition-colors ${active ? 'bg-[hsl(30,8%,93%)] text-[hsl(40,30%,45%)] border-l-2 border-[hsl(40,30%,45%)]' : 'text-[hsl(30,5%,40%)] hover:bg-[hsl(30,8%,95%)] hover:text-[hsl(30,5%,15%)] border-l-2 border-transparent'}`}
    >
      {icon}
      <span className="uppercase">{label}</span>
    </button>
  )
}

// --- MAIN PAGE ---

export default function Page() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'optimize' | 'alternatives' | 'rewards'>('dashboard')
  const [cards, setCards] = useState<CreditCard[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [sampleMode, setSampleMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const savedCards = localStorage.getItem('cardwise_cards')
      const savedExpenses = localStorage.getItem('cardwise_expenses')
      if (savedCards) setCards(JSON.parse(savedCards))
      if (savedExpenses) setExpenses(JSON.parse(savedExpenses))
    } catch { /* ignore */ }
  }, [])

  // Persist to localStorage
  useEffect(() => {
    if (!mounted) return
    try { localStorage.setItem('cardwise_cards', JSON.stringify(cards)) } catch { /* ignore */ }
  }, [cards, mounted])

  useEffect(() => {
    if (!mounted) return
    try { localStorage.setItem('cardwise_expenses', JSON.stringify(expenses)) } catch { /* ignore */ }
  }, [expenses, mounted])

  // Sample mode toggle
  useEffect(() => {
    if (sampleMode) {
      setCards(SAMPLE_CARDS)
      setExpenses(SAMPLE_EXPENSES)
    } else if (mounted) {
      try {
        const savedCards = localStorage.getItem('cardwise_cards')
        const savedExpenses = localStorage.getItem('cardwise_expenses')
        setCards(savedCards ? JSON.parse(savedCards) : [])
        setExpenses(savedExpenses ? JSON.parse(savedExpenses) : [])
      } catch {
        setCards([])
        setExpenses([])
      }
    }
  }, [sampleMode, mounted])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[hsl(0,0%,99%)] text-[hsl(30,5%,15%)] flex">
        {/* Sidebar */}
        <aside className="w-[260px] min-h-screen bg-[hsl(30,8%,97%)] border-r border-[hsl(30,10%,90%)] flex flex-col flex-shrink-0">
          {/* Logo */}
          <div className="px-6 py-8 border-b border-[hsl(30,10%,90%)]">
            <h1 className="text-xl font-serif font-light tracking-wider">CardWise</h1>
            <p className="text-xs text-[hsl(30,5%,50%)] tracking-wider uppercase mt-1 font-sans">Smart Credit Card Optimizer</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4">
            <SidebarItem
              icon={<FiGrid size={16} />}
              label="Dashboard"
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
            />
            <SidebarItem
              icon={<FiTrendingUp size={16} />}
              label="Optimize"
              active={activeTab === 'optimize'}
              onClick={() => setActiveTab('optimize')}
            />
            <SidebarItem
              icon={<FiLayers size={16} />}
              label="Alternatives"
              active={activeTab === 'alternatives'}
              onClick={() => setActiveTab('alternatives')}
            />
            <SidebarItem
              icon={<FiAward size={16} />}
              label="Rewards"
              active={activeTab === 'rewards'}
              onClick={() => setActiveTab('rewards')}
            />
          </nav>

          {/* Sample Data Toggle */}
          <div className="px-5 py-4 border-t border-[hsl(30,10%,90%)]">
            <div className="flex items-center justify-between">
              <span className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans">Sample Data</span>
              <button
                onClick={() => setSampleMode(!sampleMode)}
                className={`relative w-10 h-5 rounded-full transition-colors ${sampleMode ? 'bg-[hsl(40,30%,45%)]' : 'bg-[hsl(30,8%,85%)]'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${sampleMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Agent Status */}
          <div className="px-5 py-4 border-t border-[hsl(30,10%,90%)]">
            <p className="text-xs tracking-wider uppercase text-[hsl(30,5%,50%)] font-sans mb-3">Powered By</p>
            <div className="space-y-2">
              {AGENTS_INFO.map(agent => (
                <div key={agent.id} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(140,40%,50%)] flex-shrink-0" />
                  <div>
                    <p className="text-xs font-sans text-[hsl(30,5%,25%)]">{agent.name}</p>
                    <p className="text-[10px] text-[hsl(30,5%,60%)] font-sans">{agent.purpose}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen overflow-y-auto">
          <div className="max-w-5xl mx-auto px-10 py-10">
            {activeTab === 'dashboard' && (
              <DashboardTab
                cards={cards}
                setCards={setCards}
                expenses={expenses}
                setExpenses={setExpenses}
                sampleMode={sampleMode}
              />
            )}
            {activeTab === 'optimize' && (
              <OptimizeTab cards={cards} expenses={expenses} />
            )}
            {activeTab === 'alternatives' && (
              <AlternativesTab cards={cards} expenses={expenses} />
            )}
            {activeTab === 'rewards' && (
              <RewardsTab cards={cards} setCards={setCards} />
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
