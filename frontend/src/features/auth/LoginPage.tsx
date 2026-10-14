import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '@/shared/lib/apiClient'
import { homePathFor } from './homePath'
import { useAuth } from './useAuth'

const schema = z.object({
  email: z.string().min(1, 'Informe o e-mail.').pipe(z.email('E-mail inválido.')),
  password: z.string().min(1, 'Informe a senha.'),
})
type FormValues = z.infer<typeof schema>

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') return 'E-mail ou senha incorretos.'
    if (error.kind === 'network') return error.message
    if (error.kind === 'server') {
      return error.requestId ? `${error.message} Código: ${error.requestId}` : error.message
    }
  }
  return 'Não foi possível entrar. Tente novamente.'
}

export function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (session) return <Navigate to={homePathFor(session.role)} replace />

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    try {
      const next = await signIn(email, password)
      navigate(homePathFor(next.role), { replace: true })
    } catch (error) {
      setFormError(messageFor(error))
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={onSubmit} noValidate className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Entrar</h1>

        <div>
          <label htmlFor="email" className="block text-sm font-medium">E-mail</label>
          <input id="email" type="email" autoComplete="username" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" {...register('email')} />
          {errors.email && <p role="alert" className="mt-1 text-sm text-red-700">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">Senha</label>
          <input id="password" type="password" autoComplete="current-password" className="mt-1 w-full rounded border border-slate-300 px-3 py-2" {...register('password')} />
          {errors.password && <p role="alert" className="mt-1 text-sm text-red-700">{errors.password.message}</p>}
        </div>

        {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}

        <button type="submit" disabled={isSubmitting} className="w-full rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-60">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
