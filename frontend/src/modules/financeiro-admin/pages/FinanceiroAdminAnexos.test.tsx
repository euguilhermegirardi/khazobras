import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/helpers';
import { ADMIN, anexo, lancamento, lancamentos, type LancamentoJson, servidorFinanceiro } from '@/test/financeiroAdmin';
import { API, server } from '@/test/server';
import { ANEXO_MAX_BYTES } from '@/utils/anexo';

const user = () => userEvent.setup();
const kpi = (rotulo: string) => screen.getByText(rotulo, { selector: 'p' }).parentElement as HTMLElement;

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

/** O que o app entregou ao `fetch` no campo `file` do multipart (lido antes do envio: ver `servidorFinanceiro`). */
let enviado: File | null = null;

beforeEach(() => {
  enviado = null;
  const fetchOriginal = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const arquivoDoForm = init?.body instanceof FormData ? init.body.get('file') : null;
    if (arquivoDoForm instanceof File) enviado = arquivoDoForm;
    return fetchOriginal(input, init);
  });
  createObjectURL.mockReset();
  createObjectURL.mockImplementation(() => 'blob:http://localhost/comprovante-1');
  revokeObjectURL.mockReset();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const dezAnexos = () => Array.from({ length: 10 }, (_, i) => anexo(`n${i}`, { nomeArquivo: `comprovante-${i}.pdf` }));

/** Abre a tela com os lançamentos dados e o diálogo "Editar" do primeiro. */
async function abrirEdicao(lista: LancamentoJson[], descricao = lista[0]?.descricao ?? '') {
  const api = servidorFinanceiro(lista, { nomeDoArquivo: () => enviado?.name });
  server.use(...api.handlers);
  renderApp(ADMIN, 'Admin');
  await user().click(await screen.findByRole('button', { name: `Editar lançamento: ${descricao}` }));
  const dialog = await screen.findByRole('dialog', { name: 'Editar lançamento' });
  return { api, dialog, secao: within(dialog).getByRole('region', { name: 'Comprovantes' }) };
}

const campoArquivo = (dialog: HTMLElement) => within(dialog).getByLabelText(/Enviar comprovante|Enviando comprovante/);
const escolher = (campo: HTMLElement, arquivo: File) => fireEvent.change(campo, { target: { files: [arquivo] } });
const arquivo = (nome: string, tipo = '', conteudo = 'conteudo sintetico') =>
  new File([conteudo], nome, { type: tipo });
