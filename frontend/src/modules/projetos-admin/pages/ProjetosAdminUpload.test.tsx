import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse, type HttpHandler } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/auth/AuthContext';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { AppRoutes } from '@/routes/AppRoutes';
import { saveSession } from '@/services/session';
import { fakeSession, renderApp } from '@/test/helpers';
import { espiarEnvios, type Envio } from '@/test/fotosAdmin';
import { ETAPA_ALVENARIA, OBRA_ID, projeto, ROTA, servidorProjetos, TOKEN } from '@/test/projetosAdmin';
import { API, server } from '@/test/server';

const user = () => userEvent.setup();
const POST_PROJETOS = `${API}/obras/${OBRA_ID}/projetos`;
const DEZ_MB = 10 * 1024 * 1024;

let enviados: Envio[] = [];

beforeEach(() => {
  enviados = espiarEnvios().enviados;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Documento sintético pequeno. `lastModified` diferente por nome: dois arquivos só são "o mesmo" se tudo coincidir. */
let relogio = 1_700_000_000_000;
const doc = (nome: string, over: { tipo?: string; lastModified?: number } = {}) =>
  new File([`conteudo-${nome}`], nome, { type: over.tipo ?? '', lastModified: over.lastModified ?? (relogio += 1000) });
const comTamanho = (file: File, size: number) => {
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/** Monta a tela com os documentos dados (e handlers extras com prioridade) e devolve a API em memória. */
async function montar(inicial: ProjetoDocumento[] = [], extra: HttpHandler[] = [], limite = 200) {
  const api = servidorProjetos(inicial, { envios: enviados, limite });
  server.use(...extra, ...api.handlers);
  renderApp(ROTA, 'Admin');
  // `hidden: true`: não checa a visibilidade (getComputedStyle) de cada nó, que em ~200 linhas custa segundos.
  await screen.findByRole('heading', { name: 'Enviar documentos', level: 2, hidden: true });
  return api;
}

const campo = () => screen.getByLabelText(/Arraste os documentos aqui|Limite de 200 documentos atingido/);
const escolher = (...arquivos: File[]) => fireEvent.change(campo(), { target: { files: arquivos } });
const fila = () => screen.getByRole('region', { name: 'Fila de envio' });
const linha = (nome: string) => within(fila()).getByTitle(nome).closest('li') as HTMLElement;
const enviar = async (rotulo: string) => user().click(await screen.findByRole('button', { name: rotulo }));

/** Segura o POST até `liberar()`. */
function portao() {
  let liberar: () => void = () => undefined;
  const aberto = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  return { aberto, liberar: () => liberar() };
}

describe('Projetos (admin) - envio: validação ao escolher', () => {
  it('recusa tipo, tamanho, nome longo, barra, arquivo vazio e repetido, com o motivo de cada um; o válido entra', async () => {
    await montar();
    const nomeLongo = `${'n'.repeat(252)}.pdf`;
    expect(nomeLongo).toHaveLength(256);

    escolher(
      doc('ok.pdf', { lastModified: 5 }),
      doc('notas.txt'),
      doc('desenho.dwg'),
      comTamanho(doc('grande.pdf'), DEZ_MB + 1),
      doc(nomeLongo),
      doc('a/b.pdf'),
      doc('a\\b.pdf'),
      new File([], 'vazio.pdf'),
      doc('ok.pdf', { lastModified: 5 }),
    );

    const aviso = (await screen.findByText('8 arquivos não foram adicionados:')).closest(
      '[role="alert"]',
    ) as HTMLElement;
    const motivos = within(aviso)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    const tipos = 'PDF, JPG, JPEG, PNG, WEBP, GIF, DOC, DOCX, XLS, XLSX';
    expect(motivos).toEqual([
      `notas.txt: Tipo de arquivo não permitido. Use: ${tipos}.`,
      `desenho.dwg: Tipo de arquivo não permitido. Use: ${tipos}.`,
      'grande.pdf: O arquivo excede o tamanho máximo de 10 MB.',
      `${nomeLongo}: O nome do arquivo deve ter no máximo 255 caracteres.`,
      'a/b.pdf: O nome do arquivo não pode ter barras (/ ou \\) nem caracteres de controle.',
      'a\\b.pdf: O nome do arquivo não pode ter barras (/ ou \\) nem caracteres de controle.',
      'vazio.pdf: O arquivo está vazio.',
      'ok.pdf: Este arquivo já está na fila de envio.',
    ]);
    expect(screen.getByRole('button', { name: 'Enviar 1 documento' })).toBeEnabled();
    expect(within(fila()).getAllByRole('listitem')).toHaveLength(1);
    expect(enviados).toHaveLength(0);
  });

  it('aceita exatamente 10 MB e nome com exatamente 255 caracteres; extensão em maiúsculas vale', async () => {
    await montar();
    const nome255 = `${'a'.repeat(251)}.pdf`;
    expect(nome255).toHaveLength(255);

    escolher(comTamanho(doc('dez-mega.pdf'), DEZ_MB), doc(nome255), doc('PLANTA.PDF'));

    expect(await screen.findByRole('button', { name: 'Enviar 3 documentos' })).toBeEnabled();
    expect(screen.queryByText(/não foi adicionado|não foram adicionados/)).not.toBeInTheDocument();
    expect(within(fila()).getByTitle(nome255)).toBeInTheDocument();
  });

  it('aceita PDF, imagens, Word e Excel (todas as extensões permitidas)', async () => {
    await montar();
    const nomes = ['a.pdf', 'b.jpg', 'c.jpeg', 'd.png', 'e.webp', 'f.gif', 'g.doc', 'h.docx', 'i.xls', 'j.xlsx'];

    escolher(...nomes.map((n) => doc(n)));

    expect(await screen.findByRole('button', { name: 'Enviar 10 documentos' })).toBeEnabled();
    expect(screen.queryByText(/não foi adicionado|não foram adicionados/)).not.toBeInTheDocument();
  });

  it('nome de arquivo com HTML é mostrado como texto, nunca interpretado', async () => {
    await montar();
    const malicioso = '<img src=x onerror=alert(1)>.pdf';

    escolher(doc(malicioso));

    expect(await within(fila()).findByText(malicioso)).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('soltar arquivos na área também adiciona à fila', async () => {
    await montar();
    const area = screen.getByText(/Arraste os documentos aqui/).closest('label') as HTMLElement;

    fireEvent.drop(area, { dataTransfer: { files: [doc('solto.pdf')] } });

    expect(await screen.findByRole('button', { name: 'Enviar 1 documento' })).toBeEnabled();
  });

  it('"Tirar <nome> da lista" remove um pendente', async () => {
    await montar();
    escolher(doc('a.pdf'), doc('b.pdf'));
    await screen.findByRole('button', { name: 'Enviar 2 documentos' });

    await user().click(screen.getByRole('button', { name: 'Tirar a.pdf da lista' }));

    expect(within(fila()).queryByTitle('a.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar 1 documento' })).toBeEnabled();
    expect(enviados).toHaveLength(0);
  });

  it('o arquivo tirado da lista pode ser escolhido de novo', async () => {
    await montar();
    const a = doc('a.pdf', { lastModified: 9 });
    escolher(a);
    await user().click(await screen.findByRole('button', { name: 'Tirar a.pdf da lista' }));

    escolher(doc('a.pdf', { lastModified: 9 }));

    expect(await screen.findByRole('button', { name: 'Enviar 1 documento' })).toBeEnabled();
    expect(screen.queryByText(/não foi adicionado/)).not.toBeInTheDocument();
  });
});

describe('Projetos (admin) - envio: etapa e tipo do lote', () => {
  it('etapa e tipo do lote vão na query com encodeURIComponent; o multipart leva só o campo "file"', async () => {
    const api = await montar();
    escolher(doc('pilar.pdf'));
    await user().selectOptions(screen.getByLabelText('Etapa do lote'), 'Alvenaria');
    await user().type(screen.getByLabelText('Tipo de documento do lote'), '  Planta baixa & corte/1ª fase  ');

    await enviar('Enviar 1 documento');

    await waitFor(() => expect(api.chamadas.uploads).toHaveLength(1));
    const upload = api.chamadas.uploads[0];
    expect(upload?.search).toBe(
      `?etapaId=${ETAPA_ALVENARIA}&tipoDocumento=Planta%20baixa%20%26%20corte%2F1%C2%AA%20fase`,
    );
    expect(upload).toMatchObject({
      auth: `Bearer ${TOKEN}`,
      query: { etapaId: ETAPA_ALVENARIA, tipoDocumento: 'Planta baixa & corte/1ª fase' },
      nome: 'pilar.pdf',
      campos: ['file'],
    });
    // O documento novo nasce no grupo da etapa escolhida, com o tipo do lote.
    expect(await screen.findByRole('heading', { name: 'Alvenaria', level: 2 })).toBeInTheDocument();
  });

  it('sem etapa nem tipo a query fica vazia (sem parâmetros em branco)', async () => {
    const api = await montar();
    escolher(doc('a.pdf'));

    await enviar('Enviar 1 documento');

    await waitFor(() => expect(api.chamadas.uploads).toHaveLength(1));
    expect(api.chamadas.uploads[0]?.search).toBe('');
  });

  it('o mesmo lote vale para todos os arquivos da fila', async () => {
    const api = await montar();
    escolher(doc('a.pdf'), doc('b.pdf'));
    await user().type(screen.getByLabelText('Tipo de documento do lote'), 'Memorial');

    await enviar('Enviar 2 documentos');

    await waitFor(() => expect(api.chamadas.uploads).toHaveLength(2));
    expect(api.chamadas.uploads.map((u) => u.query)).toEqual([
      { tipoDocumento: 'Memorial' },
      { tipoDocumento: 'Memorial' },
    ]);
  });

  it('tipo do lote com mais de 50 caracteres é recusado no campo e nada é enviado', async () => {
    const api = await montar();
    escolher(doc('a.pdf'));
    fireEvent.change(screen.getByLabelText('Tipo de documento do lote'), { target: { value: 't'.repeat(51) } });

    await enviar('Enviar 1 documento');

    expect(await screen.findByText('O tipo do documento aceita no máximo 50 caracteres.')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de documento do lote')).toHaveAttribute('aria-invalid', 'true');
    expect(api.chamadas.uploads).toHaveLength(0);
  });

  it('o MIME vai pela extensão mesmo se o navegador mandou vazio', async () => {
    await montar();
    escolher(doc('a.pdf'), doc('b.png', { tipo: 'application/octet-stream' }), doc('c.xlsx'));

    await enviar('Enviar 3 documentos');

    await waitFor(() => expect(enviados).toHaveLength(3));
    expect(enviados.map((e) => `${e.nome}:${e.tipo}`)).toEqual([
      'a.pdf:application/pdf',
      'b.png:image/png',
      'c.xlsx:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
  });
});

describe('Projetos (admin) - envio: fila', () => {
  it('envia um por vez, na ordem escolhida, mostra o progresso e a lista já inclui os novos', async () => {
    let ativos = 0;
    let maximo = 0;
    const api = await montar(
      [],
      [
        http.post(POST_PROJETOS, async () => {
          ativos += 1;
          maximo = Math.max(maximo, ativos);
          await delay(15);
          ativos -= 1;
          return undefined;
        }),
      ],
    );
    escolher(doc('a.pdf'), doc('b.pdf'), doc('c.pdf'));

    await enviar('Enviar 3 documentos');

    expect(await screen.findByText('3 de 3 documentos enviados')).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(maximo).toBe(1);
    expect(screen.getByRole('progressbar', { name: 'Progresso do envio' })).toHaveAttribute('aria-valuenow', '100');
    for (const nome of ['a.pdf', 'b.pdf', 'c.pdf'])
      expect(within(linha(nome)).getByText('Enviada')).toBeInTheDocument();
    // Ao fim da rodada a lista é relida: a tabela mostra os 3 documentos e o contador sobe.
    expect(await screen.findByText(/A obra tem 3 de 200 documentos\./)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sem etapa', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('3 documentos')).toBeInTheDocument();
    expect(api.chamadas.listas).toBeGreaterThanOrEqual(2);
  });

  it('ao fim da rodada invalida a lista da obra (chave [obra, id, projetos]) e o cache recebe os novos', async () => {
    saveSession(fakeSession('Admin'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    const api = servidorProjetos([], { envios: enviados });
    server.use(...api.handlers);
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[ROTA]}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole('heading', { name: 'Enviar documentos', level: 2 });
    escolher(doc('a.pdf'));
    expect(invalidar).not.toHaveBeenCalled();

    await enviar('Enviar 1 documento');

    await screen.findByText('1 de 1 documento enviado');
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['obra', OBRA_ID, 'projetos'] }));
    await waitFor(() =>
      expect(
        (queryClient.getQueryData(['obra', OBRA_ID, 'projetos']) as ProjetoDocumento[]).map((p) => p.nome),
      ).toEqual(['a.pdf']),
    );
  });

  it('um 400 {message} vira erro só naquele arquivo; os outros seguem; "Tentar de novo (1)" reenvia', async () => {
    let recusar = true;
    const api = await montar(
      [],
      [
        http.post(POST_PROJETOS, () =>
          recusar && enviados.at(-1)?.nome === 'b.pdf'
            ? HttpResponse.json({ message: 'O arquivo não é um PDF válido.' }, { status: 400 })
            : undefined,
        ),
      ],
    );
    escolher(doc('a.pdf'), doc('b.pdf'), doc('c.pdf'));

    await enviar('Enviar 3 documentos');

    expect(await screen.findByText('2 de 3 documentos enviados · 1 com erro')).toBeInTheDocument();
    expect(within(linha('b.pdf')).getByText('Erro')).toBeInTheDocument();
    expect(within(linha('b.pdf')).getByText('O arquivo não é um PDF válido.')).toBeInTheDocument();
    expect(within(linha('a.pdf')).getByText('Enviada')).toBeInTheDocument();
    expect(within(linha('c.pdf')).getByText('Enviada')).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(screen.queryByText(/Envio interrompido/)).not.toBeInTheDocument();

    recusar = false;
    await user().click(screen.getByRole('button', { name: 'Tentar de novo (1)' }));

    expect(await screen.findByText('3 de 3 documentos enviados')).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.pdf', 'b.pdf', 'c.pdf', 'b.pdf']);
    expect(within(linha('b.pdf')).getByText('Enviada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tentar de novo/ })).not.toBeInTheDocument();
    expect(api.chamadas.uploads).toHaveLength(3);
  });

  it('um 400 com errors de campo (EtapaId) mostra o texto do campo na linha, não "Dados inválidos."', async () => {
    await montar(
      [],
      [
        http.post(POST_PROJETOS, () =>
          HttpResponse.json({ errors: { EtapaId: ['A etapa informada não pertence a esta obra.'] } }, { status: 400 }),
        ),
      ],
    );
    escolher(doc('a.pdf'));

    await enviar('Enviar 1 documento');

    expect(await within(fila()).findByText('A etapa informada não pertence a esta obra.')).toBeInTheDocument();
    expect(screen.queryByText('Dados inválidos.')).not.toBeInTheDocument();
    expect(within(linha('a.pdf')).getByText('Erro')).toBeInTheDocument();
    // 400 não interrompe a fila: "Tentar de novo" fica disponível.
    expect(screen.getByRole('button', { name: 'Tentar de novo (1)' })).toBeInTheDocument();
    expect(screen.queryByText(/Envio interrompido/)).not.toBeInTheDocument();
  });

  it('um 500 mostra o código de suporte na linha e a fila continua', async () => {
    await montar(
      [],
      [
        http.post(POST_PROJETOS, () =>
          enviados.at(-1)?.nome === 'a.pdf'
            ? HttpResponse.json({ requestId: 'req-up-500', message: 'Erro interno.' }, { status: 500 })
            : undefined,
        ),
      ],
    );
    escolher(doc('a.pdf'), doc('b.pdf'));

    await enviar('Enviar 2 documentos');

    expect(await screen.findByText('1 de 2 documentos enviado · 1 com erro')).toBeInTheDocument();
    expect(within(linha('a.pdf')).getByText(/\(código: req-up-500\)/)).toBeInTheDocument();
    expect(within(linha('b.pdf')).getByText('Enviada')).toBeInTheDocument();
  });

  it('Cancelar fila durante o envio: o envio em andamento termina e os pendentes viram "Cancelada"', async () => {
    const { aberto, liberar } = portao();
    const api = await montar(
      [],
      [
        http.post(POST_PROJETOS, async () => {
          await aberto;
          return undefined;
        }),
      ],
    );
    escolher(doc('a.pdf'), doc('b.pdf'), doc('c.pdf'));
    await enviar('Enviar 3 documentos');
    await waitFor(() => expect(enviados).toHaveLength(1));

    await user().click(screen.getByRole('button', { name: 'Cancelar fila' }));

    expect(await screen.findByText(/cancelando: aguardando o envio atual terminar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar fila' })).toBeDisabled();
    liberar();

    expect(await screen.findByText('1 de 3 documentos enviado · 2 canceladas')).toBeInTheDocument();
    expect(within(linha('a.pdf')).getByText('Enviada')).toBeInTheDocument();
    expect(within(linha('b.pdf')).getByText('Cancelada')).toBeInTheDocument();
    expect(within(linha('c.pdf')).getByText('Cancelada')).toBeInTheDocument();
    expect(enviados).toHaveLength(1);
    expect(api.chamadas.uploads).toHaveLength(1);
  });

  it('Cancelar fila antes de enviar cancela tudo sem chamar a API', async () => {
    const api = await montar();
    escolher(doc('a.pdf'), doc('b.pdf'));

    await user().click(await screen.findByRole('button', { name: 'Cancelar fila' }));

    expect(await screen.findByText('0 de 2 documentos enviados · 2 canceladas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar 0 documentos' })).toBeDisabled();
    expect(api.chamadas.uploads).toHaveLength(0);
  });

  it.each([
    [403, 'Envio interrompido: Você não tem permissão para esta ação.'],
    [404, 'Envio interrompido: Não encontrado.'],
  ])('um %i interrompe a fila: o resto continua pendente e dá para retomar', async (status, mensagem) => {
    let falhar = true;
    const api = await montar(
      [],
      [http.post(POST_PROJETOS, () => (falhar ? HttpResponse.json({}, { status }) : undefined))],
    );
    escolher(doc('a.pdf'), doc('b.pdf'), doc('c.pdf'));

    await enviar('Enviar 3 documentos');

    expect(await screen.findByText(mensagem)).toBeInTheDocument();
    expect(
      screen.getByText('Os documentos que não foram enviados continuam na fila: corrija e envie de novo.'),
    ).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.pdf']);
    expect(within(linha('a.pdf')).getByText('Erro')).toBeInTheDocument();
    expect(within(linha('b.pdf')).getByText('Pendente')).toBeInTheDocument();
    expect(within(linha('c.pdf')).getByText('Pendente')).toBeInTheDocument();

    falhar = false;
    await user().click(screen.getByRole('button', { name: 'Enviar 2 documentos' }));

    expect(await screen.findByText('2 de 3 documentos enviados · 1 com erro')).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(api.chamadas.uploads).toHaveLength(2);
    expect(screen.queryByText(/Envio interrompido/)).not.toBeInTheDocument();
  });

  it('403 com 20 arquivos na fila: para no primeiro e não despeja requisições', async () => {
    await montar([], [http.post(POST_PROJETOS, () => HttpResponse.json({}, { status: 403 }))]);
    escolher(...Array.from({ length: 20 }, (_, i) => doc(`f${i}.pdf`)));

    await enviar('Enviar 20 documentos');

    expect(await screen.findByText(/Envio interrompido/)).toBeInTheDocument();
    expect(enviados).toHaveLength(1);
  });

  it('"Limpar finalizadas" tira da fila o que terminou', async () => {
    await montar();
    escolher(doc('a.pdf'), doc('b.pdf'));
    await enviar('Enviar 2 documentos');
    await screen.findByText('2 de 2 documentos enviados');

    await user().click(screen.getByRole('button', { name: 'Limpar finalizadas' }));

    expect(screen.queryByRole('region', { name: 'Fila de envio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('não dá para tirar da lista o arquivo que está sendo enviado; os outros podem sair', async () => {
    const { aberto, liberar } = portao();
    await montar(
      [],
      [
        http.post(POST_PROJETOS, async () => {
          await aberto;
          return undefined;
        }),
      ],
    );
    escolher(doc('a.pdf'), doc('b.pdf'));
    await enviar('Enviar 2 documentos');
    await waitFor(() => expect(enviados).toHaveLength(1));

    expect(screen.getByRole('button', { name: 'Tirar a.pdf da lista' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tirar b.pdf da lista' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    // Etapa e tipo do lote ficam travados durante a rodada.
    expect(screen.getByLabelText('Etapa do lote')).toBeDisabled();
    expect(screen.getByLabelText('Tipo de documento do lote')).toBeDisabled();
    liberar();
    await screen.findByText('2 de 2 documentos enviados');
  });
});

describe('Projetos (admin) - envio: papel', () => {
  it('cliente não monta a área de envio nem pede nada', async () => {
    const api = servidorProjetos([projeto('p1')], { envios: enviados });
    server.use(...api.handlers);
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Enviar documentos' })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(api.chamadas.uploads).toHaveLength(0);
    expect(api.chamadas.listas).toBe(0);
  });
});
