import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ShieldCheck, UserPlus } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/auth-store'

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
})

const registerSchema = loginSchema.extend({
  full_name: z.string().min(2, 'Nom trop court'),
})

type LoginFormValues = z.infer<typeof loginSchema>
type RegisterFormValues = z.infer<typeof registerSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const { user, setSession } = useAuthStore()

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@exam.local',
      password: 'Admin1234!',
    },
  })

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
    },
  })

  const redirectAfterAuth = (role: 'admin' | 'student') => {
    const redirectTarget =
      typeof location.state === 'object' &&
      location.state !== null &&
      'from' in location.state &&
      typeof location.state.from === 'object' &&
      location.state.from !== null &&
      'pathname' in location.state.from
        ? String(location.state.from.pathname)
        : role === 'admin'
          ? '/admin/dashboard'
          : '/student/exams'

    navigate(redirectTarget, { replace: true })
  }

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (payload) => {
      setSession({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        user: payload.user,
      })
      redirectAfterAuth(payload.user.role)
    },
  })

  const registerMutation = useMutation({
    mutationFn: api.registerStudent,
    onSuccess: (payload) => {
      setSession({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        user: payload.user,
      })
      navigate('/student/exams', { replace: true })
    },
  })

  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/student/exams', {
        replace: true,
      })
    }
  }, [navigate, user])

  return (
    <div className="grid-shell flex min-h-screen items-center justify-center px-4 py-8">
      <section className="app-surface w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-900 p-3 text-white">
            {mode === 'login' ? <ShieldCheck size={20} /> : <UserPlus size={20} />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-sky-700">Plateforme d'examen</p>
            <h1 className="text-2xl font-semibold text-slate-950">
              {mode === 'login' ? 'Connexion' : 'Inscription étudiant'}
            </h1>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium ${mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setMode('login')}
          >
            Connexion
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium ${mode === 'register' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setMode('register')}
          >
            Inscription
          </button>
        </div>

        {mode === 'login' ? (
          <form
            className="mt-6 space-y-5"
            onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))}
          >
            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Email</span>
              <input type="email" className="input input-bordered w-full" {...loginForm.register('email')} />
              <span className="mt-2 text-xs text-error">{loginForm.formState.errors.email?.message}</span>
            </label>

            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Mot de passe</span>
              <input type="password" className="input input-bordered w-full" {...loginForm.register('password')} />
              <span className="mt-2 text-xs text-error">{loginForm.formState.errors.password?.message}</span>
            </label>

            {loginMutation.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loginMutation.error.message}</p>
            ) : null}

            <button type="submit" className="btn btn-neutral w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <form
            className="mt-6 space-y-5"
            onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))}
          >
            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Nom complet</span>
              <input className="input input-bordered w-full" {...registerForm.register('full_name')} />
              <span className="mt-2 text-xs text-error">{registerForm.formState.errors.full_name?.message}</span>
            </label>

            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Email</span>
              <input type="email" className="input input-bordered w-full" {...registerForm.register('email')} />
              <span className="mt-2 text-xs text-error">{registerForm.formState.errors.email?.message}</span>
            </label>

            <label className="form-control">
              <span className="label-text mb-2 text-sm font-medium text-slate-700">Mot de passe</span>
              <input type="password" className="input input-bordered w-full" {...registerForm.register('password')} />
              <span className="mt-2 text-xs text-error">{registerForm.formState.errors.password?.message}</span>
            </label>

            {registerMutation.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {registerMutation.error.message}
              </p>
            ) : null}

            <button type="submit" className="btn btn-neutral w-full" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