const comTamanho = (file: File, size: number) => {
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('Financeiro (admin) - comprovantes: lista', () => {
  it('mostra nome, tamanho e data de cada comprovante e o contador "N de 10"', async () => {
    const { secao } = await abrirEdicao([
      lancamento('a', {
        descricao: 'Com anexos',
        anexos: [
          anexo('x1', { nomeArquivo: 'nota-fiscal.pdf', tamanhoBytes: 10240, uploadedAt: '2026-09-10T15:05:00Z' }),
          anexo('x2', { nomeArquivo: 'foto.jpg', tamanhoBytes: 1572864, uploadedAt: '2026-09-11T15:05:00Z' }),
        ],
      }),
    ]);

    expect(within(secao).getByText('2 de 10')).toBeInTheDocument();
    const itens = within(secao).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('nota-fiscal.pdf');
    expect(itens[0]).toHaveTextContent('10 KB');
    expect(itens[0]).toHaveTextContent('10/09/2026');
    expect(itens[1]).toHaveTextContent('foto.jpg');
    expect(itens[1]).toHaveTextContent('1,5 MB');
  });

  it('sem comprovantes mostra o vazio e "0 de 10"', async () => {
    const { secao } = await abrirEdicao([lancamento('a', { descricao: 'Sem anexo' })]);
    expect(within(secao).getByText('Nenhum comprovante anexado.')).toBeInTheDocument();
    expect(within(secao).getByText('0 de 10')).toBeInTheDocument();
    expect(within(secao).queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('Financeiro (admin) - comprovantes: baixar', () => {
  it('baixa pela API com Bearer e salva com o nome do Content-Disposition via blob (sem link para o bucket)', async () => {
    const cliques: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      cliques.push(`${this.download}|${this.href}`);
    });
    const { api, secao } = await abrirEdicao([
      lancamento('a', { descricao: 'Baixa', anexos: [anexo('x1', { nomeArquivo: 'original.pdf' })] }),
    ]);
    server.use(
      http.get(
        `${API}/financeiro/anexos/x1/download`,
        () =>
          new HttpResponse(Uint8Array.from([37, 80, 68, 70]), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'attachment; filename="servidor.pdf"',
            },
          }),
      ),
    );

    await user().click(within(secao).getByRole('button', { name: 'Baixar original.pdf' }));

    await waitFor(() => expect(cliques).toEqual(['servidor.pdf|blob:http://localhost/comprovante-1']));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(api.chamadas.downloads).toHaveLength(0); // o handler do teste respondeu no lugar da API em memória
  });

  it('manda o token na requisição e, sem Content-Disposition, usa o nome do anexo', async () => {
    const cliques: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      cliques.push(this.download);
    });
    const { api, secao } = await abrirEdicao([
      lancamento('a', { descricao: 'Baixa', anexos: [anexo('x1', { nomeArquivo: 'original.pdf' })] }),
    ]);

    await user().click(within(secao).getByRole('button', { name: 'Baixar original.pdf' }));

    await waitFor(() => expect(cliques).toEqual(['original.pdf']));
    expect(api.chamadas.downloads).toEqual([{ id: 'x1', auth: 'Bearer token-falso-de-teste' }]);
  });

  it('as ações de arquivo ficam travadas enquanto baixa', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { secao } = await abrirEdicao([
      lancamento('a', {
        descricao: 'Baixa',
        anexos: [anexo('x1', { nomeArquivo: 'um.pdf' }), anexo('x2', { nomeArquivo: 'dois.pdf' })],
      }),
    ]);
    let liberar: () => void = () => {};
    const trava = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.get(`${API}/financeiro/anexos/x1/download`, async () => {
        await trava;
        return new HttpResponse(Uint8Array.from([1]));
      }),
    );

    await user().click(within(secao).getByRole('button', { name: 'Baixar um.pdf' }));

    await waitFor(() => expect(within(secao).getByRole('button', { name: 'Baixar dois.pdf' })).toBeDisabled());
    expect(within(secao).getByRole('button', { name: 'Remover dois.pdf' })).toBeDisabled();
    expect(campoArquivo(secao)).toBeDisabled();
    liberar();
    await waitFor(() => expect(within(secao).getByRole('button', { name: 'Baixar dois.pdf' })).toBeEnabled());
  });

  it.each([
    [404, undefined, /Comprovante não encontrado\./],
    [403, undefined, /não tem permissão/i],
    [500, 'req-down', /req-down/],
  ])('erro %s ao baixar mostra Alert e não salva arquivo', async (status, requestId, texto) => {
    const salvar = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { secao } = await abrirEdicao([
      lancamento('a', { descricao: 'Baixa', anexos: [anexo('x1', { nomeArquivo: 'original.pdf' })] }),
    ]);
    server.use(
      http.get(`${API}/financeiro/anexos/x1/download`, () =>
        HttpResponse.json(requestId ? { requestId, message: 'Erro interno do servidor.' } : {}, { status }),
      ),
    );

    await user().click(within(secao).getByRole('button', { name: 'Baixar original.pdf' }));

    expect(await within(secao).findByRole('alert')).toHaveTextContent(texto);
    expect(salvar).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('Financeiro (admin) - comprovantes: remover', () => {
  const doisAnexos = () => [
    lancamento('a', {
      descricao: 'Remove',
      anexos: [anexo('x1', { nomeArquivo: 'um.pdf' }), anexo('x2', { nomeArquivo: 'dois.pdf' })],
    }),
  ];

  it('pede confirmação na própria linha; Cancelar não chama a API', async () => {
    const { api, secao } = await abrirEdicao(doisAnexos());

    await user().click(within(secao).getByRole('button', { name: 'Remover um.pdf' }));

    expect(within(secao).getByText('Remover este comprovante?')).toBeInTheDocument();
    expect(within(secao).getByRole('button', { name: 'Confirmar remoção de um.pdf' })).toBeInTheDocument();
    expect(api.chamadas.anexosRemovidos).toHaveLength(0);

    await user().click(within(secao).getByRole('button', { name: 'Cancelar' }));
    expect(within(secao).queryByText('Remover este comprovante?')).not.toBeInTheDocument();
    expect(within(secao).getByRole('button', { name: 'Remover um.pdf' })).toBeInTheDocument();
    expect(api.chamadas.anexosRemovidos).toHaveLength(0);
  });

  it('confirmar chama DELETE do anexo e a lista do diálogo reflete na hora, sem fechar', async () => {
    const { api, dialog, secao } = await abrirEdicao(doisAnexos());

    await user().click(within(secao).getByRole('button', { name: 'Remover um.pdf' }));
    await user().click(within(secao).getByRole('button', { name: 'Confirmar remoção de um.pdf' }));

    await waitFor(() => expect(within(secao).queryByText('um.pdf', { exact: false })).not.toBeInTheDocument());
    expect(api.chamadas.anexosRemovidos).toEqual(['x1']);
    expect(within(secao).getByText('1 de 10')).toBeInTheDocument();
    expect(within(secao).getByText('dois.pdf', { exact: false })).toBeInTheDocument();
    expect(dialog).toBeVisible();

    await user().click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('row', { name: /Remove/ })).toHaveTextContent('1 anexo');
  });

  it('remover o último comprovante volta ao vazio e a linha da tabela passa a "Sem anexos"', async () => {
    const { dialog, secao } = await abrirEdicao([
      lancamento('a', { descricao: 'Remove', anexos: [anexo('x1', { nomeArquivo: 'unico.pdf' })] }),
    ]);

    await user().click(within(secao).getByRole('button', { name: 'Remover unico.pdf' }));
    await user().click(within(secao).getByRole('button', { name: 'Confirmar remoção de unico.pdf' }));

    expect(await within(secao).findByText('Nenhum comprovante anexado.')).toBeInTheDocument();
    await user().click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('row', { name: /Remove/ })).toHaveTextContent('Sem anexos');
  });

  it.each([
    [404, undefined, /Comprovante não encontrado\./],
    [403, undefined, /não tem permissão/i],
    [500, 'req-del-anexo', /req-del-anexo/],
  ])('erro %s ao remover mostra Alert e o comprovante continua', async (status, requestId, texto) => {
    const { secao } = await abrirEdicao(doisAnexos());
    server.use(
      http.delete(`${API}/financeiro/anexos/:anexoId`, () => {
        if (status === 404) return HttpResponse.json({}, { status });
        return HttpResponse.json(requestId ? { requestId, message: 'Erro interno do servidor.' } : {}, { status });
      }),
    );

    await user().click(within(secao).getByRole('button', { name: 'Remover um.pdf' }));
    await user().click(within(secao).getByRole('button', { name: 'Confirmar remoção de um.pdf' }));

    expect(await within(secao).findByRole('alert')).toHaveTextContent(texto);
    if (status !== 404) expect(within(secao).getByText('um.pdf', { exact: false })).toBeInTheDocument();
  });
});

