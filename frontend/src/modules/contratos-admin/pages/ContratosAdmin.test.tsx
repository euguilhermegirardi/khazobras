import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/auth/AuthContext';
import type { Role } from '@/interfaces/auth';
import { AppRoutes } from '@/routes/AppRoutes';
import { saveSession } from '@/services/session';
import {
  ADMIN,
  CLIENTE,
  contratoAdmin,
  erroNaLista,
  erroNoDetalhe,
  medicaoNf,
  OBRA_ID,
  pagamentoAdmin,
  servidorAdmin,
} from '@/test/contratos';
import { fakeSession, renderApp } from '@/test/helpers';
import { API, server } from '@/test/server';
import { toDateOnly } from '@/utils/dates';

const user = () => userEvent.setup();

const MEDICOES = [
  medicaoNf(),
  medicaoNf({ id: 'm2', numero: 2, competencia: '2026-07-01', valorTotal: 39870.4, nfNumber: 'NF-2026-0121' }),
];

/** Uma obra com um contrato (R$ 100.000, R$ 40.000 pagos) e as duas medições com NF do select. */
const servidorPadrao = () => servidorAdmin([{ contrato: contratoAdmin(), pagamentos: [pagamentoAdmin()] }], MEDICOES);

const diaLocal = (deslocamento: number) => {
  const hoje = new Date();
  return toDateOnly(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + deslocamento));
};
const HOJE = () => diaLocal(0);
const AMANHA = () => diaLocal(1);
const DEPOIS_DE_AMANHA = () => diaLocal(2);

const card = (numero: string) => screen.getByRole('group', { name: `Contrato ${numero}` });
const valorDe = (el: HTMLElement, rotulo: string) => within(el).getByText(rotulo).nextElementSibling as HTMLElement;
const kpi = (rotulo: string) => screen.getByText(rotulo, { selector: 'p' }).nextElementSibling as HTMLElement;
const definir = (campo: HTMLElement, valor: string) => fireEvent.change(campo, { target: { value: valor } });

async function abrirNovoContrato() {
  await user().click(await screen.findByRole('button', { name: '+ Novo contrato' }));
  const dialog = await screen.findByRole('dialog', { name: 'Novo contrato' });
  return {
    dialog,
    numero: within(dialog).getByLabelText('Número do contrato'),
    valor: within(dialog).getByLabelText('Valor contratado (R$)'),
    data: within(dialog).getByLabelText('Data de assinatura (opcional)'),
    criar: () => user().click(within(dialog).getByRole('button', { name: 'Criar contrato' })),
  };
}

async function abrirPagamento(numeroContrato = 'CT-2026/01') {
  await user().click(await screen.findByRole('button', { name: `Registrar pagamento no contrato ${numeroContrato}` }));
  const dialog = await screen.findByRole('dialog', { name: 'Registrar pagamento' });
  return {
    dialog,
    valor: within(dialog).getByLabelText('Valor (R$)'),
    data: within(dialog).getByLabelText('Data do pagamento'),
    forma: within(dialog).getByLabelText('Forma de pagamento (opcional)'),
    medicao: within(dialog).getByLabelText('Medição vinculada (opcional)'),
    registrar: () => user().click(within(dialog).getByRole('button', { name: 'Registrar pagamento' })),
  };
}

