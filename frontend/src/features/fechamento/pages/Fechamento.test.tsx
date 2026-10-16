import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { Medicao } from '@/shared/interfaces/medicao'
import { renderApp } from '@/test/helpers'
import { API, server } from '@/test/server'

const OBRA_ID = '22222222-2222-2222-2222-222222222222'
const OUTRA_OBRA_ID = '99999999-9999-9999-9999-999999999999'
const LISTA = `/cliente/obras/${OBRA_ID}/fechamento`

const itens: Medicao['itens'] = [
  { id: 'i1', tipo: 'MaoDeObra', descricao: 'Alvenaria do pavimento térreo', quantidade: 120.5, valorUnitario: 45, valorTotal: 5422.5 },
  { id: 'i2', tipo: 'Material', descricao: 'Cimento CP-II 50 kg', quantidade: 80, valorUnitario: 38.9, valorTotal: 3112 },
  { id: 'i3', tipo: 'Equipamento', descricao: 'Betoneira 400 L (diária)', quantidade: 5, valorUnitario: 90, valorTotal: 450 },
]

const medicao = (over: Partial<Medicao> = {}): Medicao => ({
  id: 'aaaaaaaa-0000-0000-0000-000000000003',
  obraId: OBRA_ID,
  etapaId: null,
  numero: 3,
  competencia: '2026-03-01',
  valorTotal: 8984.5,
  status: 'PendingApproval',
  approvedAt: null,
  nfNumber: null,
  nfIssuedAt: null,
  createdAt: '2026-03-28T12:00:00Z',
  itens,
  ...over,
})

const pendente = medicao()
const aprovada = medicao({
  id: 'aaaaaaaa-0000-0000-0000-000000000002',
  numero: 2,
  competencia: '2026-02-01',
  status: 'Approved',
  approvedAt: '2026-03-02T15:00:00Z',
})
const comNf = medicao({
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  numero: 1,
  competencia: '2026-01-01',
  status: 'InvoiceIssued',
  approvedAt: '2026-02-02T15:00:00Z',
  nfNumber: 'NF-1234',
  nfIssuedAt: '2026-02-10T15:00:00Z',
})

const DETALHE = (m: Medicao) => `/cliente/obras/${OBRA_ID}/fechamento/${m.id}`
const getLista = (body: unknown, status = 200) =>
  http.get(`${API}/obras/${OBRA_ID}/medicoes`, () => HttpResponse.json(body as never, { status }))
const getDetalhe = (m: Medicao) => http.get(`${API}/medicoes/${m.id}`, () => HttpResponse.json(m))

