import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { espiarEnvios, type Envio } from '@/test/fotosAdmin';
import { esperarTitulo2 } from '@/test/esperas';
import { renderApp } from '@/test/helpers';
import { documentos, OBRA_ID, ROTA, servidorProjetos } from '@/test/projetosAdmin';
import { API, server } from '@/test/server';

// Obra cheia = ~200 linhas no jsdom. Os ícones (5 SVGs por linha, `aria-hidden`) custavam cerca de metade do tempo de
// render e de cada re-render da tabela; nenhum destes testes olha ícone, então eles saem aqui. Num Mac lento a tela
// cheia estourava os 30 s. O resto da tela de envio (com os ícones de verdade) é testado em ProjetosAdminUpload.test.
vi.mock('lucide-react', async (original) => {
  const modulo = await original<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(modulo).map((nome) => [nome, () => null]));
});

const POST_PROJETOS = `${API}/obras/${OBRA_ID}/projetos`;

let enviados: Envio[] = [];

beforeEach(() => {
  enviados = espiarEnvios().enviados;
});

afterEach(() => {
  vi.restoreAllMocks();
});

let relogio = 1_700_000_000_000;
const doc = (nome: string) => new File([`conteudo-${nome}`], nome, { type: '', lastModified: (relogio += 1000) });

/** Monta a tela com os documentos dados (e handlers extras com prioridade). */
async function montar(inicial: ProjetoDocumento[], extra: Parameters<typeof server.use>[0][] = []) {
  const api = servidorProjetos(inicial, { envios: enviados, limite: 200 });
  server.use(...extra, ...api.handlers);
  renderApp(ROTA, 'Admin');
  // Espera por seletor: `findByRole`/`findByText` refazem a consulta no DOM de ~200 linhas a cada mutação.
  await esperarTitulo2('Enviar documentos');
  return api;
}

describe('Projetos (admin) - envio: limite de 200 documentos (obra cheia)', () => {
  // Com ~200 linhas no DOM, `getByRole` sem escopo (checa visibilidade de cada nó via getComputedStyle) e
  // `getByLabelText` (varre todos os aria-label) custam de 0,8 a 1 s cada na nuvem e muito mais num Mac lento.
  // Aqui: input por seletor, linha por seletor + `within`, botão por texto, `hidden: true` onde a visibilidade não é
  // o assunto e `fireEvent.click` nos cliques simples (o `userEvent` percorre o DOM a cada clique). A intenção é a mesma.
  const inputArquivo = () => document.querySelector('input[type="file"]') as HTMLInputElement;
  const escolherRapido = (...arquivos: File[]) => fireEvent.change(inputArquivo(), { target: { files: arquivos } });
  const filaRapida = () => screen.getByRole('region', { name: 'Fila de envio', hidden: true });
  const botao = async (texto: string) => (await screen.findByText(texto)).closest('button') as HTMLButtonElement;

  it('a obra com 198 documentos aceita só 2: o resto é recusado pelo limite e a área trava', async () => {
    await montar(documentos(198));

    escolherRapido(doc('1.pdf'), doc('2.pdf'), doc('3.pdf'), doc('4.pdf'), doc('5.pdf'));

    expect(await botao('Enviar 2 documentos')).toBeEnabled();
    const aviso = screen.getByText('3 arquivos não foram adicionados:').closest('[role="alert"]') as HTMLElement;
    expect(within(aviso).getAllByText(/Limite de 200 documentos por obra atingido\./)).toHaveLength(3);
    // 198 no servidor + 2 na fila = 200: nada mais entra.
    expect(inputArquivo()).toBeDisabled();
    expect(inputArquivo()).toHaveAccessibleName(/Limite de 200 documentos atingido/);
  });

  it('obra já com 200 documentos: área desabilitada com orientação, sem botão de enviar', async () => {
    await montar(documentos(200));

    expect(inputArquivo()).toBeDisabled();
    expect(inputArquivo()).toHaveAccessibleName(
      /Limite de 200 documentos atingido: exclua um documento para enviar outro\./,
    );
    expect(screen.getByText(/A obra tem 200 de 200 documentos\./)).toBeInTheDocument();
    expect(screen.queryByText(/^Enviar \d+ documentos?$/)).not.toBeInTheDocument();
  });

  it('excluir um documento da obra cheia libera a área de envio', async () => {
    await montar(documentos(200));
    expect(inputArquivo()).toBeDisabled();

    const linhaDoc = document.querySelector('[title="doc-1.pdf"]')?.closest('tr') as HTMLElement;
    fireEvent.click(within(linhaDoc).getByRole('button', { name: 'Excluir doc-1.pdf', hidden: true }));
    fireEvent.click(await botao('Excluir definitivamente'));

    await screen.findByText('Documento excluído.');
    await waitFor(() => expect(inputArquivo()).toBeEnabled());
    expect(screen.getByText(/A obra tem 199 de 200 documentos\./)).toBeInTheDocument();
  });

  it('o 201º documento (servidor recusa com 400 {message}) vira erro só naquela linha', async () => {
    await montar(documentos(199), [
      http.post(POST_PROJETOS, () =>
        enviados.at(-1)?.nome === 'ultimo.pdf'
          ? HttpResponse.json({ message: 'A obra já tem o máximo de 200 documentos.' }, { status: 400 })
          : undefined,
      ),
    ]);
    escolherRapido(doc('ultimo.pdf'));

    fireEvent.click(await botao('Enviar 1 documento'));

    expect(await within(filaRapida()).findByText('A obra já tem o máximo de 200 documentos.')).toBeInTheDocument();
    const linhaFila = within(filaRapida()).getByTitle('ultimo.pdf').closest('li') as HTMLElement;
    expect(within(linhaFila).getByText('Erro')).toBeInTheDocument();
    expect(screen.queryByText(/Envio interrompido/)).not.toBeInTheDocument();
  });
});