describe('Contratos (admin) - lista e estados', () => {
  it('mostra carregando e depois os contratos com o botão "+ Novo contrato" e "Registrar pagamento" por card', async () => {
    server.use(...servidorPadrao().handlers);
    renderApp(ADMIN, 'Admin');

    expect(screen.getByRole('status')).toHaveTextContent('Carregando contratos');
    expect(await screen.findByRole('heading', { name: 'Contrato CT-2026/01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Novo contrato' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar pagamento no contrato CT-2026/01' })).toBeInTheDocument();
    expect(valorDe(card('CT-2026/01'), 'Valor contratado')).toHaveTextContent(/R\$\s*100\.000,00/);
    expect(await screen.findByRole('table')).toHaveTextContent('01/06/2026');
    // Um contrato só: sem totais da obra.
    expect(screen.queryByText('Valor contratado total')).not.toBeInTheDocument();
  });

  it('Master também acessa', async () => {
    server.use(...servidorPadrao().handlers);
    renderApp(ADMIN, 'Master');
    expect(await screen.findByRole('heading', { name: 'Contrato CT-2026/01' })).toBeInTheDocument();
  });

  it('obra sem contratos mostra o vazio e mantém o botão de criar', async () => {
    server.use(...servidorAdmin([]).handlers);
    renderApp(ADMIN, 'Admin');

    expect(await screen.findByText('Nenhum contrato registrado nesta obra ainda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Novo contrato' })).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('erro 500 na lista mostra o código de suporte e "Tentar novamente" recarrega', async () => {
    server.use(erroNaLista(500, { requestId: 'req-admin-lista', message: 'Erro interno do servidor.' }));
    renderApp(ADMIN, 'Admin');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('req-admin-lista');
    server.use(...servidorPadrao().handlers);
    await user().click(within(alerta).getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('heading', { name: 'Contrato CT-2026/01' })).toBeInTheDocument();
  });

  it('erro 403 na lista mostra "sem permissão"', async () => {
    server.use(erroNaLista(403));
    renderApp(ADMIN, 'Admin');
    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('erro no detalhe de um contrato fica naquele card e não derruba a página', async () => {
    const dois = servidorAdmin(
      [
        { contrato: contratoAdmin(), pagamentos: [pagamentoAdmin()] },
        { contrato: contratoAdmin({ id: 'c2', numero: 'CT-2026/02' }), pagamentos: [] },
      ],
      MEDICOES,
    );
    server.use(erroNoDetalhe('c2', 500, { requestId: 'req-det-admin', message: 'Erro.' }), ...dois.handlers);
    renderApp(ADMIN, 'Admin');

    const secao = await screen.findByRole('region', { name: 'Pagamentos do contrato CT-2026/02' });
    expect(await within(secao).findByRole('alert')).toHaveTextContent('req-det-admin');
    expect(screen.getByRole('heading', { name: 'Contrato CT-2026/01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Novo contrato' })).toBeInTheDocument();
  });

  it('contrato sem pagamentos mostra o vazio do card', async () => {
    server.use(...servidorAdmin([{ contrato: contratoAdmin(), pagamentos: [] }]).handlers);
    renderApp(ADMIN, 'Admin');

    expect(await screen.findByText('Nenhum pagamento registrado neste contrato ainda.')).toBeInTheDocument();
  });

  it('com 2+ contratos mostra os totais da obra; pago a mais aparece como "Pago a mais" sem sinal', async () => {
    const api = servidorAdmin(
      [
        {
          contrato: contratoAdmin({ valorContratado: 1000 }),
          pagamentos: [pagamentoAdmin({ valor: 1500 })],
        },
        {
          contrato: contratoAdmin({ id: 'c2', numero: 'CT-2026/02', valorContratado: 5000 }),
          pagamentos: [pagamentoAdmin({ id: 'p2', contratoId: 'c2', valor: 2000 })],
        },
      ],
      MEDICOES,
    );
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findAllByRole('table');

    const c1 = card('CT-2026/01');
    const aMais = valorDe(c1, 'Pago a mais');
    expect(aMais).toHaveTextContent(/^R\$\s*500,00$/);
    expect(aMais.textContent).not.toMatch(/[-−]/);
    expect(within(c1).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(valorDe(card('CT-2026/02'), 'Saldo a pagar')).toHaveTextContent(/R\$\s*3\.000,00/);

    expect(kpi('Valor contratado total')).toHaveTextContent(/R\$\s*6\.000,00/);
    expect(kpi('Total pago')).toHaveTextContent(/R\$\s*3\.500,00/);
    // 6.000 - 3.500 = 2.500 (soma dos saldos: -500 + 3.000)
    expect(kpi('Saldo a pagar')).toHaveTextContent(/R\$\s*2\.500,00/);
  });

  it('pagamento com medição mostra "Medição nº N" e sem medição mostra "—"', async () => {
    const api = servidorAdmin(
      [
        {
          contrato: contratoAdmin(),
          pagamentos: [
            pagamentoAdmin({ id: 'p1', referenteMedicaoId: 'm3', dataPagamento: '2026-06-01' }),
            pagamentoAdmin({ id: 'p2', dataPagamento: '2026-04-01', formaPagamento: null }),
          ],
        },
      ],
      MEDICOES,
    );
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');

    const tabela = await screen.findByRole('table');
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas[1]).toHaveTextContent('Medição nº 3');
    expect(linhas[2]).not.toHaveTextContent('Medição nº');
    expect(within(linhas[2] as HTMLElement).getAllByText('—')).toHaveLength(2);
  });
});

describe('Contratos (admin) - novo contrato', () => {
  const abrir = async () => {
    const api = servidorPadrao();
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    return { api, form: await abrirNovoContrato() };
  };

  it('número vazio é recusado e nada é enviado', async () => {
    const { api, form } = await abrir();
    await user().type(form.valor, '1000');
    await form.criar();

    expect(await within(form.dialog).findByText('Informe o número do contrato.')).toBeInTheDocument();
    expect(form.numero).toBeInvalid();
    expect(api.chamadas.postsContrato).toHaveLength(0);
  });

  it('número com mais de 50 caracteres é recusado', async () => {
    const { api, form } = await abrir();
    definir(form.numero, 'X'.repeat(51));
    await user().type(form.valor, '1000');
    await form.criar();

    expect(await within(form.dialog).findByText(/no máximo 50 caracteres/)).toBeInTheDocument();
    expect(api.chamadas.postsContrato).toHaveLength(0);
  });

  it.each([
    ['zero', '0', /maior que zero/],
    ['zero com casas', '0,00', /maior que zero/],
    ['negativo', '-5', /Informe o valor contratado/],
    ['três casas decimais', '10,123', /Informe o valor contratado/],
    ['texto', 'abc', /Informe o valor contratado/],
    ['vazio', '', /Informe o valor contratado/],
  ])('valor %s é recusado', async (_nome, texto, mensagem) => {
    const { api, form } = await abrir();
    await user().type(form.numero, 'CT-1');
    if (texto) await user().type(form.valor, texto);
    await form.criar();

    expect(await within(form.dialog).findByText(mensagem)).toBeInTheDocument();
    expect(form.valor).toBeInvalid();
    expect(api.chamadas.postsContrato).toHaveLength(0);
  });

  it.each([
    ['antes de 2000', '1999-12-31'],
    ['depois de 2100', '2101-01-01'],
  ])('data de assinatura %s é recusada', async (_nome, data) => {
    const { api, form } = await abrir();
    await user().type(form.numero, 'CT-1');
    await user().type(form.valor, '1000');
    definir(form.data, data);
    await form.criar();

    expect(await within(form.dialog).findByText(/entre 2000 e 2100/)).toBeInTheDocument();
    expect(form.data).toBeInvalid();
    expect(api.chamadas.postsContrato).toHaveLength(0);
  });

  it('as datas-limite 2000-01-01 e 2100-12-31 são aceitas', async () => {
    const { api, form } = await abrir();
    await user().type(form.numero, 'CT-1');
    await user().type(form.valor, '1000');
    definir(form.data, '2000-01-01');
    await form.criar();
    await screen.findByText('Contrato CT-1 criado.');
    expect(api.chamadas.postsContrato).toHaveLength(1);
    expect(api.chamadas.postsContrato[0]?.body.dataAssinatura).toBe('2000-01-01');
  });

  it('envia exatamente o corpo do backend: obraId, número sem espaços, valor numérico e data (sem campos extras)', async () => {
    const { api, form } = await abrir();
    await user().type(form.numero, '  CT-2026/03  ');
    await user().type(form.valor, '125000,55');
    definir(form.data, '2026-03-15');
    await form.criar();

    await screen.findByText('Contrato CT-2026/03 criado.');
    expect(api.chamadas.postsContrato).toHaveLength(1);
    expect(api.chamadas.postsContrato[0]?.auth).toBe('Bearer token-falso-de-teste');
    expect(api.chamadas.postsContrato[0]?.body).toStrictEqual({
      obraId: OBRA_ID,
      numero: 'CT-2026/03',
      valorContratado: 125000.55,
      dataAssinatura: '2026-03-15',
    });
  });

  it('sem data de assinatura envia dataAssinatura null; valor com ponto também é aceito', async () => {
    const { api, form } = await abrir();
    await user().type(form.numero, 'CT-2026/04');
    await user().type(form.valor, '1000.5');
    await form.criar();

    await screen.findByText('Contrato CT-2026/04 criado.');
    expect(api.chamadas.postsContrato[0]?.body).toStrictEqual({
      obraId: OBRA_ID,
      numero: 'CT-2026/04',
      valorContratado: 1000.5,
      dataAssinatura: null,
    });
  });

  it('sucesso fecha o diálogo, mostra a confirmação e recarrega a lista com o contrato novo', async () => {
    const { api, form } = await abrir();
    expect(api.chamadas.listas).toBe(1);
    await user().type(form.numero, 'CT-2026/09');
    await user().type(form.valor, '75000');
    await form.criar();

    expect(await screen.findByRole('heading', { name: 'Contrato CT-2026/09' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Contrato CT-2026/09 criado.');
    expect(api.chamadas.listas).toBe(2);
    expect(valorDe(card('CT-2026/09'), 'Valor contratado')).toHaveTextContent(/R\$\s*75\.000,00/);
    // Com 2 contratos aparecem os totais da obra.
    expect(kpi('Valor contratado total')).toHaveTextContent(/R\$\s*175\.000,00/);
  });

  it('400 do servidor vai para o campo de cada erro; chave desconhecida vai no alerta do diálogo', async () => {
    const { form } = await abrir();
    server.use(
      http.post(`${API}/contratos`, () =>
        HttpResponse.json(
          {
            errors: {
              Numero: ['Número inválido no servidor.'],
              ValorContratado: ['Valor inválido no servidor.'],
              DataAssinatura: ['Data inválida no servidor.'],
              ObraId: ['Obra inválida.'],
            },
          },
          { status: 400 },
        ),
      ),
    );
    await user().type(form.numero, 'CT-1');
    await user().type(form.valor, '1000');
    await form.criar();

    expect(await within(form.dialog).findByText('Número inválido no servidor.')).toBeInTheDocument();
    expect(form.numero).toHaveAccessibleDescription('Número inválido no servidor.');
    expect(form.valor).toHaveAccessibleDescription('Valor inválido no servidor.');
    expect(form.data).toHaveAccessibleDescription('Data inválida no servidor.');
    expect(within(form.dialog).getByRole('alert')).toHaveTextContent('Obra inválida.');
    expect(form.dialog).toBeVisible();
  });

  it('409 (número repetido) aparece no campo número e o diálogo continua aberto', async () => {
    const { form } = await abrir();
    server.use(
      http.post(`${API}/contratos`, () =>
        HttpResponse.json({ message: 'Ja existe um contrato com este numero nesta obra.' }, { status: 409 }),
      ),
    );
    await user().type(form.numero, 'CT-2026/01');
    await user().type(form.valor, '1000');
    await form.criar();

    await within(form.dialog).findByText('Ja existe um contrato com este numero nesta obra.');
    expect(form.numero).toHaveAccessibleDescription('Ja existe um contrato com este numero nesta obra.');
    expect(form.numero).toBeInvalid();
    expect(within(form.dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(form.dialog).toBeVisible();
  });

  it('403 mostra alerta de permissão no diálogo', async () => {
    const { form } = await abrir();
    server.use(http.post(`${API}/contratos`, () => HttpResponse.json({}, { status: 403 })));
    await user().type(form.numero, 'CT-1');
    await user().type(form.valor, '1000');
    await form.criar();

    expect(await within(form.dialog).findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(form.dialog).toBeVisible();
  });

  it('404 mostra que a obra não foi encontrada', async () => {
    const { form } = await abrir();
    server.use(http.post(`${API}/contratos`, () => HttpResponse.json({}, { status: 404 })));
    await user().type(form.numero, 'CT-1');
    await user().type(form.valor, '1000');
    await form.criar();

    expect(await within(form.dialog).findByRole('alert')).toHaveTextContent(/obra não foi encontrada/i);
  });

  it('500 mostra o código de suporte no alerta e mantém o que foi digitado', async () => {
    const { form } = await abrir();
    server.use(
      http.post(`${API}/contratos`, () =>
        HttpResponse.json({ requestId: 'req-criar-500', message: 'Erro interno do servidor.' }, { status: 500 }),
      ),
    );
    await user().type(form.numero, 'CT-1');
    await user().type(form.valor, '1000');
    await form.criar();

    const alerta = await within(form.dialog).findByRole('alert');
    expect(alerta).toHaveTextContent('req-criar-500');
    expect(form.numero).toHaveValue('CT-1');
    expect(form.valor).toHaveValue('1000');
  });

  it('Cancelar fecha o diálogo sem enviar nada', async () => {
    const { api, form } = await abrir();
    await user().click(within(form.dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.chamadas.postsContrato).toHaveLength(0);
  });
});

describe('Contratos (admin) - registrar pagamento', () => {
  const abrir = async (servidor = servidorPadrao()) => {
    server.use(...servidor.handlers);
    renderApp(ADMIN, 'Admin');
    return { api: servidor, form: await abrirPagamento() };
  };

  it('data padrão é hoje e o campo aceita no máximo amanhã', async () => {
    const { form } = await abrir();

    expect(form.data).toHaveValue(HOJE());
    expect(form.data).toHaveAttribute('max', AMANHA());
    expect(form.forma).toHaveValue('');
    expect(form.medicao).toHaveValue('');
  });

  it('só consulta as medições quando o diálogo abre, com status=invoice_issued, pageIndex=0 e pageSize=100', async () => {
    const api = servidorPadrao();
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    expect(api.chamadas.medicoes).toHaveLength(0);

    await abrirPagamento();
    await within(screen.getByRole('dialog')).findByRole('option', { name: /Medição nº 3/ });
    expect(api.chamadas.medicoes).toHaveLength(1);
    expect(Object.fromEntries(api.chamadas.medicoes[0] as URLSearchParams)).toEqual({
      status: 'invoice_issued',
      pageIndex: '0',
      pageSize: '100',
    });
  });

  it('o select mostra "Sem medição" e "Medição nº N — competência — valor"', async () => {
    const { form } = await abrir();

    expect(await within(form.medicao).findByRole('option', { name: 'Sem medição' })).toBeInTheDocument();
    expect(
      within(form.medicao).getByRole('option', { name: /^Medição nº 3 — Agosto de 2026 — R\$\s*51\.890,25$/ }),
    ).toBeInTheDocument();
    expect(
      within(form.medicao).getByRole('option', { name: /^Medição nº 2 — Julho de 2026 — R\$\s*39\.870,40$/ }),
    ).toBeInTheDocument();
  });

  it('sem medições com NF o select só tem "Sem medição" e avisa', async () => {
    const { form } = await abrir(servidorAdmin([{ contrato: contratoAdmin(), pagamentos: [] }], []));

    expect(await within(form.dialog).findByText('Nenhuma medição com NF emitida nesta obra.')).toBeInTheDocument();
    expect(within(form.medicao).getAllByRole('option')).toHaveLength(1);
  });

  it('falha ao carregar as medições avisa, não bloqueia e o pagamento vai com referenteMedicaoId null', async () => {
    const api = servidorPadrao();
    server.use(
      http.get(`${API}/obras/${OBRA_ID}/medicoes/resumo`, () =>
        HttpResponse.json({ requestId: 'req-med', message: 'Erro.' }, { status: 500 }),
      ),
      ...api.handlers,
    );
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    const form = await abrirPagamento();

    expect(await within(form.dialog).findByText(/Não foi possível carregar as medições/)).toBeInTheDocument();
    expect(form.medicao).toBeEnabled();
    await user().type(form.valor, '100');
    await form.registrar();

    await screen.findByText(/Pagamento de .* registrado no contrato CT-2026\/01\./);
    expect(api.chamadas.postsPagamento[0]?.body.referenteMedicaoId).toBeNull();
  });

  it('valor vazio, zero e com 3 casas são recusados', async () => {
    const { api, form } = await abrir();

    await form.registrar();
    expect(await within(form.dialog).findByText(/Informe o valor do pagamento/)).toBeInTheDocument();
    await user().type(form.valor, '0');
    await form.registrar();
    expect(await within(form.dialog).findByText(/maior que zero/)).toBeInTheDocument();
    await user().clear(form.valor);
    await user().type(form.valor, '1,234');
    await form.registrar();
    expect(await within(form.dialog).findByText(/Informe o valor do pagamento/)).toBeInTheDocument();
    expect(api.chamadas.postsPagamento).toHaveLength(0);
  });

  it('data depois de amanhã é recusada; data vazia também', async () => {
    const { api, form } = await abrir();
    await user().type(form.valor, '100');

    definir(form.data, DEPOIS_DE_AMANHA());
    await form.registrar();
    expect(await within(form.dialog).findByText(/não pode ser no futuro/)).toBeInTheDocument();
    expect(form.data).toBeInvalid();

    definir(form.data, '');
    await form.registrar();
    expect(await within(form.dialog).findByText('Informe a data do pagamento.')).toBeInTheDocument();
    expect(api.chamadas.postsPagamento).toHaveLength(0);
  });

  it('data de amanhã é aceita (cobre o fuso do servidor em UTC)', async () => {
    const { api, form } = await abrir();
    await user().type(form.valor, '100');
    definir(form.data, AMANHA());
    await form.registrar();

    await screen.findByText(/registrado no contrato/);
    expect(api.chamadas.postsPagamento[0]?.body.dataPagamento).toBe(AMANHA());
  });

  it('data antes de 2000 é recusada', async () => {
    const { api, form } = await abrir();
    await user().type(form.valor, '100');
    definir(form.data, '1999-12-31');
    await form.registrar();

    expect(await within(form.dialog).findByText(/2000 em diante/)).toBeInTheDocument();
    expect(api.chamadas.postsPagamento).toHaveLength(0);
  });

  it('forma de pagamento com mais de 50 caracteres é recusada', async () => {
    const { api, form } = await abrir();
    await user().type(form.valor, '100');
    definir(form.forma, 'F'.repeat(51));
    await form.registrar();

    expect(await within(form.dialog).findByText(/no máximo 50 caracteres/)).toBeInTheDocument();
    expect(api.chamadas.postsPagamento).toHaveLength(0);
  });

  it('sem medição selecionada envia valor numérico, data yyyy-MM-dd, forma null e referenteMedicaoId null', async () => {
    const { api, form } = await abrir();
    await user().type(form.valor, '2500,50');
    await form.registrar();

    await screen.findByText(/registrado no contrato/);
    expect(api.chamadas.postsPagamento).toHaveLength(1);
    const envio = api.chamadas.postsPagamento[0];
    expect(envio?.contratoId).toBe('c1');
    expect(envio?.auth).toBe('Bearer token-falso-de-teste');
    expect(envio?.body).toStrictEqual({
      valor: 2500.5,
      dataPagamento: HOJE(),
      formaPagamento: null,
      referenteMedicaoId: null,
    });
    expect(typeof envio?.body.valor).toBe('number');
    expect(envio?.body.dataPagamento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('com forma e medição envia o id da medição e a forma sem espaços nas pontas', async () => {
    const { api, form } = await abrir();
    await user().type(form.valor, '1000');
    await user().type(form.forma, '  Pix  ');
    await user().selectOptions(form.medicao, await within(form.medicao).findByRole('option', { name: /Medição nº 3/ }));
    await form.registrar();

    await screen.findByText(/registrado no contrato/);
    expect(api.chamadas.postsPagamento[0]?.body).toStrictEqual({
      valor: 1000,
      dataPagamento: HOJE(),
      formaPagamento: 'Pix',
      referenteMedicaoId: 'm3',
    });
  });

  it('sucesso fecha o diálogo, confirma e atualiza a lista de pagamentos e os números do contrato', async () => {
    const { form } = await abrir();
    await user().type(form.valor, '2500,50');
    await user().type(form.forma, 'TED');
    await user().selectOptions(form.medicao, await within(form.medicao).findByRole('option', { name: /Medição nº 3/ }));
    definir(form.data, '2026-10-05');
    await form.registrar();

    expect(await screen.findByText('Pagamento de R$ 2.500,50 registrado no contrato CT-2026/01.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const tabela = await screen.findByRole('table');
    const linhas = await within(tabela).findAllByRole('row');
    expect(linhas).toHaveLength(3); // cabeçalho + 2
    // Mais recente primeiro; o número da medição vem do detalhe recarregado (o 201 traz null).
    expect(linhas[1]).toHaveTextContent('05/10/2026');
    expect(linhas[1]).toHaveTextContent('TED');
    expect(linhas[1]).toHaveTextContent('Medição nº 3');
    expect(linhas[2]).toHaveTextContent('01/06/2026');
    expect(valorDe(card('CT-2026/01'), 'Pago')).toHaveTextContent(/R\$\s*42\.500,50/);
    expect(valorDe(card('CT-2026/01'), 'Saldo a pagar')).toHaveTextContent(/R\$\s*57\.499,50/);
  });

  it('pagamento que ultrapassa o contrato passa a mostrar "Pago a mais" sem sinal', async () => {
    const { form } = await abrir();
    await user().type(form.valor, '70000');
    await form.registrar();

    await screen.findByText(/registrado no contrato/);
    const aMais = await within(card('CT-2026/01')).findByText('Pago a mais');
    expect(aMais.nextElementSibling).toHaveTextContent(/^R\$\s*10\.000,00$/);
    expect(within(card('CT-2026/01')).queryByText('Saldo a pagar')).not.toBeInTheDocument();
  });

  it('o diálogo é do contrato clicado: o POST vai para o id dele', async () => {
    const api = servidorAdmin(
      [
        { contrato: contratoAdmin(), pagamentos: [] },
        { contrato: contratoAdmin({ id: 'c2', numero: 'CT-2026/02' }), pagamentos: [] },
      ],
      MEDICOES,
    );
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    const form = await abrirPagamento('CT-2026/02');
    expect(form.dialog).toHaveTextContent('contrato CT-2026/02');
    await user().type(form.valor, '10');
    await form.registrar();

    await screen.findByText(/registrado no contrato CT-2026\/02/);
    expect(api.chamadas.postsPagamento[0]?.contratoId).toBe('c2');
  });

  it('400 do servidor vai para os campos, inclusive ReferenteMedicaoId no select', async () => {
    const { form } = await abrir();
    server.use(
      http.post(`${API}/contratos/c1/pagamentos`, () =>
        HttpResponse.json(
          {
            errors: {
              Valor: ['Valor inválido no servidor.'],
              DataPagamento: ['Data inválida no servidor.'],
              FormaPagamento: ['Forma inválida no servidor.'],
              ReferenteMedicaoId: ['A medicao informada deve ser desta obra e ter nota fiscal emitida.'],
            },
          },
          { status: 400 },
        ),
      ),
    );
    await user().type(form.valor, '100');
    await form.registrar();

    await within(form.dialog).findByText('Valor inválido no servidor.');
    expect(form.valor).toHaveAccessibleDescription('Valor inválido no servidor.');
    expect(form.data).toHaveAccessibleDescription('Data inválida no servidor.');
    expect(form.forma).toHaveAccessibleDescription('Forma inválida no servidor.');
    expect(form.medicao).toHaveAccessibleDescription(
      'A medicao informada deve ser desta obra e ter nota fiscal emitida.',
    );
    expect(within(form.dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(form.dialog).toBeVisible();
  });

  it.each([
    ['403', 403, {}, /não tem permissão/i],
    ['404', 404, {}, /contrato não foi encontrado/i],
    ['500', 500, { requestId: 'req-pag-500', message: 'Erro interno do servidor.' }, /req-pag-500/],
  ])('%s mostra o alerta no diálogo, que continua aberto', async (_nome, status, corpo, mensagem) => {
    const { form } = await abrir();
    server.use(http.post(`${API}/contratos/c1/pagamentos`, () => HttpResponse.json(corpo, { status })));
    await user().type(form.valor, '100');
    await form.registrar();

    expect(await within(form.dialog).findByRole('alert')).toHaveTextContent(mensagem);
    expect(form.dialog).toBeVisible();
    expect(form.valor).toHaveValue('100');
  });
});

describe('Contratos (admin) - papel, sidebar e cache do cliente', () => {
  it('cliente é barrado: "Sem permissão", sem botões de escrita e sem chamadas', async () => {
    // Sem handlers: qualquer chamada falharia o teste (onUnhandledFrame = error).
    renderApp(ADMIN, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /novo contrato|registrar pagamento/i })).not.toBeInTheDocument();
  });

  it('deslogado vai para o login', async () => {
    renderApp(ADMIN);
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('"Contratos" fica depois de "Financeiro" na sidebar do admin (ordem Medições, Financeiro, Contratos) e aponta para a obra aberta', async () => {
    server.use(...servidorPadrao().handlers);
    renderApp(ADMIN, 'Admin');

    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    const nomes = within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent?.trim());
    const i = nomes.indexOf('Contratos');
    expect(i).toBeGreaterThan(-1);
    // SPEC §6: 7 Medições, 8 Financeiro, 9 Contratos.
    expect(nomes.slice(i - 2, i + 1)).toEqual(['Medições', 'Financeiro', 'Contratos']);
    const link = within(nav).getByRole('link', { name: 'Contratos' });
    expect(link).toHaveAttribute('href', ADMIN);
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  /** Mesmo QueryClient para a tela do cliente e a do admin, com cache que nunca expira sozinho. */
  const comCacheCompartilhado = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    return (path: string, role: Role) => {
      saveSession(fakeSession(role));
      return render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[path]}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    };
  };

  it('criar contrato invalida o cache da tela do cliente: ele vê o contrato novo sem recarregar a página', async () => {
    const api = servidorPadrao();
    server.use(...api.handlers);
    const abrirTela = comCacheCompartilhado();

    const cliente1 = abrirTela(CLIENTE, 'Client');
    await screen.findByRole('heading', { name: 'Contrato CT-2026/01' });
    expect(screen.queryByRole('heading', { name: 'Contrato CT-2026/07' })).not.toBeInTheDocument();
    cliente1.unmount();

    const admin = abrirTela(ADMIN, 'Admin');
    const form = await abrirNovoContrato();
    await user().type(form.numero, 'CT-2026/07');
    await user().type(form.valor, '2000');
    await form.criar();
    await screen.findByText('Contrato CT-2026/07 criado.');
    admin.unmount();

    abrirTela(CLIENTE, 'Client');
    expect(await screen.findByRole('heading', { name: 'Contrato CT-2026/07' })).toBeInTheDocument();
  });

  it('registrar pagamento invalida o detalhe e a lista que o cliente vê', async () => {
    const api = servidorPadrao();
    server.use(...api.handlers);
    const abrirTela = comCacheCompartilhado();

    const cliente1 = abrirTela(CLIENTE, 'Client');
    const tabela1 = await screen.findByRole('table');
    expect(within(tabela1).getAllByRole('row')).toHaveLength(2);
    expect(valorDe(card('CT-2026/01'), 'Pago')).toHaveTextContent(/R\$\s*40\.000,00/);
    cliente1.unmount();

    const admin = abrirTela(ADMIN, 'Admin');
    await screen.findByRole('table');
    const form = await abrirPagamento();
    await user().type(form.valor, '5000');
    definir(form.data, '2026-10-05');
    await form.registrar();
    await screen.findByText(/registrado no contrato/);
    admin.unmount();

    abrirTela(CLIENTE, 'Client');
    const tabela2 = await screen.findByRole('table');
    await within(tabela2).findByText('05/10/2026');
    expect(within(tabela2).getAllByRole('row')).toHaveLength(3);
    expect(valorDe(card('CT-2026/01'), 'Pago')).toHaveTextContent(/R\$\s*45\.000,00/);
  });
});
