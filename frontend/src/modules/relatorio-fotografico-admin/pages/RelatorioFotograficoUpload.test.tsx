import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse, type HttpHandler } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/helpers';
import {
  detalheRota,
  type Envio,
  erroEm,
  espiarEnvios,
  fotosEmOrdem,
  relatorio,
  servidorFotos,
  stubObjectUrl,
  TOKEN,
} from '@/test/fotosAdmin';
import { API, server } from '@/test/server';
import type { Foto } from '@/interfaces/relatorioFotografico';
import { FOTO_MAX_BYTES } from '@/utils/foto';

const user = () => userEvent.setup();
const ROTA = detalheRota('rf1');
const POST_FOTOS = `${API}/relatorios-fotograficos/rf1/fotos`;

let enviados: Envio[] = [];
let objectUrls: ReturnType<typeof stubObjectUrl>;

beforeEach(() => {
  objectUrls = stubObjectUrl();
  enviados = espiarEnvios().enviados;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Imagem sintética pequena. `lastModified` diferente por nome: dois arquivos só são "o mesmo" se tudo coincidir. */
let relogio = 1_700_000_000_000;
const imagem = (nome: string, over: { tipo?: string; lastModified?: number } = {}) =>
  new File([`conteudo-${nome}`], nome, { type: over.tipo ?? '', lastModified: over.lastModified ?? (relogio += 1000) });
const comTamanho = (file: File, size: number) => {
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/** Monta a página do relatório `rf1` (com as fotos dadas) e devolve a API em memória. */
async function montar(fotos: Foto[] = [], extra: HttpHandler[] = []) {
  const api = servidorFotos([relatorio({ id: 'rf1', fotos })], { envios: enviados });
  server.use(...extra, ...api.handlers);
  renderApp(ROTA, 'Admin');
  await screen.findByRole('heading', { name: 'Enviar fotos', level: 2 });
  return api;
}

const campo = () => screen.getByLabelText(/Arraste as fotos aqui|Limite de 100 fotos atingido/);
const escolher = (...arquivos: File[]) => fireEvent.change(campo(), { target: { files: arquivos } });
const linha = (nome: string) => screen.getByTitle(nome).closest('li') as HTMLElement;

describe('Relatório fotográfico (admin) - envio: validação ao escolher', () => {
  it('recusa tipo, tamanho, nome longo, arquivo vazio e repetido, mostrando o motivo de cada um; os válidos entram', async () => {
    await montar();
    const nomeLongo = `${'n'.repeat(252)}.jpg`;
    expect(nomeLongo).toHaveLength(256);

    escolher(
      imagem('ok.jpg', { lastModified: 5 }),
      imagem('documento.pdf', { tipo: 'application/pdf' }),
      comTamanho(imagem('grande.jpg'), FOTO_MAX_BYTES + 1),
      imagem(nomeLongo),
      new File([], 'vazio.jpg'),
      imagem('ok.jpg', { lastModified: 5 }),
    );

    const aviso = (await screen.findByText('5 arquivos não foram adicionados:')).closest(
      '[role="alert"]',
    ) as HTMLElement;
    const motivos = within(aviso)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(motivos).toEqual([
      'documento.pdf: Só imagens são aceitas. Use: JPG, JPEG, PNG, WEBP, GIF.',
      'grande.jpg: O arquivo excede o tamanho máximo de 10 MB.',
      `${nomeLongo}: O nome do arquivo deve ter no máximo 255 caracteres.`,
      'vazio.jpg: O arquivo está vazio.',
      'ok.jpg: Este arquivo já está na fila de envio.',
    ]);
    // Só o primeiro ok.jpg entrou na fila.
    expect(screen.getByRole('button', { name: 'Enviar 1 foto' })).toBeEnabled();
    expect(within(screen.getByRole('region', { name: 'Fila de envio' })).getAllByRole('listitem')).toHaveLength(1);
    expect(enviados).toHaveLength(0);
  });

  it('aceita exatamente 10 MB e nome com exatamente 255 caracteres', async () => {
    await montar();
    const nome255 = `${'a'.repeat(251)}.png`;
    expect(nome255).toHaveLength(255);

    escolher(comTamanho(imagem('dez-mega.jpg'), FOTO_MAX_BYTES), imagem(nome255));

    expect(await screen.findByRole('button', { name: 'Enviar 2 fotos' })).toBeEnabled();
    expect(screen.queryByText(/não foi adicionado|não foram adicionados/)).not.toBeInTheDocument();
    expect(screen.getByTitle(nome255)).toBeInTheDocument();
  });

  it('extensão em maiúsculas (.JPG) é aceita', async () => {
    await montar();
    escolher(imagem('FOTO.JPG'));
    expect(await screen.findByRole('button', { name: 'Enviar 1 foto' })).toBeEnabled();
  });

  // Os testes do relatório cheio (98 e 100 fotos) estão em RelatorioFotograficoUploadLimite.test.tsx.

  it('nome de arquivo com HTML é mostrado como texto, nunca interpretado', async () => {
    await montar();
    const malicioso = '<img src=x onerror=alert(1)>.jpg';

    escolher(imagem(malicioso));

    expect(await screen.findByText(malicioso)).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('soltar arquivos na área também adiciona à fila', async () => {
    await montar();
    const area = screen.getByText(/Arraste as fotos aqui/).closest('label') as HTMLElement;

    fireEvent.drop(area, { dataTransfer: { files: [imagem('solta.jpg')] } });

    expect(await screen.findByRole('button', { name: 'Enviar 1 foto' })).toBeEnabled();
  });

  it('"Tirar da lista" remove um pendente e libera a prévia local (revoga o object URL)', async () => {
    await montar();
    escolher(imagem('a.jpg'), imagem('b.jpg'));
    await screen.findByRole('button', { name: 'Enviar 2 fotos' });
    const criados = objectUrls.createObjectURL.mock.calls.length;
    expect(criados).toBeGreaterThanOrEqual(2);
    const revogadosAntes = objectUrls.revokeObjectURL.mock.calls.length;

    await user().click(screen.getByRole('button', { name: 'Tirar a.jpg da lista' }));

    expect(screen.queryByTitle('a.jpg')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar 1 foto' })).toBeEnabled();
    expect(objectUrls.revokeObjectURL.mock.calls.length).toBeGreaterThan(revogadosAntes);
  });
});

describe('Relatório fotográfico (admin) - envio: metadados do lote', () => {
  it('data depois de amanhã é recusada e nada é enviado', async () => {
    const api = await montar();
    escolher(imagem('a.jpg'));
    fireEvent.change(screen.getByLabelText('Data das fotos'), { target: { value: '2999-01-01' } });

    await user().click(await screen.findByRole('button', { name: 'Enviar 1 foto' }));

    expect(await screen.findByText('A data deve estar entre 2000 e amanhã.')).toBeInTheDocument();
    expect(screen.getByLabelText('Data das fotos')).toHaveAttribute('aria-invalid', 'true');
    expect(api.chamadas.uploads).toHaveLength(0);
  });

  it('a data e a descrição do lote são aparadas e vão na query; o multipart leva só o campo "file"', async () => {
    const api = await montar();
    escolher(imagem('pilar.jpg'));
    await user().type(screen.getByLabelText('Descrição do lote'), '  Fundação & pilares: 50% ok  ');
    fireEvent.change(screen.getByLabelText('Data das fotos'), { target: { value: '2026-09-12' } });

    await user().click(await screen.findByRole('button', { name: 'Enviar 1 foto' }));

    await waitFor(() => expect(api.chamadas.uploads).toHaveLength(1));
    expect(api.chamadas.uploads[0]).toEqual({
      relatorioId: 'rf1',
      auth: `Bearer ${TOKEN}`,
      query: { dataFoto: '2026-09-12', descricao: 'Fundação & pilares: 50% ok' },
      nome: 'pilar.jpg',
      campos: ['file'],
    });
  });

  it('sem descrição nem data a query fica vazia (sem parâmetros em branco)', async () => {
    const api = await montar();
    escolher(imagem('a.jpg'));

    await user().click(await screen.findByRole('button', { name: 'Enviar 1 foto' }));

    await waitFor(() => expect(api.chamadas.uploads).toHaveLength(1));
    expect(api.chamadas.uploads[0]?.query).toEqual({});
  });

  it('o MIME vai pela extensão mesmo se o navegador mandou vazio', async () => {
    await montar();
    escolher(imagem('a.jpg'), imagem('b.png', { tipo: 'application/octet-stream' }), imagem('c.webp'));

    await user().click(await screen.findByRole('button', { name: 'Enviar 3 fotos' }));

    await waitFor(() => expect(enviados).toHaveLength(3));
    expect(enviados.map((e) => `${e.nome}:${e.tipo}`)).toEqual([
      'a.jpg:image/jpeg',
      'b.png:image/png',
      'c.webp:image/webp',
    ]);
  });
});

describe('Relatório fotográfico (admin) - envio: fila', () => {
  it('envia um por vez, na ordem escolhida, mostra o progresso e a lista de fotos já inclui as novas', async () => {
    let ativos = 0;
    let maximo = 0;
    const api = await montar(
      [],
      [
        http.post(POST_FOTOS, async () => {
          ativos += 1;
          maximo = Math.max(maximo, ativos);
          await delay(15);
          ativos -= 1;
          return undefined;
        }),
      ],
    );
    escolher(imagem('a.jpg'), imagem('b.jpg'), imagem('c.jpg'));

    await user().click(await screen.findByRole('button', { name: 'Enviar 3 fotos' }));

    expect(await screen.findByText('3 de 3 fotos enviadas')).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(maximo).toBe(1);
    expect(screen.getByRole('progressbar', { name: 'Progresso do envio' })).toHaveAttribute('aria-valuenow', '100');
    for (const nome of ['a.jpg', 'b.jpg', 'c.jpg'])
      expect(within(linha(nome)).getByText('Enviada')).toBeInTheDocument();
    // Ao fim da rodada o detalhe é relido e a grade mostra as 3 fotos novas (ordem 0, 1, 2).
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Fotos', level: 2 }).parentElement).toHaveTextContent('3 de 100'),
    );
    expect(api.relatorios()[0]?.fotos.map((f) => f.ordem)).toEqual([0, 1, 2]);
    expect(api.chamadas.detalhes).toBeGreaterThanOrEqual(2);
  });

  it('um 400 vira erro só naquele arquivo (com a mensagem do servidor); os outros seguem; "Tentar de novo" reenvia', async () => {
    let recusar = true;
    const api = await montar(
      [],
      [
        http.post(POST_FOTOS, () =>
          recusar && enviados.at(-1)?.nome === 'b.jpg'
            ? HttpResponse.json({ message: 'O arquivo não é uma imagem válida.' }, { status: 400 })
            : undefined,
        ),
      ],
    );
    escolher(imagem('a.jpg'), imagem('b.jpg'), imagem('c.jpg'));

    await user().click(await screen.findByRole('button', { name: 'Enviar 3 fotos' }));

    expect(await screen.findByText('2 de 3 fotos enviadas · 1 com erro')).toBeInTheDocument();
    expect(within(linha('b.jpg')).getByText('Erro')).toBeInTheDocument();
    expect(within(linha('b.jpg')).getByText('O arquivo não é uma imagem válida.')).toBeInTheDocument();
    expect(within(linha('a.jpg')).getByText('Enviada')).toBeInTheDocument();
    expect(within(linha('c.jpg')).getByText('Enviada')).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(screen.queryByText(/Envio interrompido/)).not.toBeInTheDocument();

    recusar = false;
    await user().click(screen.getByRole('button', { name: 'Tentar de novo (1)' }));

    expect(await screen.findByText('3 de 3 fotos enviadas')).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'b.jpg']);
    expect(within(linha('b.jpg')).getByText('Enviada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tentar de novo/ })).not.toBeInTheDocument();
    expect(api.chamadas.uploads).toHaveLength(3);
  });

  it('um 400 com errors de campo (sem message) mostra o texto do campo na linha da fila, não "Dados inválidos."', async () => {
    await montar(
      [],
      [
        http.post(POST_FOTOS, () =>
          HttpResponse.json({ errors: { DataFoto: ['Data fora do intervalo aceito.'] } }, { status: 400 }),
        ),
      ],
    );
    escolher(imagem('a.jpg'));

    await user().click(await screen.findByRole('button', { name: 'Enviar 1 foto' }));

    expect(await screen.findByText('0 de 1 foto enviadas · 1 com erro')).toBeInTheDocument();
    expect(within(linha('a.jpg')).getByText('Data fora do intervalo aceito.')).toBeInTheDocument();
    expect(screen.queryByText('Dados inválidos.')).not.toBeInTheDocument();
    // 400 de campo não interrompe a fila: dá para tentar de novo.
    expect(screen.queryByText(/Envio interrompido/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo (1)' })).toBeInTheDocument();
  });

  it('um 500 mostra o código de suporte na linha e a fila continua', async () => {
    await montar(
      [],
      [
        http.post(POST_FOTOS, () =>
          enviados.at(-1)?.nome === 'a.jpg'
            ? HttpResponse.json({ requestId: 'req-up-500', message: 'Erro interno.' }, { status: 500 })
            : undefined,
        ),
      ],
    );
    escolher(imagem('a.jpg'), imagem('b.jpg'));

    await user().click(await screen.findByRole('button', { name: 'Enviar 2 fotos' }));

    expect(await screen.findByText('1 de 2 fotos enviada · 1 com erro')).toBeInTheDocument();
    expect(within(linha('a.jpg')).getByText(/\(código: req-up-500\)/)).toBeInTheDocument();
    expect(within(linha('b.jpg')).getByText('Enviada')).toBeInTheDocument();
  });

  it('Cancelar fila durante o envio: o envio em andamento termina e os pendentes viram "Cancelada"', async () => {
    let liberar: () => void = () => undefined;
    const portao = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const api = await montar(
      [],
      [
        http.post(POST_FOTOS, async () => {
          await portao;
          return undefined;
        }),
      ],
    );
    escolher(imagem('a.jpg'), imagem('b.jpg'), imagem('c.jpg'));
    await user().click(await screen.findByRole('button', { name: 'Enviar 3 fotos' }));
    await waitFor(() => expect(enviados).toHaveLength(1));

    await user().click(screen.getByRole('button', { name: 'Cancelar fila' }));

    expect(await screen.findByText(/cancelando: aguardando o envio atual terminar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar fila' })).toBeDisabled();
    liberar();

    expect(await screen.findByText('1 de 3 fotos enviada · 2 canceladas')).toBeInTheDocument();
    expect(within(linha('a.jpg')).getByText('Enviada')).toBeInTheDocument();
    expect(within(linha('b.jpg')).getByText('Cancelada')).toBeInTheDocument();
    expect(within(linha('c.jpg')).getByText('Cancelada')).toBeInTheDocument();
    expect(enviados).toHaveLength(1);
    expect(api.chamadas.uploads).toHaveLength(1);
  });

  it('Cancelar fila antes de enviar cancela tudo sem chamar a API', async () => {
    const api = await montar();
    escolher(imagem('a.jpg'), imagem('b.jpg'));

    await user().click(await screen.findByRole('button', { name: 'Cancelar fila' }));

    expect(await screen.findByText('0 de 2 fotos enviadas · 2 canceladas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar 0 fotos' })).toBeDisabled();
    expect(enviados).toHaveLength(0);
    expect(api.chamadas.uploads).toHaveLength(0);
  });

  it.each([
    [403, 'Envio interrompido: Você não tem permissão para esta ação.'],
    [404, 'Envio interrompido: Não encontrado.'],
  ])('um %i interrompe a fila: o resto continua pendente e dá para retomar', async (status, mensagem) => {
    let falhar = true;
    const api = await montar(
      [],
      [http.post(POST_FOTOS, () => (falhar ? HttpResponse.json({}, { status }) : undefined))],
    );
    escolher(imagem('a.jpg'), imagem('b.jpg'), imagem('c.jpg'));

    await user().click(await screen.findByRole('button', { name: 'Enviar 3 fotos' }));

    expect(await screen.findByText(mensagem)).toBeInTheDocument();
    expect(
      screen.getByText('As fotos que não foram enviadas continuam na fila: corrija e envie de novo.'),
    ).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.jpg']);
    expect(within(linha('a.jpg')).getByText('Erro')).toBeInTheDocument();
    expect(within(linha('b.jpg')).getByText('Pendente')).toBeInTheDocument();
    expect(within(linha('c.jpg')).getByText('Pendente')).toBeInTheDocument();

    falhar = false;
    await user().click(screen.getByRole('button', { name: 'Enviar 2 fotos' }));

    expect(await screen.findByText('2 de 3 fotos enviadas · 1 com erro')).toBeInTheDocument();
    expect(enviados.map((e) => e.nome)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(api.chamadas.uploads).toHaveLength(2);
    expect(screen.queryByText(/Envio interrompido/)).not.toBeInTheDocument();
  });

  it('"Limpar finalizadas" tira da fila o que terminou', async () => {
    await montar();
    escolher(imagem('a.jpg'), imagem('b.jpg'));
    await user().click(await screen.findByRole('button', { name: 'Enviar 2 fotos' }));
    await screen.findByText('2 de 2 fotos enviadas');

    await user().click(screen.getByRole('button', { name: 'Limpar finalizadas' }));

    expect(screen.queryByRole('region', { name: 'Fila de envio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('não dá para tirar da lista o arquivo que está sendo enviado', async () => {
    let liberar: () => void = () => undefined;
    const portao = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    await montar(
      [],
      [
        http.post(POST_FOTOS, async () => {
          await portao;
          return undefined;
        }),
      ],
    );
    escolher(imagem('a.jpg'), imagem('b.jpg'));
    await user().click(await screen.findByRole('button', { name: 'Enviar 2 fotos' }));
    await waitFor(() => expect(enviados).toHaveLength(1));

    expect(screen.getByRole('button', { name: 'Tirar a.jpg da lista' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tirar b.jpg da lista' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    liberar();
    await screen.findByText('2 de 2 fotos enviadas');
  });

  it('403 no relatório inteiro (sem acesso): a fila para na primeira foto e não despeja requisições', async () => {
    const api = servidorFotos([relatorio({ id: 'rf1', fotos: [] })], { envios: enviados });
    server.use(erroEm('post', '/relatorios-fotograficos/rf1/fotos', 403), ...api.handlers);
    renderApp(ROTA, 'Admin');
    await screen.findByRole('heading', { name: 'Enviar fotos', level: 2 });
    const arquivos = Array.from({ length: 20 }, (_, i) => imagem(`f${i}.jpg`));
    escolher(...arquivos);

    await user().click(await screen.findByRole('button', { name: 'Enviar 20 fotos' }));

    expect(await screen.findByText(/Envio interrompido/)).toBeInTheDocument();
    expect(enviados).toHaveLength(1);
  });
});

describe('Relatório fotográfico (admin) - envio: papel', () => {
  it('cliente não monta a área de envio nem pede nada', async () => {
    const api = servidorFotos([relatorio({ id: 'rf1', fotos: fotosEmOrdem(2) })], { envios: enviados });
    server.use(...api.handlers);
    renderApp(ROTA, 'Client');

    expect(await screen.findByRole('heading', { name: 'Sem permissão' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Enviar fotos' })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(api.chamadas.uploads).toHaveLength(0);
  });
});