describe('Fechamento - lista (cliente)', () => {
  it('mostra carregando e depois as medições da mais nova para a mais antiga, com valor e situação', async () => {
    server.use(getLista([comNf, pendente, aprovada]))
    renderApp(LISTA, 'Client')

    expect(screen.getByRole('status')).toHaveTextContent('Carregando medições')
    expect(await screen.findByText('Medição 3')).toBeInTheDocument()

    const linhas = screen.getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(3)
    expect(linhas[0]).toHaveTextContent('Medição 3')
    expect(linhas[1]).toHaveTextContent('Medição 2')
    expect(linhas[2]).toHaveTextContent('Medição 1')
    expect(linhas[0]).toHaveTextContent(/março de 2026/i)
    expect(linhas[0]).toHaveTextContent(/8\.984,50/)
    expect(within(linhas[0]!).getByText('Aguardando sua aprovação')).toBeInTheDocument()
    expect(within(linhas[1]!).getByText('Aprovada')).toBeInTheDocument()
    expect(within(linhas[2]!).getByText('Nota fiscal emitida')).toBeInTheDocument()
  })

  it('avisa quando há medição aguardando aprovação e abre o detalhe pelo link', async () => {
    server.use(getLista([pendente, aprovada]), getDetalhe(pendente))
    renderApp(LISTA, 'Client')

    expect(await screen.findByText('Você tem 1 medição aguardando sua aprovação.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('link', { name: 'Ver itens da medição 3' }))

    expect(await screen.findByRole('heading', { name: 'Medição 3' })).toBeInTheDocument()
    expect(screen.getByText('Alvenaria do pavimento térreo')).toBeInTheDocument()
  })

  it('usa o plural quando há mais de uma aguardando', async () => {
    server.use(getLista([pendente, medicao({ id: 'x', numero: 4 })]))
    renderApp(LISTA, 'Client')

    expect(await screen.findByText('Você tem 2 medições aguardando sua aprovação.')).toBeInTheDocument()
  })

  it('sem nenhuma pendente não mostra o aviso', async () => {
    server.use(getLista([aprovada]))
    renderApp(LISTA, 'Client')

    expect(await screen.findByText('Medição 2')).toBeInTheDocument()
    expect(screen.queryByText(/aguardando sua aprovação\./)).not.toBeInTheDocument()
  })

  it('sem medições mostra mensagem de vazio', async () => {
    server.use(getLista([]))
    renderApp(LISTA, 'Client')

    expect(await screen.findByText(/Nenhuma medição foi enviada ainda/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('erro 500 mostra o código de suporte e permite tentar de novo', async () => {
    let calls = 0
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/medicoes`, () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ requestId: 'req-500', message: 'Erro interno' }, { status: 500 })
          : HttpResponse.json([pendente])
      }),
    )
    renderApp(LISTA, 'Client')

    expect(await screen.findByRole('alert')).toHaveTextContent('req-500')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Medição 3')).toBeInTheDocument()
  })

  it('erro 403 (obra não vinculada) mostra mensagem de sem permissão e nenhuma medição', async () => {
    server.use(getLista({}, 403))
    renderApp(LISTA, 'Client')

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('mostra só dado contratado: sem custo real, margem ou termos do admin, e sem ações de escrita', async () => {
    server.use(getLista([pendente, aprovada, comNf]))
    renderApp(LISTA, 'Client')
    await screen.findByText('Medição 3')

    expect(screen.queryByText(/custo real|margem|rentabilidade|\bSPI\b|\bCPI\b|curva s/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /criar|nova|editar|excluir|emitir|aprovar/i })).not.toBeInTheDocument()
  })

  it('admin não entra na rota do cliente e é levado para sem permissão', async () => {
    renderApp(LISTA, 'Admin')
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument()
  })

  it('deslogado é enviado ao login', async () => {
    renderApp(LISTA)
    expect(screen.queryByText('Medição 3')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })
})

describe('Fechamento - detalhe (cliente)', () => {
  it('mostra carregando e depois os itens com tipo, quantidade, valores e total', async () => {
    server.use(getDetalhe(pendente))
    renderApp(DETALHE(pendente), 'Client')

    expect(screen.getByRole('status')).toHaveTextContent('Carregando medição')
    expect(await screen.findByRole('heading', { name: 'Medição 3' })).toBeInTheDocument()
    expect(screen.getByText(/Mês de referência: março de 2026/i)).toBeInTheDocument()

    const linhaAlvenaria = screen.getByRole('row', { name: /Alvenaria do pavimento térreo/ })
    expect(linhaAlvenaria).toHaveTextContent('Mão de obra')
    expect(linhaAlvenaria).toHaveTextContent('120,5')
    expect(linhaAlvenaria).toHaveTextContent(/45,00/)
    expect(linhaAlvenaria).toHaveTextContent(/5\.422,50/)
    expect(screen.getByRole('row', { name: /Cimento CP-II/ })).toHaveTextContent('Material')
    expect(screen.getByRole('row', { name: /Betoneira/ })).toHaveTextContent('Equipamento')
    expect(screen.getByRole('row', { name: /Total da medição/ })).toHaveTextContent(/8\.984,50/)
  })

  it('medição sem itens ainda renderiza sem quebrar', async () => {
    const vazia = medicao({ itens: [], valorTotal: 0 })
    server.use(getDetalhe(vazia))
    renderApp(DETALHE(vazia), 'Client')

    expect(await screen.findByRole('heading', { name: 'Medição 3' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Total da medição/ })).toHaveTextContent(/0,00/)
  })

  it.each([
    [403, /não tem permissão/i, undefined],
    [404, /Não encontrado/i, undefined],
    [500, /Erro interno/, 'req-det-500'],
  ])('erro %i mostra mensagem adequada', async (status, texto, requestId) => {
    server.use(
      http.get(`${API}/medicoes/${pendente.id}`, () =>
        HttpResponse.json(requestId ? { requestId, message: 'Erro interno' } : {}, { status }),
      ),
    )
    renderApp(DETALHE(pendente), 'Client')

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(texto)
    if (requestId) expect(alerta).toHaveTextContent(requestId)
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar para as medições/ })).toHaveAttribute('href', LISTA)
  })

  it('medição de outra obra (URL adulterada) não é exibida', async () => {
    const alheia = medicao({ obraId: OUTRA_OBRA_ID })
    server.use(getDetalhe(alheia))
    renderApp(DETALHE(alheia), 'Client')

    expect(await screen.findByText('Medição não encontrada nesta obra.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Alvenaria do pavimento térreo')).not.toBeInTheDocument()
  })

  it('não exibe custo real, margem nem o id interno de quem aprovou', async () => {
    const m = medicao({ ...aprovada, obraId: OBRA_ID })
    server.use(
      http.get(`${API}/medicoes/${m.id}`, () =>
        HttpResponse.json({ ...m, approvedByUserId: '77777777-7777-7777-7777-777777777777' }),
      ),
    )
    renderApp(DETALHE(m), 'Client')
    await screen.findByRole('heading', { name: 'Medição 2' })

    expect(screen.queryByText(/custo real|margem|rentabilidade|\bSPI\b|\bCPI\b/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/77777777/)).not.toBeInTheDocument()
  })

  it('admin não entra na rota de detalhe do cliente', async () => {
    renderApp(DETALHE(pendente), 'Admin')
    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument()
  })

  describe('papel e status da ação de aprovar', () => {
    it('PendingApproval: cliente vê "Aprovar medição" e nenhuma outra ação de escrita', async () => {
      server.use(getDetalhe(pendente))
      renderApp(DETALHE(pendente), 'Client')
      await screen.findByRole('heading', { name: 'Medição 3' })

      expect(screen.getByRole('button', { name: 'Aprovar medição' })).toBeEnabled()
      expect(screen.queryByRole('button', { name: /criar|nova|editar|excluir|emitir|nota fiscal/i })).not.toBeInTheDocument()
    })

    it('Approved: sem botão de aprovar; mostra data da aprovação e que a NF virá', async () => {
      const m = medicao({ ...aprovada, obraId: OBRA_ID })
      server.use(getDetalhe(m))
      renderApp(DETALHE(m), 'Client')

      expect(await screen.findByText(/Você aprovou esta medição em 02\/03\/2026/)).toBeInTheDocument()
      expect(screen.getByText(/vai emitir a nota fiscal/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /aprovar|criar|editar|excluir|emitir/i })).not.toBeInTheDocument()
    })

    it('InvoiceIssued: sem botão de aprovar; mostra o número da nota fiscal', async () => {
      server.use(getDetalhe(comNf))
      renderApp(DETALHE(comNf), 'Client')

      expect(await screen.findByText(/Nota fiscal nº NF-1234/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /aprovar|criar|editar|excluir|emitir/i })).not.toBeInTheDocument()
    })
  })

  describe('fluxo de aprovação', () => {
    it('pede confirmação, aprova e passa a mostrar a medição como aprovada', async () => {
      let atual: Medicao = pendente
      let posts = 0
      server.use(
        http.get(`${API}/medicoes/${pendente.id}`, () => HttpResponse.json(atual)),
        http.post(`${API}/medicoes/${pendente.id}/approve`, () => {
          posts += 1
          atual = { ...pendente, status: 'Approved', approvedAt: '2026-04-01T15:00:00Z' }
          return HttpResponse.json(atual)
        }),
      )
      const user = userEvent.setup()
      renderApp(DETALHE(pendente), 'Client')

      await user.click(await screen.findByRole('button', { name: 'Aprovar medição' }))
      expect(screen.getByText('Confirmar aprovação da medição 3?')).toBeInTheDocument()
      expect(screen.getByText(/Esta ação não pode ser desfeita/)).toBeInTheDocument()
      expect(posts).toBe(0)

      await user.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))

      expect(await screen.findByText(/Você aprovou esta medição em 01\/04\/2026/)).toBeInTheDocument()
      expect(posts).toBe(1)
      expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
      expect(screen.getByText('Nota fiscal', { exact: false })).toBeInTheDocument()
    })

    it('cancelar a confirmação não envia nada e volta ao botão inicial', async () => {
      let posts = 0
      server.use(
        getDetalhe(pendente),
        http.post(`${API}/medicoes/${pendente.id}/approve`, () => {
          posts += 1
          return HttpResponse.json(pendente)
        }),
      )
      const user = userEvent.setup()
      renderApp(DETALHE(pendente), 'Client')

      await user.click(await screen.findByRole('button', { name: 'Aprovar medição' }))
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(screen.getByRole('button', { name: 'Aprovar medição' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Confirmar aprovação' })).not.toBeInTheDocument()
      expect(posts).toBe(0)
    })

    it('durante o envio desabilita os botões e evita duplo clique', async () => {
      let posts = 0
      let atual: Medicao = pendente
      server.use(
        http.get(`${API}/medicoes/${pendente.id}`, () => HttpResponse.json(atual)),
        http.post(`${API}/medicoes/${pendente.id}/approve`, async () => {
          posts += 1
          await delay(150)
          atual = { ...pendente, status: 'Approved', approvedAt: '2026-04-01T15:00:00Z' }
          return HttpResponse.json(atual)
        }),
      )
      const user = userEvent.setup()
      renderApp(DETALHE(pendente), 'Client')

      await user.click(await screen.findByRole('button', { name: 'Aprovar medição' }))
      await user.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))

      expect(screen.getByRole('button', { name: 'Aprovando…' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Aprovando…' }))
      expect(await screen.findByText(/Você aprovou esta medição/)).toBeInTheDocument()
      expect(posts).toBe(1)
    })

    it('409 mostra a mensagem do servidor e a medição continua pendente (permite tentar de novo)', async () => {
      server.use(
        getDetalhe(pendente),
        http.post(`${API}/medicoes/${pendente.id}/approve`, () =>
          HttpResponse.json({ message: 'Medicao nao pode ser aprovada no status atual: Approved.' }, { status: 409 }),
        ),
      )
      const user = userEvent.setup()
      renderApp(DETALHE(pendente), 'Client')

      await user.click(await screen.findByRole('button', { name: 'Aprovar medição' }))
      await user.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))

      expect(await screen.findByText(/Medicao nao pode ser aprovada no status atual/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Confirmar aprovação' })).toBeEnabled()
    })

    it('409 porque já foi aprovada por outro lado: a tela volta ao estado real do servidor', async () => {
      let atual: Medicao = pendente
      server.use(
        http.get(`${API}/medicoes/${pendente.id}`, () => HttpResponse.json(atual)),
        http.post(`${API}/medicoes/${pendente.id}/approve`, () => {
          atual = { ...pendente, status: 'Approved', approvedAt: '2026-04-01T15:00:00Z' }
          return HttpResponse.json({ message: 'Medicao nao pode ser aprovada no status atual: Approved.' }, { status: 409 })
        }),
      )
      const user = userEvent.setup()
      renderApp(DETALHE(pendente), 'Client')

      await user.click(await screen.findByRole('button', { name: 'Aprovar medição' }))
      await user.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))

      expect(await screen.findByText(/Você aprovou esta medição/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
    })

    it('500 na aprovação mostra o código de suporte', async () => {
      server.use(
        getDetalhe(pendente),
        http.post(`${API}/medicoes/${pendente.id}/approve`, () =>
          HttpResponse.json({ requestId: 'req-aprov-1', message: 'Erro interno' }, { status: 500 }),
        ),
      )
      const user = userEvent.setup()
      renderApp(DETALHE(pendente), 'Client')

      await user.click(await screen.findByRole('button', { name: 'Aprovar medição' }))
      await user.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))

      expect(await screen.findByText(/Código para o suporte: req-aprov-1/)).toBeInTheDocument()
    })

    it('403 na aprovação mostra mensagem de sem permissão', async () => {
      server.use(
        getDetalhe(pendente),
        http.post(`${API}/medicoes/${pendente.id}/approve`, () => new HttpResponse(null, { status: 403 })),
      )
      const user = userEvent.setup()
      renderApp(DETALHE(pendente), 'Client')

      await user.click(await screen.findByRole('button', { name: 'Aprovar medição' }))
      await user.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))

      expect(await screen.findByText(/não tem permissão/i)).toBeInTheDocument()
    })
  })
})