describe('Financeiro (admin) - comprovantes: enviar', () => {
  it('envia multipart (campo "file") com Bearer e o anexo aparece no diálogo e na tabela na hora', async () => {
    const { api, dialog, secao } = await abrirEdicao([lancamento('a', { descricao: 'Recebe' })]);

    escolher(campoArquivo(secao), arquivo('nota.pdf', 'application/pdf'));

    await waitFor(() => expect(within(secao).getByText('nota.pdf', { exact: false })).toBeInTheDocument());
    expect(api.chamadas.uploads).toEqual([
      {
        id: 'a',
        auth: 'Bearer token-falso-de-teste',
        nome: 'nota.pdf',
        tipo: 'application/pdf',
        tamanho: 'conteudo sintetico'.length,
        campo: 'file',
      },
    ]);
    expect(within(secao).getByText('1 de 10')).toBeInTheDocument();
    expect(dialog).toBeVisible();
    // O campo é limpo: dá para escolher o mesmo arquivo de novo.
    expect((campoArquivo(secao) as HTMLInputElement).value).toBe('');

    await user().click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('row', { name: /Recebe/ })).toHaveTextContent('1 anexo');
  });

  it.each([
    ['nota.PDF', '', 'application/pdf'],
    ['foto.JPG', 'application/octet-stream', 'image/jpeg'],
    ['planilha.xlsx', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['imagem.png', 'image/png', 'image/png'],
    ['texto.txt', '', 'text/plain'],
  ])('%s (MIME "%s" do navegador) vai com o MIME %s da extensão', async (nome, tipoOriginal, tipoEsperado) => {
    const { api, secao } = await abrirEdicao([lancamento('a', { descricao: 'Recebe' })]);

    escolher(campoArquivo(secao), arquivo(nome, tipoOriginal));

    await waitFor(() => expect(api.chamadas.uploads).toHaveLength(1));
    expect(enviado?.type).toBe(tipoEsperado);
    expect(enviado?.name).toBe(nome);
    expect(api.chamadas.uploads[0]?.tipo).toBe(tipoEsperado);
  });

  it.each([
    ['virus.exe', 10, /Tipo de arquivo não permitido/],
    ['script.js', 10, /Tipo de arquivo não permitido/],
    ['semextensao', 10, /Tipo de arquivo não permitido/],
    ['dupla.pdf.exe', 10, /Tipo de arquivo não permitido/],
    ['grande.pdf', ANEXO_MAX_BYTES + 1, /excede o tamanho máximo de 10 MB/],
    ['vazio.pdf', 0, /vazio/],
  ])('recusa "%s" (%i bytes) sem chamar o servidor', async (nome, tamanho, texto) => {
    const { api, secao } = await abrirEdicao([lancamento('a', { descricao: 'Recebe' })]);

    escolher(campoArquivo(secao), comTamanho(arquivo(nome, 'application/octet-stream'), tamanho));

    expect(await within(secao).findByRole('alert')).toHaveTextContent(texto);
    expect(api.chamadas.uploads).toHaveLength(0);
    expect(within(secao).getByText('0 de 10')).toBeInTheDocument();
  });

  it('aceita exatamente 10 MB', async () => {
    const { api, secao } = await abrirEdicao([lancamento('a', { descricao: 'Recebe' })]);

    escolher(campoArquivo(secao), comTamanho(arquivo('limite.pdf', 'application/pdf'), ANEXO_MAX_BYTES));

    await waitFor(() => expect(api.chamadas.uploads).toHaveLength(1));
    expect(within(secao).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('o erro de arquivo recusado some quando o envio seguinte é válido', async () => {
    const { api, secao } = await abrirEdicao([lancamento('a', { descricao: 'Recebe' })]);
    escolher(campoArquivo(secao), arquivo('virus.exe'));
    await within(secao).findByRole('alert');

    escolher(campoArquivo(secao), arquivo('ok.pdf', 'application/pdf'));

    await waitFor(() => expect(api.chamadas.uploads).toHaveLength(1));
    await waitFor(() => expect(within(secao).queryByRole('alert')).not.toBeInTheDocument());
  });

  it('com 9 comprovantes ainda aceita; ao chegar em 10 o campo trava com a mensagem do limite', async () => {
    const nove = dezAnexos().slice(0, 9);
    const { api, secao } = await abrirEdicao([lancamento('a', { descricao: 'Quase cheio', anexos: nove })]);
    expect(campoArquivo(secao)).toBeEnabled();
    expect(within(secao).getByText('9 de 10')).toBeInTheDocument();
    expect(within(secao).getByText(/Até 10 MB por arquivo\. Tipos: JPG, JPEG, PNG/)).toBeInTheDocument();

    escolher(campoArquivo(secao), arquivo('decimo.pdf', 'application/pdf'));

    await waitFor(() => expect(within(secao).getByText('10 de 10')).toBeInTheDocument());
    expect(api.chamadas.uploads).toHaveLength(1);
    expect(campoArquivo(secao)).toBeDisabled();
    expect(
      within(secao).getByText('Limite de 10 comprovantes atingido: remova um para enviar outro.'),
    ).toBeInTheDocument();
  });

  it('com 10 comprovantes o campo já abre travado e remover um libera o envio', async () => {
    const { secao } = await abrirEdicao([lancamento('a', { descricao: 'Cheio', anexos: dezAnexos() })]);
    expect(campoArquivo(secao)).toBeDisabled();
    expect(within(secao).getByText('10 de 10')).toBeInTheDocument();
    expect(within(secao).getByText(/Limite de 10 comprovantes atingido/)).toBeInTheDocument();

    await user().click(within(secao).getByRole('button', { name: 'Remover comprovante-0.pdf' }));
    await user().click(within(secao).getByRole('button', { name: 'Confirmar remoção de comprovante-0.pdf' }));

    await waitFor(() => expect(campoArquivo(secao)).toBeEnabled());
    expect(within(secao).getByText('9 de 10')).toBeInTheDocument();
  });

  it('durante o envio o campo trava e o rótulo vira "Enviando comprovante…"', async () => {
    const { secao } = await abrirEdicao([lancamento('a', { descricao: 'Recebe' })]);
    let liberar: () => void = () => {};
    const trava = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.post(`${API}/financeiro/lancamentos/:id/anexos`, async () => {
        await trava;
        return HttpResponse.json(anexo('novo', { nomeArquivo: 'lento.pdf' }), { status: 201 });
      }),
    );

    escolher(campoArquivo(secao), arquivo('lento.pdf', 'application/pdf'));

    expect(await within(secao).findByText('Enviando comprovante…')).toBeInTheDocument();
    expect(campoArquivo(secao)).toBeDisabled();
    liberar();
    await waitFor(() => expect(within(secao).getByText('Enviar comprovante')).toBeInTheDocument());
  });

  it('400 { message } do servidor (ex.: 11º anexo ou conteúdo inválido) aparece em Alert e nada é anexado', async () => {
    const { secao } = await abrirEdicao([lancamento('a', { descricao: 'Recebe' })]);
    server.use(
      http.post(`${API}/financeiro/lancamentos/:id/anexos`, () =>
        HttpResponse.json({ message: 'Cada lancamento aceita no maximo 10 anexos.' }, { status: 400 }),
      ),
    );

    escolher(campoArquivo(secao), arquivo('nota.pdf', 'application/pdf'));

    expect(await within(secao).findByRole('alert')).toHaveTextContent('Cada lancamento aceita no maximo 10 anexos.');
    expect(within(secao).getByText('0 de 10')).toBeInTheDocument();
  });

  it.each([
    [403, undefined, /não tem permissão/i],
    [404, undefined, /Lançamento não encontrado\./],
    [500, 'req-up', /req-up/],
  ])('erro %s no envio mostra Alert e o campo destrava', async (status, requestId, texto) => {
    const { secao } = await abrirEdicao([lancamento('a', { descricao: 'Recebe' })]);
    server.use(
      http.post(`${API}/financeiro/lancamentos/:id/anexos`, () =>
        HttpResponse.json(requestId ? { requestId, message: 'Erro interno do servidor.' } : {}, { status }),
      ),
    );

    escolher(campoArquivo(secao), arquivo('nota.pdf', 'application/pdf'));

    expect(await within(secao).findByRole('alert')).toHaveTextContent(texto);
    await waitFor(() => expect(campoArquivo(secao)).toBeEnabled());
  });

  it('o diálogo usa a versão mais nova da lista: anexo enviado por outra via aparece depois do refetch', async () => {
    const { api, dialog, secao } = await abrirEdicao([lancamento('a', { descricao: 'Recebe' })]);
    escolher(campoArquivo(secao), arquivo('primeiro.pdf', 'application/pdf'));
    await waitFor(() => expect(within(secao).getByText('primeiro.pdf', { exact: false })).toBeInTheDocument());

    escolher(campoArquivo(secao), arquivo('segundo.pdf', 'application/pdf'));
    await waitFor(() => expect(within(secao).getByText('segundo.pdf', { exact: false })).toBeInTheDocument());
    expect(within(secao).getAllByRole('listitem')).toHaveLength(2);
    expect(api.estado.lancamentos[0]?.anexos).toHaveLength(2);
    expect(dialog).toBeVisible();
  });
});

describe('Financeiro (admin) - excluir lançamento', () => {
  const abrirComLista = async (n = 3) => {
    const api = servidorFinanceiro(lancamentos(n));
    server.use(...api.handlers);
    renderApp(ADMIN, 'Admin');
    await screen.findByRole('table');
    return api;
  };

  it('pede confirmação inline com o texto de exclusão definitiva, foco em "Cancelar" e sem chamar a API', async () => {
    const api = await abrirComLista();

    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 02' }));

    expect(
      screen.getByText(/Excluir definitivamente.*\? Os comprovantes também serão removidos\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir definitivamente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(api.chamadas.deletes).toHaveLength(0);
  });

  it('Cancelar fecha a confirmação sem excluir', async () => {
    const api = await abrirComLista();
    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 02' }));

    await user().click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('button', { name: 'Excluir definitivamente' })).not.toBeInTheDocument();
    expect(api.chamadas.deletes).toHaveLength(0);
    expect(screen.getByRole('table')).toHaveTextContent('Item 02');
  });

  it('confirmar chama DELETE, avisa, remove a linha e atualiza os KPIs', async () => {
    const api = await abrirComLista(3);
    await waitFor(() => expect(kpi('Total lançado')).toHaveTextContent('3 lançamentos'));
    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 02' }));

    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByText('Lançamento excluído.')).toBeInTheDocument();
    expect(api.chamadas.deletes).toEqual(['l02']);
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('Item 02'));
    expect(screen.queryByRole('button', { name: 'Excluir definitivamente' })).not.toBeInTheDocument();
    await waitFor(() => expect(kpi('Total lançado')).toHaveTextContent('2 lançamentos'));
  });

  it('durante a exclusão os botões ficam travados e mostram "Excluindo…"', async () => {
    await abrirComLista();
    let liberar: () => void = () => {};
    const trava = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    server.use(
      http.delete(`${API}/financeiro/lancamentos/:id`, async () => {
        await trava;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 01' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    const botao = await screen.findByRole('button', { name: 'Excluindo…' });
    expect(botao).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    liberar();
    await screen.findByText('Lançamento excluído.');
  });

  it('excluir um item selecionado tira ele da seleção', async () => {
    await abrirComLista();
    await user().click(screen.getByRole('checkbox', { name: 'Selecionar lançamento: Item 01' }));
    await user().click(screen.getByRole('checkbox', { name: 'Selecionar lançamento: Item 02' }));
    expect(screen.getByRole('region', { name: 'Ações em lote' })).toHaveTextContent('2 selecionados');

    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 02' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    await screen.findByText('Lançamento excluído.');
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Ações em lote' })).toHaveTextContent('1 selecionado'),
    );
  });

  it('se era o único item da última página, volta uma página (não mostra página vazia)', async () => {
    const api = await abrirComLista(21);
    await user().click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2 de 2');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    expect(screen.getByRole('table')).toHaveTextContent('Item 21');

    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 21' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    await screen.findByText('Lançamento excluído.');
    await screen.findByText('Página 1 de 1');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(21));
    expect(screen.getByRole('table')).toHaveTextContent('Item 01');
    expect(screen.queryByText('Nenhum lançamento com estes filtros.')).not.toBeInTheDocument();
    expect(api.chamadas.listas.at(-1)?.get('pageIndex')).toBe('0');
    expect(api.chamadas.deletes).toEqual(['l21']);
  });

  it('excluir um item de uma página com vários itens continua na mesma página', async () => {
    const api = await abrirComLista(25);
    await user().click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2 de 2');
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Item 21'));

    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 21' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    await screen.findByText('Lançamento excluído.');
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveTextContent('Item 21'));
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(api.chamadas.listas.at(-1)?.get('pageIndex')).toBe('1');
  });

  it('excluir o último lançamento da obra mostra o vazio', async () => {
    await abrirComLista(1);
    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 01' }));
    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByText('Nenhum lançamento nesta obra ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it.each([
    [403, undefined, /não tem permissão/i],
    [404, undefined, /Lançamento não encontrado\. Atualize a página\./],
    [500, 'req-excluir', /req-excluir/],
  ])('erro %s ao excluir mostra Alert, fecha a confirmação e não mostra sucesso', async (status, requestId, texto) => {
    await abrirComLista();
    server.use(
      http.delete(`${API}/financeiro/lancamentos/:id`, () =>
        HttpResponse.json(requestId ? { requestId, message: 'Erro interno do servidor.' } : {}, { status }),
      ),
    );
    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 02' }));

    await user().click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(texto);
    expect(screen.queryByRole('button', { name: 'Excluir definitivamente' })).not.toBeInTheDocument();
    expect(screen.queryByText('Lançamento excluído.')).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('Item 02');
  });

  it('trocar de página fecha a confirmação de exclusão', async () => {
    await abrirComLista(25);
    await user().click(screen.getByRole('button', { name: 'Excluir lançamento: Item 02' }));
    expect(screen.getByRole('button', { name: 'Excluir definitivamente' })).toBeInTheDocument();

    await user().click(screen.getByRole('button', { name: 'Próxima' }));

    await screen.findByText('Página 2 de 2');
    expect(screen.queryByRole('button', { name: 'Excluir definitivamente' })).not.toBeInTheDocument();
  });
});
