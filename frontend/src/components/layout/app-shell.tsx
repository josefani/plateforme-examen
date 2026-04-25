import { useState, type PropsWithChildren } from 'react'
import {
  BookCheck,
  BookOpen,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth-store'
import type { Role } from '../../types/api'

interface AppShellProps extends PropsWithChildren {
  role: Role
}

const navItems = {
  admin: [
    { to: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { to: '/admin/students', label: 'Étudiants', icon: GraduationCap },
    { to: '/admin/groups', label: 'Groupes', icon: Users },
    { to: '/admin/questions', label: 'Banque de questions', icon: BookOpen },
    { to: '/admin/exams', label: 'Examens', icon: ScrollText },
    { to: '/admin/assignments', label: 'Affectations', icon: ListChecks },
    { to: '/admin/grading', label: 'Correction manuelle', icon: ClipboardCheck },
    { to: '/admin/results', label: 'Résultats', icon: FileSpreadsheet },
  ],
  student: [
    { to: '/student/exams', label: 'Mes examens', icon: BookCheck },
    { to: '/student/results', label: 'Mes résultats', icon: FileSpreadsheet },
  ],
}

export function AppShell({ role, children }: AppShellProps) {
  const navigate = useNavigate()
  const { user, clearSession } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="grid-shell min-h-screen px-3 py-3 lg:px-5">
      <div
        className={`mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1600px] gap-4 ${
          collapsed ? 'lg:grid-cols-[88px_minmax(0,1fr)]' : 'lg:grid-cols-[280px_minmax(0,1fr)]'
        }`}
      >
        <aside className="app-surface sticky top-3 z-30 flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden">
          <div className="border-b border-slate-200/70 px-6 py-6">
            <div className="flex items-center justify-between gap-3">
            <Link to={role === 'admin' ? '/admin/dashboard' : '/student/exams'} className="flex min-w-0 items-center gap-3">
              <div className="rounded-lg bg-slate-900 p-3 text-white">
                <ShieldCheck size={22} />
              </div>
              <div className={collapsed ? 'hidden' : 'min-w-0'}>
                <p className="text-xs font-semibold uppercase text-sky-700">
                  Examens en ligne
                </p>
                <p className="truncate text-lg font-semibold text-slate-900">Plateforme d'examen</p>
              </div>
            </Link>
              <button
                type="button"
                className="btn btn-square btn-sm btn-ghost hidden lg:inline-flex"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? 'Déployer le menu' : 'Réduire le menu'}
              >
                <Menu size={18} />
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
            {navItems[role].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <item.icon size={18} className="shrink-0" />
                <span className={collapsed ? 'hidden' : 'truncate'}>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-slate-200/70 px-3 py-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className={collapsed ? 'hidden' : 'text-xs uppercase text-slate-400'}>Session</p>
              <p className={collapsed ? 'hidden' : 'mt-2 truncate text-sm font-semibold text-slate-900'}>{user?.full_name}</p>
              <p className={collapsed ? 'hidden' : 'truncate text-xs text-slate-500'}>{user?.email}</p>
              <button
                type="button"
                className={`btn btn-sm btn-outline ${collapsed ? 'btn-square mt-0' : 'mt-4 w-full'}`}
                onClick={() => {
                  clearSession()
                  navigate('/login')
                }}
                aria-label="Se déconnecter"
              >
                {collapsed ? <LogOut size={16} /> : 'Se déconnecter'}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <header className="app-surface flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                {role === 'admin' ? 'Espace formateur' : 'Espace étudiant'}
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                {role === 'admin' ? 'Pilotage des examens' : 'Passage des examens'}
              </h2>
            </div>
            <div className="rounded-lg bg-slate-900 px-4 py-3 text-white">
              <p className="text-xs uppercase text-slate-300">Rôle</p>
              <p className="text-sm font-semibold">{role === 'admin' ? 'Administrateur' : 'Étudiant'}</p>
            </div>
          </header>

          <main className="min-w-0 space-y-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
