import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Etapa } from '@/interfaces/etapa'
import type { ProjetoDocumento } from '@/interfaces/projeto'
import { renderApp } from '@/test/helpers'
import { API, server } from '@/test/server'

const OBRA_ID = '22222222-2222-2222-2222-222222222222'
const ROTA = `/cliente/obras/${OBRA_ID}/projetos`
const TOKEN = 'token-falso-de-teste'

const projeto = (id: string, over: Partial<ProjetoDocumento> = {}): ProjetoDocumento => ({
  id,
  obraId: OBRA_ID,
  etapaId: null,
  nome: `${id}.pdf`,
  tipoDocumento: null,
  uploadedAt: '2026-03-10T15:00:00Z',
  ...over,
})
const etapa = (id: string, nome: string, ordem: number): Etapa => ({ id, obraId: OBRA_ID, nome, ordem })

const getLista = (body: unknown, status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/projetos`, () => HttpResponse.json(body as never, { status }))
const getEtapas = (body: unknown = [], status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/etapas`, () => HttpResponse.json(body as never, { status }))
const getDownload = (opts: { auth?: string[]; disposition?: string; contentType?: string } = {}) =>
  http.get(`${API}/projetos/:id/download`, ({ request }) => {
    opts.auth?.push(request.headers.get('authorization') ?? '')
    const headers: Record<string, string> = { 'Content-Type': opts.contentType ?? 'application/pdf' }
    if (opts.disposition) headers['Content-Disposition'] = opts.disposition
    return new HttpResponse(Uint8Array.from([37, 80, 68, 70]), { headers })
  })

const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()
let anchorClicks: { download: string; href: string }[] = []

