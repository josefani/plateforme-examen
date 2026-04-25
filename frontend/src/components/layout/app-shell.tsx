import { useState, useEffect, type PropsWithChildren } from 'react'
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
  X,
} from 'lucide-react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  const { user, clearSession } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const sidebarContent = (
    <>
      <div className="border-b border-slate-200/70 px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <Link to={role === 'admin' ? '/admin/dashboard' : '/student/exams'} className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-slate-900 p-3 text-white">
              <ShieldCheck size={22} />
            </div>
            <div className={collapsed ? 'hidden lg:hidden' : 'min-w-0'}>
              <p className="text-xs font-semibold uppercase text-sky-700">
                Examens en ligne
              </p>
              <p className="truncate text-lg font-semibold text-slate-900">Plateforme d'examen</p>
            </div>
          </Link>
          {/* Close button for mobile */}
          <button
            type="button"
            className="btn btn-square btn-sm btn-ghost lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
          {/* Collapse button for desktop */}
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
    </>
  )

  return (
    <div className="grid-shell min-h-screen px-3 py-3 lg:px-5">
      {/* Mobile top bar */}
      <div className="app-surface mb-3 flex items-center justify-between px-4 py-3 lg:hidden">
        <Link to={role === 'admin' ? '/admin/dashboard' : '/student/exams'} className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-900 p-2.5 text-white">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-sky-700">Examens en ligne</p>
            <p className="text-sm font-semibold text-slate-900">Plateforme d'examen</p>
          </div>
        </Link>
        <button
          type="button"
          className="btn btn-square btn-sm btn-ghost"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          {/* Sidebar drawer */}
          <aside
            className="absolute inset-y-0 left-0 flex w-[300px] max-w-[85vw] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-2xl"
            style={{ animation: 'slideInLeft 0.25s ease-out' }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      <div
        className={`mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1600px] gap-4 ${
          collapsed ? 'lg:grid-cols-[88px_minmax(0,1fr)]' : 'lg:grid-cols-[280px_minmax(0,1fr)]'
        }`}
      >
        {/* Desktop sidebar */}
        <aside className="app-surface sticky top-3 z-30 hidden max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden lg:flex">
          {sidebarContent}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <header className="app-surface hidden flex-col gap-3 px-5 py-4 lg:flex lg:flex-row lg:items-center lg:justify-between">
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

      {/* CSS animation for mobile drawer */}
      <style>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
