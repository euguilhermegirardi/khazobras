import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { RelatorioMensal } from '@/shared/interfaces/relatorioMensal'
import { renderApp } from '@/test/helpers'
import { API, server } from '@/test/server'

const OBRA_ID = '22222222-2222-2222-2222-222222222222'
const ROTA = `/cliente/obras/${OBRA_ID}/relatorio-mensal`

const relatorio = (over: Partial<RelatorioMensal> = {}): RelatorioMensal => ({
  id: 'r1',
  obraId: OBRA_ID,
  competencia: '2026-02-01',
  conteudo: 'Fundação concluída.\nInício da alvenaria.',
  status: 'published',
  publishedAt: '2026-03-02T15:00:00Z',
  createdAt: '2026-03-01T12:00:00Z',
  ...over,
})

const getLista = (body: unknown, status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/relatorios-mensais`, ({ request }) => {
    // O cliente só pode pedir os publicados.
    expect(new URL(request.url).searchParams.get('onlyPublished')).toBe('true')
    return HttpResponse.json(body as never, { status })
  })

describe('Relatório mensal (cliente)', () => {
  it('mostra carregando e depois os relatórios do mês mais novo para o mais antigo', async () => {
    server.use(getLista([relatorio(), relatorio({ id: 'r2', competencia: '2026-03-01', conteudo: 'Telhado em andamento.' })]))
    renderApp(ROTA, 'Client')

    expect(screen.getByRole('status')).toHaveTextContent('Carregando relatórios')
    expect(await screen.findByText('Telhado em andamento.')).toBeInTheDocument()

    const meses = screen.getAllByText(/de 2026$/i).map((el) => el.textContent?.toLowerCase())
    expect(meses).toEqual(['março de 2026', 'fevereiro de 2026'])
    expect(screen.getAllByText(/Publicado em/)).toHaveLength(2)
  })

  it('mostra o texto como texto, sem interpretar HTML', async () => {
    server.use(getLista([relatorio({ conteudo: '<b>negrito</b>' })]))
    renderApp(ROTA, 'Client')

    expect(await screen.findByText('<b>negrito</b>')).toBeInTheDocument()
  })

  it('mostra mensagem útil quando não há relatório publicado', async () => {
    server.use(getLista([]))
    renderApp(ROTA, 'Client')

    expect(await screen.findByText(/Nenhum relatório foi publicado ainda/)).toBeInTheDocument()
  })

  it('erro 500 mostra o código de suporte e permite tentar de novo', async () => {
    let calls = 0
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/relatorios-mensais`, () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ requestId: 'req-500', message: 'Erro interno' }, { status: 500 })
          : HttpResponse.json([relatorio()])
      }),
    )
    renderApp(ROTA, 'Client')

    expect(await screen.findByRole('alert')).toHaveTextContent('req-500')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText(/Fundação concluída/)).toBeInTheDocument()
  })

  it('erro 403 mostra mensagem de sem permissão', async () => {
    server.use(getLista({}, 403))
    renderApp(ROTA, 'Client')

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i)
  })

  it('é somente leitura: sem botões de escrita', async () => {
    server.use(getLista([relatorio()]))
    renderApp(ROTA, 'Client')
    await screen.findByText(/Fundação concluída/)

    expect(screen.queryByRole('button', { name: /criar|novo|editar|excluir|publicar/i })).not.toBeInTheDocument()
  })

  it('não exibe ids internos nem rascunho/status técnico ao cliente', async () => {
    server.use(getLista([relatorio()]))
    renderApp(ROTA, 'Client')
    await screen.findByText(/Fundação concluída/)

    expect(screen.queryByText(/draft|rascunho|createdBy/i)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('r1')
  })

  it('master também não entra na rota do cliente', async () => {
    renderApp(ROTA, 'Master')
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument()
  })

  it('admin não entra na rota do cliente', async () => {
    renderApp(ROTA, 'Admin')
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument()
  })

  it('deslogado é enviado ao login', async () => {
    renderApp(ROTA)
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })
})
