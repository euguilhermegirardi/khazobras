import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/auth/AuthContext';
import type { Role } from '@/interfaces/auth';
import { AppRoutes } from '@/routes/AppRoutes';
import { saveSession } from '@/services/session';
import { fakeSession, renderApp } from '@/test/helpers';
import {
  ADMIN,
  anexo,
  CLIENTE,
  lancamento,
  lancamentos,
  type ServidorFinanceiro,
  servidorFinanceiro,
} from '@/test/financeiroAdmin';
import { API, server } from '@/test/server';
import { toDateOnly } from '@/utils/dates';

const POST = `${API}/financeiro/lancamentos`;
const user = () => userEvent.setup();
const definir = (campo: HTMLElement, valor: string) => fireEvent.change(campo, { target: { value: valor } });
const kpi = (rotulo: string) => screen.getByText(rotulo, { selector: 'p' }).parentElement as HTMLElement;
const hoje = () => toDateOnly(new Date());

async function abrirNovo() {
  await user().click(await screen.findByRole('button', { name: '+ Novo lançamento' }));
  const dialog = await screen.findByRole('dialog', { name: 'Novo lançamento' });
  return camposDo(dialog, 'Criar lançamento');
}

async function abrirEditar(descricao: string) {
  await user().click(await screen.findByRole('button', { name: `Editar lançamento: ${descricao}` }));
  const dialog = await screen.findByRole('dialog', { name: 'Editar lançamento' });
  return camposDo(dialog, 'Salvar alterações');
}

function camposDo(dialog: HTMLElement, botao: string) {
  return {
    dialog,
    categoria: within(dialog).getByLabelText('Categoria') as HTMLSelectElement,
    valor: within(dialog).getByLabelText('Valor (R$)') as HTMLInputElement,
    data: within(dialog).getByLabelText('Data do lançamento') as HTMLInputElement,
    competencia: within(dialog).getByLabelText('Competência') as HTMLInputElement,
    descricao: within(dialog).getByLabelText('Descrição') as HTMLInputElement,
    liberar: within(dialog).getByLabelText('Liberar ao cliente') as HTMLInputElement,
    enviar: () => user().click(within(dialog).getByRole('button', { name: botao })),
  };
}

type Form = Awaited<ReturnType<typeof abrirNovo>>;

/** Preenche um lançamento válido (categoria Mão de obra, R$ 1.500,50, 10/09/2026, competência 2026-09). */
async function preencher(f: Form, over: Partial<Record<'valor' | 'descricao' | 'data' | 'competencia', string>> = {}) {
  await user().selectOptions(f.categoria, 'mao_de_obra');
  await user().type(f.descricao, over.descricao ?? '  Pedreiro - semana 2  ');
  await user().type(f.valor, over.valor ?? '1500,50');
  definir(f.data, over.data ?? '2026-09-10');
  definir(f.competencia, over.competencia ?? '2026-09');
}

const erroDoCampo = (campo: HTMLElement) => campo.getAttribute('aria-describedby');
const mensagemDe = (campo: HTMLElement) => {
  const id = erroDoCampo(campo);
  return id ? (document.getElementById(id)?.textContent ?? '') : '';
};

async function abrirTela(api: ServidorFinanceiro) {
  server.use(...api.handlers);
  renderApp(ADMIN, 'Admin');
  await screen.findByRole('table');
}

