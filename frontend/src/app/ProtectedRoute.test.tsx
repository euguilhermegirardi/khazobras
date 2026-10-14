import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/helpers'

describe('guarda de rotas por papel', () => {
  it('sem sessao, redireciona para o login', () => {
    renderApp('/cliente')
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('cliente acessa a visao cliente', () => {
    renderApp('/cliente', 'Client')
    expect(screen.getByRole('heading', { name: /Hub/ })).toBeInTheDocument()
  })

  it('cliente NAO acessa a area admin', () => {
    renderApp('/admin', 'Client')
    expect(screen.getByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Dashboard/ })).not.toBeInTheDocument()
  })

  it.each(['Admin', 'Master'] as const)('%s acessa a area admin', (role) => {
    renderApp('/admin', role)
    expect(screen.getByRole('heading', { name: /Dashboard/ })).toBeInTheDocument()
  })

  it('admin NAO entra na visao cliente', () => {
    renderApp('/cliente', 'Admin')
    expect(screen.getByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument()
  })

  it('a raiz leva cada papel para a sua home', () => {
    renderApp('/', 'Client')
    expect(screen.getByRole('heading', { name: /Hub/ })).toBeInTheDocument()
  })
})
