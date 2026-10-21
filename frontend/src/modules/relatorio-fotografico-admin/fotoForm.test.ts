import { describe, expect, it } from 'vitest';
import type { Foto } from '@/interfaces/relatorioFotografico';
import { dataMaximaFoto, toFotoPatch, validarLote } from './fotoForm';

const hoje = new Date(2026, 9, 20); // 20/10/2026
const foto: Foto = {
  id: 'f',
  ordem: 0,
  createdAt: '2026-10-12T10:00:00Z',
  descricao: 'Fundação',
  dataFoto: '2026-09-05',
};

describe('toFotoPatch', () => {
  it('manda só o que mudou', () => {
    expect(toFotoPatch({ descricao: 'Fachada', dataFoto: '2026-09-05' }, foto)).toEqual({ descricao: 'Fachada' });
    expect(toFotoPatch({ descricao: 'Fundação', dataFoto: '2026-09-06' }, foto)).toEqual({ dataFoto: '2026-09-06' });
  });

  it('texto vazio limpa (null) e nada mudou = objeto vazio', () => {
    expect(toFotoPatch({ descricao: '   ', dataFoto: '' }, foto)).toEqual({ descricao: null, dataFoto: null });
    expect(toFotoPatch({ descricao: ' Fundação ', dataFoto: '2026-09-05' }, foto)).toEqual({});
  });

  it('foto sem descrição nem data: vazio continua sem mudança', () => {
    const vazia: Foto = { id: 'g', ordem: 1, createdAt: '2026-10-12T10:00:00Z', descricao: null, dataFoto: null };
    expect(toFotoPatch({ descricao: '', dataFoto: '' }, vazia)).toEqual({});
  });
});

describe('validarLote', () => {
  it('campos vazios são válidos (ambos opcionais)', () => {
    expect(validarLote({ descricao: '', dataFoto: '' }, hoje)).toEqual({});
  });

  it('descrição de até 255 passa e de 256 não', () => {
    expect(validarLote({ descricao: 'a'.repeat(255), dataFoto: '' }, hoje)).toEqual({});
    expect(validarLote({ descricao: 'a'.repeat(256), dataFoto: '' }, hoje).descricao).toMatch(/255/);
  });

  it('data: de 2000-01-01 até amanhã', () => {
    expect(dataMaximaFoto(hoje)).toBe('2026-10-21');
    expect(validarLote({ descricao: '', dataFoto: '2026-10-21' }, hoje)).toEqual({});
    expect(validarLote({ descricao: '', dataFoto: '2026-10-22' }, hoje).dataFoto).toBeDefined();
    expect(validarLote({ descricao: '', dataFoto: '2000-01-01' }, hoje)).toEqual({});
    expect(validarLote({ descricao: '', dataFoto: '1999-12-31' }, hoje).dataFoto).toBeDefined();
    expect(validarLote({ descricao: '', dataFoto: '2026-02-31' }, hoje).dataFoto).toMatch(/válida/);
  });
});
