import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsAdmin } from '../../hooks/useRole'
import { useAuthStore } from '../../store/authStore'
import {
  Plus, Trash2, RefreshCw, Users, Shield,
  ShoppingBag, AlertCircle, UserCheck
} from 'lucide-react'
import LoadingSpinner from '../shared/LoadingSpinner'
import ConfirmDialog from '../shared/ConfirmDialog'
import Modal from '../shared/Modal'
import toast from 'react-hot-toast'

// ─── Types ─────────────────────────────────────────────────────────────────
interface Employee {
  id: string
  auth_user_id: string
  name: string | null
  email: string | null
  role: 'admin' | 'cashier'
  is_active: boolean
  created_at: string
}

interface UsageLimits {
  admins: number
  max_admins: number
  cashiers: number
  max_cashiers: number
  admin_full: boolean
  cashier_full: boolean
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const roleBadge = (role: string) =>
  role === 'admin'
    ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
    : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'

const UsageBar = ({
  label, current, max, icon: Icon,
}: {
  label: string; current: number; max: number; icon: any
}) => {
  const unlimited = max === -1
  const pct       = unlimited ? 0 : Math.min((current / max) * 100, 100)
  const full      = !unlimited && current >= max
  return (
    <div className="card p-4 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${full ? 'text-red-400' : 'text-slate-400'}`} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        </div>
        <span className={`text-sm font-mono font-bold ${full ? 'text-red-400' : 'text-slate-900 dark:text-white'}`}>
          {current} / {unlimited ? '∞' : max}
        </span>
      </div>
      {!unlimited && (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${full ? 'bg-red-400' : 'bg-primary-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {full && (
        <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Limit reached — upgrade your plan
        </p>
      )}
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const isAdmin = useIsAdmin()

  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [usage,        setUsage]        = useState<UsageLimits | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [saving,       setSaving]       = useState(false)

  // ── Form state ────────────────────────────────────────────────────────
  const emptyForm = { name: '', email: '', password: '', role: 'cashier' as 'admin' | 'cashier' }
  const [form, setForm] = useState(emptyForm)

  // ── Load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const user = useAuthStore.getState().user
      if (!user?.business_id) throw new Error('Not authenticated')

      const [profilesRes, usageRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('business_id', user.business_id)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),

        supabase.rpc('get_business_user_usage', {
          p_business_id: user.business_id,
        }),
      ])

      if (profilesRes.error) throw new Error(profilesRes.error.message)
      if (usageRes.error)    throw new Error(usageRes.error.message)

      setEmployees(profilesRes.data || [])
      setUsage(usageRes.data as UsageLimits)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived limit checks ──────────────────────────────────────────────
  const canAddAdmin   = !usage?.admin_full
  const canAddCashier = !usage?.cashier_full
  const canAddRole    = form.role === 'admin' ? canAddAdmin : canAddCashier
  const bothFull      = usage?.admin_full && usage?.cashier_full

  // ── Add employee ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim())            { toast.error('Name is required'); return }
    if (!form.email.trim())           { toast.error('Email is required'); return }
    if (form.password.length < 6)     { toast.error('Password must be at least 6 characters'); return }
    if (!canAddRole) {
      toast.error(`${form.role === 'admin' ? 'Admin' : 'Cashier'} limit reached. Upgrade your plan.`)
      return
    }

    setSaving(true)
    try {
      const user = useAuthStore.getState().user
      if (!user?.business_id) throw new Error('Not authenticated')

      // Step 1 — Create auth user via Supabase Admin API
      // Note: This requires a Supabase Edge Function or service role key.
      // For now we use signUp (user gets a confirmation email).
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        options:  { data: { full_name: form.name.trim() } },
      })

      if (authError) throw new Error(authError.message)
      if (!authData.user) throw new Error('Failed to create auth user')

