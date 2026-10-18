import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/helpers'
import { API, server } from '@/test/server'

const OBRA_ID = '22222222-2222-2222-2222-222222222222'

describe('AppShell — voltar ao hub', () => {
  it.each(['', '/fechamento', '/relatorio-mensal'])('mostra "Minhas obras" em /cliente/obras/:id%s', async (sub) => {
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/medicoes`, () => HttpResponse.json([])),
      http.get(`${API}/obras/${OBRA_ID}/relatorios-mensais`, () => HttpResponse.json([])),
    )
    renderApp(`/cliente/obras/${OBRA_ID}${sub}`, 'Client')

    const main = await screen.findByRole('main')
    expect(within(main).getByRole('link', { name: 'Minhas obras' })).toHaveAttribute('href', '/cliente')
  })

  it('não mostra o voltar no próprio hub', async () => {
    server.use(http.get(`${API}/obras`, () => HttpResponse.json({ totalItems: 0, pageIndex: 0, pageSize: 20, items: [] })))
    renderApp('/cliente', 'Client')

    const main = await screen.findByRole('main')
    expect(within(main).queryByRole('link', { name: 'Minhas obras' })).not.toBeInTheDocument()
  })
})