describe('Financeiro (admin) - novo lançamento: formulário', () => {
  it('abre com data de hoje, competência do mês de hoje, categoria a escolher e a flag FALSA com o texto explicativo', async () => {
    await abrirTela(servidorFinanceiro(lancamentos(2)));
    const f = await abrirNovo();

    expect(f.data).toHaveValue(hoje());
    expect(f.competencia).toHaveValue(hoje().slice(0, 7));
    expect(f.categoria).toHaveValue('');
    expect(f.valor).toHaveValue('');
    expect(f.descricao).toHaveValue('');
    expect(f.liberar).not.toBeChecked();
    // O texto explica o padrão e é a descrição acessível da flag.
    expect(f.liberar).toHaveAccessibleDescription(
      /O cliente só vê os lançamentos liberados.*Por padrão o lançamento fica oculto\./,
    );
    expect(within(f.dialog).getByText(/nasce oculto para o cliente/)).toBeInTheDocument();
    // Comprovantes só ao editar (precisam do id).
    expect(within(f.dialog).queryByText('Comprovantes')).not.toBeInTheDocument();
    expect(within(f.dialog).queryByLabelText('Enviar comprovante')).not.toBeInTheDocument();
  });

  it('as opções de categoria vêm de GET /financeiro/categorias', async () => {
    await abrirTela(servidorFinanceiro(lancamentos(1)));
    const f = await abrirNovo();
    expect(
      within(f.categoria)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Escolha…', 'Mão de obra', 'Material', 'Equipamento']);
  });

  it('enviar vazio mostra o erro de cada campo e não chama a API', async () => {
    const api = servidorFinanceiro(lancamentos(2));
    await abrirTela(api);
    const f = await abrirNovo();
    definir(f.data, '');
    definir(f.competencia, '');

    await f.enviar();

    expect(mensagemDe(f.categoria)).toBe('Escolha a categoria.');
    expect(mensagemDe(f.descricao)).toBe('Informe a descrição do lançamento.');
    expect(mensagemDe(f.valor)).toMatch(/Informe o valor/);
    expect(mensagemDe(f.data)).toBe('Informe a data do lançamento.');
    expect(mensagemDe(f.competencia)).toBe('Informe o mês de competência.');
    for (const campo of [f.categoria, f.descricao, f.valor, f.data, f.competencia]) {
      expect(campo).toHaveAttribute('aria-invalid', 'true');
    }
    expect(f.dialog).toBeVisible();
    expect(api.chamadas.posts).toHaveLength(0);
  });

  it.each([
    ['0', /maior que zero/],
    ['0,00', /maior que zero/],
    ['-5', /Informe o valor/],
    ['10,999', /Informe o valor/],
    ['abc', /Informe o valor/],
    ['1000000000000', /excede o limite/],
    ['999999999999,991', /Informe o valor/],
  ])('valor "%s" é recusado no formulário', async (texto, erro) => {
    const api = servidorFinanceiro(lancamentos(1));
    await abrirTela(api);
    const f = await abrirNovo();
    await preencher(f, { valor: texto });

    await f.enviar();

    expect(mensagemDe(f.valor)).toMatch(erro);
    expect(api.chamadas.posts).toHaveLength(0);
  });

  it.each(['0,01', '1500.5', '999999999999,99', '12345678,90'])('valor "%s" é aceito', async (texto) => {
    const api = servidorFinanceiro(lancamentos(1));
    await abrirTela(api);
    const f = await abrirNovo();
    await preencher(f, { valor: texto });

    await f.enviar();

    await waitFor(() => expect(api.chamadas.posts).toHaveLength(1));
    expect(api.chamadas.posts[0]?.body.valor).toBe(Number(texto.replace(',', '.')));
  });

  it('descrição: até 255 caracteres (limite do backend); 256 é recusada', async () => {
    const api = servidorFinanceiro(lancamentos(1));
    await abrirTela(api);
    const f = await abrirNovo();
    expect(f.descricao).toHaveAttribute('maxlength', '255');
    await preencher(f);

    definir(f.descricao, 'x'.repeat(256));
    await f.enviar();
    expect(mensagemDe(f.descricao)).toMatch(/no máximo 255 caracteres/);
    expect(api.chamadas.posts).toHaveLength(0);

    definir(f.descricao, 'x'.repeat(255));
    await f.enviar();
    await waitFor(() => expect(api.chamadas.posts).toHaveLength(1));
    expect(String(api.chamadas.posts[0]?.body.descricao)).toHaveLength(255);
  });

  it('descrição só com espaços é recusada', async () => {
    const api = servidorFinanceiro(lancamentos(1));
    await abrirTela(api);
    const f = await abrirNovo();
    await preencher(f);
    definir(f.descricao, '    ');
    await f.enviar();
    expect(mensagemDe(f.descricao)).toBe('Informe a descrição do lançamento.');
    expect(api.chamadas.posts).toHaveLength(0);
  });

  it('data e competência fora de 2000..2100 são recusadas', async () => {
    const api = servidorFinanceiro(lancamentos(1));
    await abrirTela(api);
    const f = await abrirNovo();
    await preencher(f, { data: '1999-12-31', competencia: '2101-01' });

    await f.enviar();

    expect(mensagemDe(f.data)).toMatch(/entre 2000 e 2100/);
    expect(mensagemDe(f.competencia)).toMatch(/entre 2000 e 2100/);
    expect(api.chamadas.posts).toHaveLength(0);
  });
});

describe('Financeiro (admin) - novo lançamento: envio', () => {
  it('corpo do POST: categoria snake_case, competência no dia 1, obraId da rota, flag falsa e sem createdByUserId', async () => {
    const api = servidorFinanceiro(lancamentos(2));
    await abrirTela(api);
    const f = await abrirNovo();
    await preencher(f);

    await f.enviar();

    await waitFor(() => expect(api.chamadas.posts).toHaveLength(1));
    const post = api.chamadas.posts[0];
    expect(post?.auth).toBe('Bearer token-falso-de-teste');
    expect(post?.body).toEqual({
      obraId: '33333333-3333-3333-3333-333333333333',
      categoria: 'mao_de_obra',
      descricao: 'Pedreiro - semana 2',
      valor: 1500.5,
      dataLancamento: '2026-09-10',
      mesCompetencia: '2026-09-01',
      visivelCliente: false,
    });
    expect(post?.body).not.toHaveProperty('createdByUserId');
  });

  it('marcar "Liberar ao cliente" manda visivelCliente=true', async () => {
    const api = servidorFinanceiro(lancamentos(2));
    await abrirTela(api);
    const f = await abrirNovo();
    await preencher(f);
    await user().click(f.liberar);
    expect(f.liberar).toBeChecked();

    await f.enviar();

    await waitFor(() => expect(api.chamadas.posts).toHaveLength(1));
    expect(api.chamadas.posts[0]?.body.visivelCliente).toBe(true);
  });

  it.each([
    ['Material', 'material'],
    ['Equipamento', 'equipamento'],
  ])('categoria %s vai como %s', async (rotulo, valor) => {
    const api = servidorFinanceiro(lancamentos(1));
    await abrirTela(api);
    const f = await abrirNovo();
    await preencher(f);
    await user().selectOptions(f.categoria, rotulo);

    await f.enviar();

    await waitFor(() => expect(api.chamadas.posts).toHaveLength(1));
    expect(api.chamadas.posts[0]?.body.categoria).toBe(valor);
  });

  it('sucesso: fecha o diálogo, avisa com o valor, e a lista e o resumo já mostram o novo lançamento', async () => {
    const api = servidorFinanceiro([lancamento('a', { descricao: 'Antigo', valor: 100, visivelCliente: true })]);
    await abrirTela(api);
    await waitFor(() => expect(kpi('Total lançado')).toHaveTextContent('1 lançamento'));
    const f = await abrirNovo();
    await preencher(f);

    await f.enviar();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/Lançamento de R\$\s*1\.500,50 criado\./)).toBeInTheDocument();
    const linha = await screen.findByRole('row', { name: /Pedreiro - semana 2/ });
    expect(linha).toHaveTextContent('10/09/2026');
    expect(linha).toHaveTextContent('Setembro de 2026');
    expect(linha).toHaveTextContent('Mão de obra');
    expect(linha).toHaveTextContent('Oculto');
    await waitFor(() => expect(kpi('Total lançado')).toHaveTextContent('2 lançamentos'));
    expect(kpi('Total lançado')).toHaveTextContent(/R\$\s*1\.600,50/);
    expect(kpi('Não liberado')).toHaveTextContent(/R\$\s*1\.500,50/);
  });

  it('obra vazia: criar o primeiro lançamento troca o vazio pela tabela', async () => {
    const api = servidorFinanceiro([]);
    await abrirTelaVazia(api);
    const f = await abrirNovo();
    await preencher(f);

    await f.enviar();

    expect(await screen.findByRole('table')).toHaveTextContent('Pedreiro - semana 2');
    expect(screen.queryByText('Nenhum lançamento nesta obra ainda.')).not.toBeInTheDocument();
  });

  it('Cancelar fecha sem chamar a API', async () => {
    const api = servidorFinanceiro(lancamentos(1));
    await abrirTela(api);
    const f = await abrirNovo();
    await preencher(f);

    await user().click(within(f.dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.posts).toHaveLength(0);
  });

  it('Esc fecha o diálogo e uma nova abertura começa limpa', async () => {
    await abrirTela(servidorFinanceiro(lancamentos(1)));
    const f = await abrirNovo();
    await user().type(f.descricao, 'Rascunho');
    await user().keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const novo = await abrirNovo();
    expect(novo.descricao).toHaveValue('');
  });

  it('durante o envio o botão mostra "Salvando…" e fica desabilitado (sem POST duplo)', async () => {
    const api = servidorFinanceiro(lancamentos(1));
    await abrirTela(api);
    let liberar: () => void = () => {};
    const trava = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.post(POST, async () => {
        await trava;
        return HttpResponse.json(lancamento('novo', { descricao: 'Pedreiro - semana 2' }), { status: 201 });
      }),
    );
    const f = await abrirNovo();
    await preencher(f);

    await f.enviar();

    const botao = await within(f.dialog).findByRole('button', { name: 'Salvando…' });
    expect(botao).toBeDisabled();
    expect(within(f.dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    liberar();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('o lançamento criado e liberado aparece para o cliente sem recarregar a página (cache do cliente invalidado)', async () => {
    const api = servidorFinanceiro([lancamento('a', { descricao: 'Já liberado', visivelCliente: true })]);
    server.use(...api.handlers);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const abrir = (path: string, role: Role) => {
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

    const cliente1 = abrir(CLIENTE, 'Client');
    await screen.findByText('Já liberado');
    expect(screen.queryByText('Cimento novo')).not.toBeInTheDocument();
    cliente1.unmount();

    const admin = abrir(ADMIN, 'Admin');
    await screen.findByRole('table');
    const f = await abrirNovo();
    await preencher(f, { descricao: 'Cimento novo' });
    await user().click(f.liberar);
    await f.enviar();
    await screen.findByText(/criado\./);
    admin.unmount();

    abrir(CLIENTE, 'Client');
    expect(await screen.findByText('Cimento novo')).toBeInTheDocument();
  });
});

/** Obra sem lançamentos: não há tabela para esperar. */
async function abrirTelaVazia(api: ServidorFinanceiro) {
  server.use(...api.handlers);
  renderApp(ADMIN, 'Admin');
  await screen.findByText('Nenhum lançamento nesta obra ainda.');
}

describe('Financeiro (admin) - novo lançamento: erros do servidor', () => {
  const comPost = async (resposta: () => Response) => {
    const api = servidorFinanceiro(lancamentos(1));
    server.use(http.post(POST, resposta), ...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    const f = await abrirNovo();
    await preencher(f);
    await f.enviar();
    return { f, api };
  };

  it('400 com errors por campo aparece em cada campo e o diálogo continua aberto com os valores', async () => {
    const { f } = await comPost(() =>
      HttpResponse.json(
        {
          title: 'One or more validation errors occurred.',
          status: 400,
          errors: {
            Categoria: ['Categoria invalida.'],
            Descricao: ['A descricao e obrigatoria.'],
            Valor: ['O valor deve ser maior que zero.'],
            DataLancamento: ['A data do lancamento e invalida.'],
            MesCompetencia: ['A competencia deve ser o primeiro dia do mes.'],
          },
        },
        { status: 400 },
      ),
    );

    await waitFor(() => expect(mensagemDe(f.valor)).toBe('O valor deve ser maior que zero.'));
    expect(mensagemDe(f.categoria)).toBe('Categoria invalida.');
    expect(mensagemDe(f.descricao)).toBe('A descricao e obrigatoria.');
    expect(mensagemDe(f.data)).toBe('A data do lancamento e invalida.');
    expect(mensagemDe(f.competencia)).toBe('A competencia deve ser o primeiro dia do mes.');
    expect(f.dialog).toBeVisible();
    expect(f.valor).toHaveValue('1500,50');
    expect(within(f.dialog).getByRole('button', { name: 'Criar lançamento' })).toBeEnabled();
    // Erros só de campo não abrem Alert.
    expect(within(f.dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('400 com erro fora dos campos (ex.: ObraId) vai para um Alert no diálogo', async () => {
    const { f } = await comPost(() =>
      HttpResponse.json({ errors: { ObraId: ['A obra e obrigatoria.'] } }, { status: 400 }),
    );
    expect(await within(f.dialog).findByRole('alert')).toHaveTextContent('A obra e obrigatoria.');
    expect(f.dialog).toBeVisible();
  });

  it('400 com { message } vai para o Alert', async () => {
    const { f } = await comPost(() => HttpResponse.json({ message: 'Mensagem do servidor.' }, { status: 400 }));
    expect(await within(f.dialog).findByRole('alert')).toHaveTextContent('Mensagem do servidor.');
  });

  it('403: Alert de permissão, diálogo aberto', async () => {
    const { f } = await comPost(() => HttpResponse.json({}, { status: 403 }));
    expect(await within(f.dialog).findByRole('alert')).toHaveTextContent(/não tem permissão/i);
    expect(f.dialog).toBeVisible();
  });

  it('404 (obra inexistente): Alert, diálogo aberto, sem aviso de sucesso', async () => {
    const { f } = await comPost(() => HttpResponse.json({}, { status: 404 }));
    expect(await within(f.dialog).findByRole('alert')).toBeInTheDocument();
    expect(f.dialog).toBeVisible();
    expect(screen.queryByText(/criado\./)).not.toBeInTheDocument();
  });

  it('500: Alert com o código de suporte; reenviar depois do erro funciona', async () => {
    const { f, api } = await comPost(() =>
      HttpResponse.json({ requestId: 'req-post', message: 'Erro interno do servidor.' }, { status: 500 }),
    );
    expect(await within(f.dialog).findByRole('alert')).toHaveTextContent('req-post');

    server.resetHandlers();
    server.use(...api.handlers);
    await f.enviar();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadas.posts).toHaveLength(1);
  });

  it('um erro de campo do servidor some quando o envio seguinte dá certo', async () => {
    const api = servidorFinanceiro(lancamentos(1));
    server.use(
      http.post(POST, () => HttpResponse.json({ errors: { Valor: ['Valor ruim.'] } }, { status: 400 }), { once: true }),
      ...api.handlers,
    );
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    const f = await abrirNovo();
    await preencher(f);
    await f.enviar();
    await waitFor(() => expect(mensagemDe(f.valor)).toBe('Valor ruim.'));

    await f.enviar();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Financeiro (admin) - editar lançamento', () => {
  const original = lancamento('e1', {
    categoria: 'MaoDeObra',
    descricao: 'Pedreiro - semana 2',
    valor: 2300.75,
    dataLancamento: '2026-10-05',
    mesCompetencia: '2026-10-01',
    visivelCliente: true,
  });

  it('abre com os valores atuais: categoria PascalCase vira a opção snake_case, valor com vírgula, flag atual', async () => {
    await abrirTela(servidorFinanceiro([original]));
    const f = await abrirEditar('Pedreiro - semana 2');

    expect(f.categoria).toHaveValue('mao_de_obra');
    expect(f.valor).toHaveValue('2300,75');
    expect(f.data).toHaveValue('2026-10-05');
    expect(f.competencia).toHaveValue('2026-10');
    expect(f.descricao).toHaveValue('Pedreiro - semana 2');
    expect(f.liberar).toBeChecked();
    expect(within(f.dialog).getByRole('heading', { name: 'Comprovantes' })).toBeInTheDocument();
  });

  it('valor inteiro e com uma casa abrem sem zeros inventados nem ponto', async () => {
    await abrirTela(
      servidorFinanceiro([
        lancamento('i', { descricao: 'Inteiro', valor: 1500 }),
        lancamento('c', { descricao: 'Casa', valor: 12.5 }),
      ]),
    );
    const a = await abrirEditar('Inteiro');
    expect(a.valor).toHaveValue('1500');
    await user().click(within(a.dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const b = await abrirEditar('Casa');
    expect(b.valor).toHaveValue('12,5');
  });

  it('PUT com todos os campos e a flag atual explícita, sem obraId; avisa, fecha e a lista reflete', async () => {
    const api = servidorFinanceiro([original, lancamento('e2', { descricao: 'Outro' })]);
    await abrirTela(api);
    const f = await abrirEditar('Pedreiro - semana 2');
    await user().clear(f.valor);
    await user().type(f.valor, '2400');
    await user().selectOptions(f.categoria, 'equipamento');

    await f.enviar();

    await waitFor(() => expect(api.chamadas.puts).toHaveLength(1));
    expect(api.chamadas.puts[0]).toEqual({
      id: 'e1',
      body: {
        categoria: 'equipamento',
        descricao: 'Pedreiro - semana 2',
        valor: 2400,
        dataLancamento: '2026-10-05',
        mesCompetencia: '2026-10-01',
        visivelCliente: true,
      },
    });
    expect(api.chamadas.puts[0]?.body).not.toHaveProperty('obraId');
    expect(api.chamadas.puts[0]?.body).not.toHaveProperty('createdByUserId');
    expect(api.chamadas.posts).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/Lançamento de R\$\s*2\.400,00 atualizado\./)).toBeInTheDocument();
    const linha = await screen.findByRole('row', { name: /Pedreiro - semana 2/ });
    expect(linha).toHaveTextContent(/R\$\s*2\.400,00/);
    expect(linha).toHaveTextContent('Equipamento');
    expect(linha).toHaveTextContent('Liberado');
  });

  it('lançamento oculto continua oculto no PUT (flag false explícita)', async () => {
    const api = servidorFinanceiro([lancamento('o1', { descricao: 'Oculto', visivelCliente: false })]);
    await abrirTela(api);
    const f = await abrirEditar('Oculto');
    expect(f.liberar).not.toBeChecked();

    await f.enviar();

    await waitFor(() => expect(api.chamadas.puts).toHaveLength(1));
    expect(api.chamadas.puts[0]?.body.visivelCliente).toBe(false);
  });

  it('dá para liberar ao cliente pelo formulário', async () => {
    const api = servidorFinanceiro([lancamento('o1', { descricao: 'Oculto', visivelCliente: false })]);
    await abrirTela(api);
    const f = await abrirEditar('Oculto');
    await user().click(f.liberar);

    await f.enviar();

    await waitFor(() => expect(api.chamadas.puts).toHaveLength(1));
    expect(api.chamadas.puts[0]?.body.visivelCliente).toBe(true);
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Visível ao cliente: Oculto' })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
  });

  it('a obra não é alterável: não há campo de obra no formulário', async () => {
    await abrirTela(servidorFinanceiro([original]));
    const f = await abrirEditar('Pedreiro - semana 2');
    expect(within(f.dialog).queryByLabelText(/obra/i)).not.toBeInTheDocument();
  });

  it('as mesmas validações valem no editar (valor zero não chega ao servidor)', async () => {
    const api = servidorFinanceiro([original]);
    await abrirTela(api);
    const f = await abrirEditar('Pedreiro - semana 2');
    await user().clear(f.valor);
    await user().type(f.valor, '0');

    await f.enviar();

    expect(mensagemDe(f.valor)).toMatch(/maior que zero/);
    expect(api.chamadas.puts).toHaveLength(0);
  });

  it('400 por campo, 403, 404 e 500 no PUT', async () => {
    const api = servidorFinanceiro([original]);
    server.use(
      http.put(`${API}/financeiro/lancamentos/:id`, () =>
        HttpResponse.json({ errors: { Descricao: ['A descricao e obrigatoria.'] } }, { status: 400 }),
      ),
      ...api.handlers,
    );
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    const f = await abrirEditar('Pedreiro - semana 2');
    await f.enviar();
    await waitFor(() => expect(mensagemDe(f.descricao)).toBe('A descricao e obrigatoria.'));

    for (const [status, texto] of [
      [403, /não tem permissão/i],
      [404, /não foi encontrado/i],
    ] as const) {
      server.use(http.put(`${API}/financeiro/lancamentos/:id`, () => HttpResponse.json({}, { status })));
      await f.enviar();
      await waitFor(() => expect(within(f.dialog).getByRole('alert')).toHaveTextContent(texto));
    }

    server.use(
      http.put(`${API}/financeiro/lancamentos/:id`, () =>
        HttpResponse.json({ requestId: 'req-put', message: 'Erro interno do servidor.' }, { status: 500 }),
      ),
    );
    await f.enviar();
    await waitFor(() => expect(within(f.dialog).getByRole('alert')).toHaveTextContent('req-put'));
    expect(f.dialog).toBeVisible();
  });
});