beforeEach(() => {
  createObjectURL.mockReset()
  createObjectURL.mockImplementation(() => 'blob:http://localhost/proj-1')
  revokeObjectURL.mockReset()
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true })
  anchorClicks = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    anchorClicks.push({ download: this.download, href: this.href })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Projetos (cliente)', () => {
  it('mostra carregando e depois um card por etapa, na ordem do backend, com "Documentos gerais" por último', async () => {
    server.use(
      getLista([
        projeto('p1', { etapaId: 'e2', nome: 'alvenaria.pdf' }),
        projeto('p2', { etapaId: 'e1', nome: 'fundacao.pdf' }),
        projeto('p3', { etapaId: null, nome: 'memorial.pdf' }),
      ]),
      getEtapas([etapa('e1', 'Fundação', 1), etapa('e2', 'Alvenaria', 2)]),
    )
    renderApp(ROTA, 'Client')

    expect(screen.getByRole('status')).toHaveTextContent('Carregando projetos')
    await screen.findByRole('heading', { name: 'Alvenaria' })
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Alvenaria', 'Fundação', 'Documentos gerais'])
  })

  it('mostra nome, badge de tipo ou "—", e data dd/mm/aaaa', async () => {
    server.use(
      getLista([
        projeto('p1', { nome: 'planta.pdf', tipoDocumento: 'Planta baixa', uploadedAt: '2026-03-10T15:00:00Z' }),
        projeto('p2', { nome: 'sem-tipo.pdf', tipoDocumento: null, uploadedAt: '2026-04-02T15:00:00Z' }),
      ]),
      getEtapas(),
    )
    renderApp(ROTA, 'Client')

    const linhaP1 = (await screen.findByText('planta.pdf')).closest('tr') as HTMLElement
    expect(within(linhaP1).getByText('Planta baixa')).toBeInTheDocument()
    expect(within(linhaP1).getByText('10/03/2026')).toBeInTheDocument()

    const linhaP2 = screen.getByText('sem-tipo.pdf').closest('tr') as HTMLElement
    expect(within(linhaP2).getByLabelText('Sem tipo')).toHaveTextContent('—')
    expect(within(linhaP2).getByText('02/04/2026')).toBeInTheDocument()
  })

  it('ícone por extensão, sem diferenciar maiúsculas', async () => {
    server.use(
      getLista([
        projeto('a', { nome: 'A.PDF' }),
        projeto('b', { nome: 'b.JPG' }),
        projeto('c', { nome: 'c.xlsx' }),
        projeto('d', { nome: 'd.dwg' }),
      ]),
      getEtapas(),
    )
    renderApp(ROTA, 'Client')

    const rotulo = async (nome: string) =>
      within((await screen.findByText(nome)).closest('tr') as HTMLElement).getByRole('img').getAttribute('aria-label')
    expect(await rotulo('A.PDF')).toBe('PDF')
    expect(await rotulo('b.JPG')).toBe('Imagem')
    expect(await rotulo('c.xlsx')).toBe('Planilha')
    expect(await rotulo('d.dwg')).toBe('Arquivo')
  })

  it('Visualizar só aparece para pdf e imagens; Baixar sempre', async () => {
    const nomes = ['a.pdf', 'b.JPG', 'c.jpeg', 'd.png', 'e.webp', 'f.gif', 'g.xlsx', 'h.dwg', 'i.docx']
    server.use(getLista(nomes.map((nome, i) => projeto(`p${i}`, { nome }))), getEtapas())
    renderApp(ROTA, 'Client')

    await screen.findByText('a.pdf')
    for (const nome of nomes) {
      expect(screen.getByRole('button', { name: `Baixar ${nome}` })).toBeEnabled()
      const visualizar = screen.queryByRole('button', { name: `Visualizar ${nome}` })
      if (['g.xlsx', 'h.dwg', 'i.docx'].includes(nome)) expect(visualizar).not.toBeInTheDocument()
      else expect(visualizar).toBeInTheDocument()
    }
  })

  it('etapas falhando: documentos caem em "Outros documentos" e a tela não mostra erro', async () => {
    server.use(
      getLista([projeto('p1', { etapaId: 'e1', nome: 'x.pdf' }), projeto('p2', { etapaId: null, nome: 'y.pdf' })]),
      getEtapas({ requestId: 'req-etapas', message: 'Erro' }, 500),
    )
    renderApp(ROTA, 'Client')

    await screen.findByRole('heading', { name: 'Outros documentos' })
    expect(screen.getByRole('heading', { name: 'Documentos gerais' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Outros documentos', 'Documentos gerais'])
  })

  it('etapa desconhecida vai para "Outros documentos" mesmo com etapas carregadas', async () => {
    server.use(getLista([projeto('p1', { etapaId: 'nao-existe', nome: 'x.pdf' })]), getEtapas([etapa('e1', 'Fundação', 1)]))
    renderApp(ROTA, 'Client')

    expect(await screen.findByRole('heading', { name: 'Outros documentos' })).toBeInTheDocument()
  })

  it('vazio: mostra "Nenhum projeto disponível ainda"', async () => {
    server.use(getLista([]), getEtapas())
    renderApp(ROTA, 'Client')

    expect(await screen.findByText('Nenhum projeto disponível ainda')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('erro 500 mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    let calls = 0
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/projetos`, () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ requestId: 'req-500', message: 'Erro interno' }, { status: 500 })
          : HttpResponse.json([projeto('p1', { nome: 'ok.pdf' })])
      }),
      getEtapas(),
    )
    renderApp(ROTA, 'Client')

    expect(await screen.findByRole('alert')).toHaveTextContent('req-500')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('ok.pdf')).toBeInTheDocument()
  })

  it('erro 403 na lista mostra mensagem de sem permissão e nenhum documento', async () => {
    server.use(getLista({}, 403), getEtapas({}, 403))
    renderApp(ROTA, 'Client')

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('Baixar: envia Bearer, usa o nome do Content-Disposition e desabilita os botões enquanto baixa', async () => {
    const auth: string[] = []
    let liberar: () => void = () => {}
    const bloqueio = new Promise<void>((resolve) => {
      liberar = resolve
    })
    server.use(
      getLista([projeto('p1', { nome: 'original.pdf' }), projeto('p2', { nome: 'outro.pdf' })]),
      getEtapas(),
      http.get(`${API}/projetos/p1/download`, async ({ request }) => {
        auth.push(request.headers.get('authorization') ?? '')
        await bloqueio
        return new HttpResponse(Uint8Array.from([1, 2, 3]), {
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="planta-final.pdf"' },
        })
      }),
    )
    renderApp(ROTA, 'Client')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Baixar original.pdf' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar original.pdf' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Visualizar original.pdf' })).toBeDisabled()

    liberar()
    await waitFor(() => expect(anchorClicks).toHaveLength(1))
    expect(anchorClicks[0]?.download).toBe('planta-final.pdf')
    expect(anchorClicks[0]?.href).toMatch(/^blob:/)
    expect(auth).toEqual([`Bearer ${TOKEN}`])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Baixar original.pdf' })).toBeEnabled())
  })

  it('Baixar sem Content-Disposition usa o nome do projeto', async () => {
    server.use(getLista([projeto('p1', { nome: 'memorial.pdf' })]), getEtapas(), getDownload())
    renderApp(ROTA, 'Client')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Baixar memorial.pdf' }))
    await waitFor(() => expect(anchorClicks).toHaveLength(1))
    expect(anchorClicks[0]?.download).toBe('memorial.pdf')
  })

  it('Visualizar: baixa com Bearer e abre o blob: em nova aba com noopener (nunca URL da API/bucket)', async () => {
    const auth: string[] = []
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    server.use(getLista([projeto('p1', { nome: 'planta.pdf' })]), getEtapas(), getDownload({ auth }))
    renderApp(ROTA, 'Client')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Visualizar planta.pdf' }))
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    expect(open).toHaveBeenCalledWith('blob:http://localhost/proj-1', '_blank', 'noopener')
    expect(auth).toEqual([`Bearer ${TOKEN}`])
    expect(anchorClicks).toHaveLength(0)
  })

  it('Baixar com 403 mostra "Você não tem permissão para acessar este arquivo." sem derrubar a lista', async () => {
    server.use(
      getLista([projeto('p1', { nome: 'a.pdf' }), projeto('p2', { nome: 'b.pdf' })]),
      getEtapas(),
      http.get(`${API}/projetos/p1/download`, () => HttpResponse.json({}, { status: 403 })),
    )
    renderApp(ROTA, 'Client')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Baixar a.pdf' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem permissão para acessar este arquivo.')
    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(screen.getByText('b.pdf')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Baixar a.pdf' })).toBeEnabled()
    expect(anchorClicks).toHaveLength(0)
  })

  it('Visualizar com 500 mostra erro sem derrubar a lista e não abre aba', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    server.use(
      getLista([projeto('p1', { nome: 'a.pdf' })]),
      getEtapas(),
      http.get(`${API}/projetos/p1/download`, () => HttpResponse.json({ requestId: 'req-dl', message: 'Erro' }, { status: 500 })),
    )
    renderApp(ROTA, 'Client')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Visualizar a.pdf' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(open).not.toHaveBeenCalled()
  })

  it('é somente leitura: sem upload, editar, excluir ou criar', async () => {
    server.use(getLista([projeto('p1', { nome: 'a.pdf' })]), getEtapas())
    const { container } = renderApp(ROTA, 'Client')
    await screen.findByText('a.pdf')

    expect(
      screen.queryByRole('button', { name: /enviar|upload|criar|novo|adicionar|editar|excluir|remover|publicar/i }),
    ).not.toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })

  it('mostra nome do arquivo como texto, sem interpretar HTML', async () => {
    server.use(getLista([projeto('p1', { nome: '<b>negrito</b>.pdf', tipoDocumento: '<i>x</i>' })]), getEtapas())
    const { container } = renderApp(ROTA, 'Client')

    expect(await screen.findByText('<b>negrito</b>.pdf')).toBeInTheDocument()
    expect(container.querySelector('main b, main i')).toBeNull()
  })

  it('tem "← Minhas obras" e "Projetos" como último item da sidebar, ativo na rota', async () => {
    server.use(getLista([projeto('p1')]), getEtapas())
    renderApp(ROTA, 'Client')

    const main = await screen.findByRole('main')
    expect(within(main).getByRole('link', { name: 'Minhas obras' })).toHaveAttribute('href', '/cliente')
    const nav = screen.getByRole('navigation')
    const links = within(nav).getAllByRole('link')
    const ultimo = links[links.length - 1] as HTMLElement
    expect(ultimo).toHaveTextContent('Projetos')
    expect(ultimo).toHaveAttribute('aria-current', 'page')
  })

  it('master não entra na rota do cliente', async () => {
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