      // Step 2 — Create user_profile (trigger will enforce limits + sync to users table)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          auth_user_id: authData.user.id,
          business_id:  user.business_id,
          role:         form.role,
          name:         form.name.trim(),
          email:        form.email.trim().toLowerCase(),
        })

      if (profileError) {
        // Trigger threw a limit error — surface it clearly
        throw new Error(profileError.message)
      }

      toast.success(`${form.role === 'admin' ? 'Admin' : 'Cashier'} added successfully!`)
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to add employee')
    } finally {
      setSaving(false)
    }
  }

  // ── Change role ───────────────────────────────────────────────────────
  const handleRoleChange = async (employee: Employee, newRole: 'admin' | 'cashier') => {
    // Check limits before allowing role change
    if (newRole === 'admin' && usage?.admin_full) {
      toast.error('Admin limit reached. Upgrade your plan.')
      return
    }
    if (newRole === 'cashier' && usage?.cashier_full) {
      toast.error('Cashier limit reached. Upgrade your plan.')
      return
    }
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', employee.id)
      if (error) throw new Error(error.message)
      toast.success('Role updated')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role')
    }
  }

  // ── Soft delete ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // Soft delete — set is_active = false, preserves all historical data
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', deleteTarget.id)
      if (error) throw new Error(error.message)
      toast.success('Employee deactivated')
      setDeleteTarget(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to deactivate employee')
    } finally {
      setDeleting(false)
    }
  }

  // ── Access guard ──────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
        <Shield className="w-12 h-12 opacity-20" />
        <p className="font-medium">Access restricted to admins only</p>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Heading ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Employees</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
            Manage your team and access levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary p-2" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            disabled={!!bothFull}
            title={bothFull ? 'All user limits reached. Upgrade your plan.' : 'Add employee'}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Employee</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* ── Usage cards ── */}
      {usage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UsageBar
            label="Admins"
            current={usage.admins}
            max={usage.max_admins}
            icon={Shield}
          />
          <UsageBar
            label="Cashiers"
            current={usage.cashiers}
            max={usage.max_cashiers}
            icon={ShoppingBag}
          />
        </div>
      )}

      {bothFull && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>All user limits reached. Contact support to upgrade your plan.</span>
        </div>
      )}

      {/* ── Employee table ── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner text="Loading employees…" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-800/40">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap hidden sm:table-cell">Added</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-14 text-slate-500 text-sm">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      No employees yet — add your first team member
                    </td>
                  </tr>
                ) : employees.map(emp => (
                  <tr key={emp.id}
                    className="border-b border-slate-200 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary-400">
                            {(emp.name ?? emp.email ?? '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                          {emp.name ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 truncate max-w-[160px]">
                      {emp.email ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {/* Role change dropdown — inline */}
                      <select
                        value={emp.role}
                        onChange={e => handleRoleChange(emp, e.target.value as 'admin' | 'cashier')}
                        className={`badge text-xs capitalize border rounded-lg px-2 py-1 cursor-pointer bg-transparent ${roleBadge(emp.role)}`}
                      >
                        <option value="cashier">cashier</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap hidden sm:table-cell">
                      {new Date(emp.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setDeleteTarget(emp)}
                        title="Deactivate employee"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Add Employee Modal
      ══════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setForm(emptyForm) }}
        title="Add Employee" size="md">
        <div className="space-y-4">

          {/* Role selector at top so limit warning is immediate */}
          <div>
            <label className="label">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(['cashier', 'admin'] as const).map(r => {
                const full = r === 'admin' ? usage?.admin_full : usage?.cashier_full
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={!!full}
                    onClick={() => setForm(f => ({ ...f, role: r }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all capitalize
                      ${form.role === r
                        ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }
                      ${full ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {r === 'admin'
                      ? <Shield className="w-4 h-4" />
                      : <ShoppingBag className="w-4 h-4" />
                    }
                    {r}
                    {full && <span className="ml-auto text-xs text-red-400">Full</span>}
                  </button>
                )
              })}
            </div>
            {!canAddRole && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {form.role === 'admin' ? 'Admin' : 'Cashier'} limit reached. Upgrade your plan.
              </p>
            )}
          </div>

          <div>
            <label className="label">Full Name *</label>
            <input className="input" placeholder="John Doe"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" placeholder="john@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          <div>
            <label className="label">Temporary Password *</label>
            <input className="input" type="password" placeholder="Min. 6 characters"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <p className="text-xs text-slate-500 mt-1">
              Employee can change this after first login
            </p>
          </div>

          {/* Usage reminder */}
          {usage && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-xs text-slate-500 space-y-1">
              <p className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                Admins: {usage.admins} / {usage.max_admins === -1 ? '∞' : usage.max_admins}
                &nbsp;·&nbsp;
                Cashiers: {usage.cashiers} / {usage.max_cashiers === -1 ? '∞' : usage.max_cashiers}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => { setShowForm(false); setForm(emptyForm) }}
              className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !canAddRole}
              className="btn-primary flex items-center gap-2 disabled:opacity-60">
              {saving
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Adding…</>
                : <><Plus className="w-4 h-4" /> Add Employee</>
              }
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Deactivate confirm ── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate Employee"
        message={`Deactivate "${deleteTarget?.name ?? deleteTarget?.email}"? They will lose access immediately. You can reactivate them later.`}
        confirmLabel="Deactivate"
        danger
        loading={deleting}
      />
    </div>
  )
}
