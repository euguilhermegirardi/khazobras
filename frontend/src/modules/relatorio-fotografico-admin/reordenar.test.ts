import { describe, expect, it } from 'vitest';
import type { Foto } from '@/interfaces/relatorioFotografico';
import { moverFoto, ordemAlterada } from './reordenar';

const foto = (id: string, ordem: number, createdAt = '2026-10-12T10:00:00Z'): Foto => ({ id, ordem, createdAt });

describe('moverFoto', () => {
  const fotos = [foto('a', 0), foto('b', 1), foto('c', 2)];

  it('troca com a vizinha e renumera de 0 a n-1', () => {
    const depois = moverFoto(fotos, 'b', -1);
    expect(depois?.map((f) => [f.id, f.ordem])).toEqual([
      ['b', 0],
      ['a', 1],
      ['c', 2],
    ]);
  });

  it('move para depois', () => {
    expect(moverFoto(fotos, 'a', 1)?.map((f) => f.id)).toEqual(['b', 'a', 'c']);
  });

  it('devolve null nas pontas e para id desconhecido', () => {
    expect(moverFoto(fotos, 'a', -1)).toBeNull();
    expect(moverFoto(fotos, 'c', 1)).toBeNull();
    expect(moverFoto(fotos, 'x', 1)).toBeNull();
  });

  it('parte da ordem do servidor (ordem, createdAt, id), mesmo com o array fora de ordem e ordem repetida', () => {
    const embaralhadas = [
      foto('c', 0, '2026-10-12T10:02:00Z'),
      foto('a', 0, '2026-10-12T10:00:00Z'),
      foto('b', 0, '2026-10-12T10:01:00Z'),
    ];
    expect(moverFoto(embaralhadas, 'a', 1)?.map((f) => [f.id, f.ordem])).toEqual([
      ['b', 0],
      ['a', 1],
      ['c', 2],
    ]);
  });

  it('não altera o array recebido', () => {
    const copia = JSON.parse(JSON.stringify(fotos)) as Foto[];
    moverFoto(fotos, 'b', 1);
    expect(fotos).toEqual(copia);
  });
});

describe('ordemAlterada', () => {
  it('lista só as fotos cuja ordem mudou', () => {
    const antes = [foto('a', 0), foto('b', 1), foto('c', 2)];
    const depois = moverFoto(antes, 'b', 1) ?? [];
    expect(ordemAlterada(antes, depois)).toEqual([
      { id: 'c', ordem: 1 },
      { id: 'b', ordem: 2 },
    ]);
  });

  it('com ordem repetida, a troca nunca gera lote vazio', () => {
    const antes = [foto('a', 1, '2026-10-12T10:00:00Z'), foto('b', 1, '2026-10-12T10:01:00Z'), foto('c', 5)];
    const depois = moverFoto(antes, 'a', 1) ?? [];
    expect(ordemAlterada(antes, depois).length).toBeGreaterThan(0);
  });

  it('nada mudou = lista vazia', () => {
    const fotos = [foto('a', 0), foto('b', 1)];
    expect(ordemAlterada(fotos, fotos)).toEqual([]);
  });
});
