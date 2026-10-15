import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '@/shared/lib/apiClient'
import { homePathFor } from '@/shared/auth/homePath'
import { useAuth } from '@/shared/auth/useAuth'
import { Button } from '@/shared/ui/button'

const schema = z.object({
  email: z.string().min(1, 'Informe o e-mail.').pipe(z.email('E-mail inválido.')),
  password: z.string().min(1, 'Informe a senha.'),
})
type FormValues = z.infer<typeof schema>

const messageFor = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') return 'E-mail ou senha incorretos.'
    if (error.kind === 'network') return error.message
    if (error.kind === 'server') {
      return error.requestId ? `${error.message} Código: ${error.requestId}` : error.message
    }
  }
  return 'Não foi possível entrar. Tente novamente.'
}

export const LoginPage = () => {
  // Estados
  const [formError, setFormError] = useState<string | null>(null)

  // Hooks
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Functions
  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    try {
      const next = await signIn(email, password)
      navigate(homePathFor(next.role), { replace: true })
    } catch (error) {
      setFormError(messageFor(error))
    }
  })

  // Retorno breve: já logado vai direto para a home do papel
  if (session) return <Navigate to={homePathFor(session.role)} replace />

  // Return

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <form onSubmit={onSubmit} noValidate className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Entrar</h1>

        <div>
          <label htmlFor="email" className="block text-sm font-medium">E-mail</label>
          <input id="email" type="email" autoComplete="username" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" {...register('email')} />
          {errors.email && <p role="alert" className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">Senha</label>
          <input id="password" type="password" autoComplete="current-password" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" {...register('password')} />
          {errors.password && <p role="alert" className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
        </div>

        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}
