import { describe, expect, it } from 'vitest';
import type { Etapa } from '@/interfaces/etapa';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { agruparPorEtapa } from './agrupar';

const doc = (id: string, etapaId: string | null): ProjetoDocumento => ({
  id,
  obraId: 'o1',
  etapaId,
  nome: `${id}.pdf`,
  tipoDocumento: null,
  uploadedAt: '2026-03-10T12:00:00Z',
});
const etapa = (id: string, nome: string, ordem: number): Etapa => ({ id, obraId: 'o1', nome, ordem });

describe('agruparPorEtapa', () => {
  it('mantém a ordem do backend e põe "Documentos gerais" por último', () => {
    const grupos = agruparPorEtapa(
      [doc('a', 'e1'), doc('b', 'e2'), doc('c', 'e1'), doc('g', null)],
      [etapa('e1', 'Fundação', 1), etapa('e2', 'Alvenaria', 2)],
    );
    expect(grupos.map((g) => g.titulo)).toEqual(['Fundação', 'Alvenaria', 'Documentos gerais']);
    expect(grupos[0]?.projetos.map((p) => p.id)).toEqual(['a', 'c']);
    expect(grupos[2]?.projetos.map((p) => p.id)).toEqual(['g']);
  });

  it('segue a ordem de aparição dos projetos, não a da lista de etapas', () => {
    const grupos = agruparPorEtapa(
      [doc('b', 'e2'), doc('a', 'e1')],
      [etapa('e1', 'Fundação', 1), etapa('e2', 'Alvenaria', 2)],
    );
    expect(grupos.map((g) => g.titulo)).toEqual(['Alvenaria', 'Fundação']);
  });

  it('etapa desconhecida (ou etapas vazias) vai para "Outros documentos", antes de "Documentos gerais"', () => {
    const grupos = agruparPorEtapa([doc('a', 'e1'), doc('x', 'zzz'), doc('g', null)], [etapa('e1', 'Fundação', 1)]);
    expect(grupos.map((g) => g.titulo)).toEqual(['Fundação', 'Outros documentos', 'Documentos gerais']);

    const semEtapas = agruparPorEtapa([doc('a', 'e1')], []);
    expect(semEtapas.map((g) => g.titulo)).toEqual(['Outros documentos']);
  });

  it('lista vazia gera nenhum grupo; não cria grupo vazio', () => {
    expect(agruparPorEtapa([], [etapa('e1', 'Fundação', 1)])).toEqual([]);
    expect(agruparPorEtapa([doc('g', null)], [etapa('e1', 'Fundação', 1)]).map((g) => g.titulo)).toEqual([
      'Documentos gerais',
    ]);
  });
});
