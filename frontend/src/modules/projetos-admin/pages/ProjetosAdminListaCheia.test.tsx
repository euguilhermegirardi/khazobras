import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/helpers';
import { projeto, ROTA, servidorProjetos } from '@/test/projetosAdmin';
import { server } from '@/test/server';

// Obra cheia = ~200 linhas no jsdom; os ícones (SVGs por linha) custam cerca de metade do render e este teste não olha
// ícone. Arquivo próprio com lucide-react stubado: num Mac lento a versão com ícones estourava os 30 s.
vi.mock('lucide-react', async (original) => {
  const modulo = await original<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(modulo).map((nome) => [nome, () => null]));
});

describe('Projetos (admin) - lista cheia', () => {
  it('200 documentos com nomes de 255 caracteres: todos listados, com ações pelo nome exato', async () => {
    const longo = (i: number) => `${String(i).padStart(3, '0')}-${'n'.repeat(247)}.pdf`;
    const todos = Array.from({ length: 200 }, (_, i) => projeto(`d${i}`, { nome: longo(i) }));
    expect(longo(7)).toHaveLength(255);
    const api = servidorProjetos(todos);
    server.use(...api.handlers);
    renderApp(ROTA, 'Admin');

    await screen.findByText('200 documentos');
    // `hidden: true` e `within(linha)`: com 200 linhas, `getByRole` sem escopo checa a visibilidade de cada nó e
    // calcula o nome de ~800 botões.
    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(201);
    const linhaDe = (nome: string) => screen.getByTitle(nome).closest('tr') as HTMLElement;
    expect(
      within(linhaDe(longo(199))).getByRole('button', { name: `Excluir ${longo(199)}`, hidden: true }),
    ).toBeInTheDocument();
    expect(
      within(linhaDe(longo(0))).getByRole('button', { name: `Editar ${longo(0)}`, hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByText(/A obra tem 200 de 200 documentos\./)).toBeInTheDocument();
  });
});
