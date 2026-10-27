import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { espiarEnvios, fotosEmOrdem, relatorio, servidorFotos, stubObjectUrl, detalheRota } from '@/test/fotosAdmin';
import { esperarTitulo2 } from '@/test/esperas';
import { renderApp } from '@/test/helpers';
import { server } from '@/test/server';
import type { Foto } from '@/interfaces/relatorioFotografico';

// Relatório cheio = ~100 cartões. A miniatura baixa a imagem de cada um (100 requisições no MSW + 100 trocas de estado,
// que ainda refazem cada `findBy*` no DOM inteiro): sob CPU saturada isso passava de 5 s. O limite de 100 fotos não
// depende da imagem, então a miniatura sai aqui. Miniatura e cartão com imagem de verdade: RelatorioFotograficoDetalheAdmin.test.
vi.mock('@/components/FotoMiniatura', () => ({ FotoMiniatura: () => null }));

const ROTA = detalheRota('rf1');

beforeEach(() => {
  stubObjectUrl();
});

afterEach(() => {
  vi.restoreAllMocks();
});

let relogio = 1_700_000_000_000;
const imagem = (nome: string) => new File([`conteudo-${nome}`], nome, { type: '', lastModified: (relogio += 1000) });

async function montar(fotos: Foto[]) {
  espiarEnvios();
  const api = servidorFotos([relatorio({ id: 'rf1', fotos })], { envios: [] });
  server.use(...api.handlers);
  renderApp(ROTA, 'Admin');
  await esperarTitulo2('Enviar fotos');
  return api;
}

// Com ~100 fotos no DOM, `getByLabelText`/`getByRole` sem escopo varrem centenas de nós: o input vai por seletor.
const inputArquivo = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const botaoPorTexto = async (texto: string) => (await screen.findByText(texto)).closest('button') as HTMLButtonElement;

describe('Relatório fotográfico (admin) - envio: limite de 100 fotos (relatório cheio)', () => {
  it('o relatório com 98 fotos aceita só 2: o resto é recusado pelo limite de 100 e o campo trava', async () => {
    await montar(fotosEmOrdem(98));

    fireEvent.change(inputArquivo(), {
      target: { files: [imagem('1.jpg'), imagem('2.jpg'), imagem('3.jpg'), imagem('4.jpg'), imagem('5.jpg')] },
    });

    expect(await botaoPorTexto('Enviar 2 fotos')).toBeEnabled();
    const aviso = screen.getByText('3 arquivos não foram adicionados:').closest('[role="alert"]') as HTMLElement;
    expect(within(aviso).getAllByText(/Limite de 100 fotos por relatório atingido\./)).toHaveLength(3);
    // 98 no servidor + 2 na fila = 100: nada mais entra.
    expect(inputArquivo()).toBeDisabled();
    expect(inputArquivo()).toHaveAccessibleName(/Limite de 100 fotos atingido/);
  });

  it('relatório já com 100 fotos: envio bloqueado e orientação para remover uma', async () => {
    await montar(fotosEmOrdem(100));

    expect(inputArquivo()).toBeDisabled();
    expect(inputArquivo()).toHaveAccessibleName(/Limite de 100 fotos atingido: remova uma foto/);
    expect(screen.queryByText(/^Enviar \d+ fotos?$/)).not.toBeInTheDocument();
  });
});
