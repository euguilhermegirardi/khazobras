import { describe, expect, it } from 'vitest';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { partirNome } from './projetoRegras';
import {
  PROJETO_CAMPOS_SERVIDOR,
  projetoFormFrom,
  projetoFormSchemaPara,
  semMudancas,
  toProjetoBody,
  validarLote,
  validarTipoDocumento,
} from './projetoForm';

const projeto = (over: Partial<ProjetoDocumento> = {}): ProjetoDocumento => ({
  id: 'p1',
  obraId: 'o1',
  etapaId: 'e1',
  nome: 'Planta baixa.pdf',
  tipoDocumento: 'Planta',
  uploadedAt: '2026-10-12T10:15:00Z',
  ...over,
});

const erros = (valores: { nome: string; tipoDocumento?: string; etapaId?: string }, extensao = '.pdf') => {
  const r = projetoFormSchemaPara(extensao).safeParse({ tipoDocumento: '', etapaId: '', ...valores });
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe('projetoFormSchemaPara', () => {
  it('valida só a base: aceita qualquer base não vazia, inclusive uma que já termina com a extensão', () => {
    expect(erros({ nome: 'Rev 2' })).toEqual({});
    expect(erros({ nome: 'Rev 2.pdf' })).toEqual({});
    expect(erros({ nome: 'a.b' })).toEqual({});
  });

  it('exige base, base + extensão no máximo 255, sem barras nem controle', () => {
    expect(erros({ nome: '   ' }).nome).toMatch(/Informe o nome/);
    expect(erros({ nome: 'a'.repeat(251) })).toEqual({});
    expect(erros({ nome: 'a'.repeat(252) }).nome).toBe(
      'O nome aceita no máximo 251 caracteres (a extensão .pdf já conta).',
    );
    expect(erros({ nome: 'a'.repeat(255) }, '')).toEqual({});
    expect(erros({ nome: 'a'.repeat(256) }, '').nome).toBe('O nome aceita no máximo 255 caracteres.');
    expect(erros({ nome: 'a/b' }).nome).toMatch(/barras/);
    expect(erros({ nome: 'a\\b' }).nome).toMatch(/barras/);
    expect(erros({ nome: 'a\u0001b' }).nome).toMatch(/controle/);
  });

  it('o limite conta a extensão na caixa original', () => {
    expect(erros({ nome: 'a'.repeat(251) }, '.PDF')).toEqual({});
    expect(erros({ nome: 'a'.repeat(250) }, '.jpeg')).toEqual({});
    expect(erros({ nome: 'a'.repeat(251) }, '.jpeg').nome).toMatch(/no máximo 250/);
  });

  it('tipo: até 50 caracteres (50 passa), sem controle; vazio vale', () => {
    expect(erros({ nome: 'a', tipoDocumento: 'x'.repeat(50) })).toEqual({});
    expect(erros({ nome: 'a', tipoDocumento: 'x'.repeat(51) }).tipoDocumento).toMatch(/no máximo 50/);
    expect(erros({ nome: 'a', tipoDocumento: 'a\u0000b' }).tipoDocumento).toMatch(/controle/);
    expect(erros({ nome: 'a', tipoDocumento: '' })).toEqual({});
  });
});

describe('toProjetoBody / projetoFormFrom / semMudancas', () => {
  it('manda sempre os três campos; vazio vira null, a base é aparada e a extensão é reanexada', () => {
    expect(toProjetoBody({ nome: ' Rev ', tipoDocumento: '  ', etapaId: '' }, '.pdf')).toEqual({
      nome: 'Rev.pdf',
      tipoDocumento: null,
      etapaId: null,
    });
    expect(toProjetoBody({ nome: 'a', tipoDocumento: ' Memorial ', etapaId: 'e2' }, '.PDF')).toEqual({
      nome: 'a.PDF',
      tipoDocumento: 'Memorial',
      etapaId: 'e2',
    });
  });

  it('base que já termina com a extensão vira "x.pdf.pdf" (sem ser esperto); sem extensão, só a base', () => {
    expect(toProjetoBody({ nome: 'x.pdf', tipoDocumento: '', etapaId: '' }, '.pdf').nome).toBe('x.pdf.pdf');
    expect(toProjetoBody({ nome: 'x', tipoDocumento: '', etapaId: '' }, '').nome).toBe('x');
  });

  it('formulário parte da base e dos valores salvos (null vira vazio)', () => {
    expect(projetoFormFrom(projeto({ etapaId: null, tipoDocumento: null }))).toEqual({
      nome: 'Planta baixa',
      tipoDocumento: '',
      etapaId: '',
    });
    expect(projetoFormFrom(projeto({ nome: 'a.b.PDF' })).nome).toBe('a.b');
  });

  it('detecta "nada mudou" usando a extensão original', () => {
    const p = projeto();
    const { extensao } = partirNome(p.nome);
    const body = toProjetoBody(projetoFormFrom(p), extensao);
    expect(semMudancas(body, p)).toBe(true);
    expect(semMudancas({ ...body, etapaId: null }, p)).toBe(false);
    expect(semMudancas({ ...body, tipoDocumento: null }, p)).toBe(false);
    expect(semMudancas({ ...body, nome: 'Outro.pdf' }, p)).toBe(false);
    const maiusculo = projeto({ nome: 'Planta.PDF' });
    expect(semMudancas(toProjetoBody(projetoFormFrom(maiusculo), '.PDF'), maiusculo)).toBe(true);
  });
});

describe('lote e erros do servidor', () => {
  it('valida o tipo do lote', () => {
    expect(validarLote({ tipoDocumento: 'x'.repeat(51), etapaId: '' }).tipoDocumento).toMatch(/50/);
    expect(validarLote({ tipoDocumento: '', etapaId: '' })).toEqual({});
    expect(validarTipoDocumento('Planta baixa')).toBeNull();
  });

  it('liga as chaves do 400 aos campos (minúsculas)', () => {
    expect(PROJETO_CAMPOS_SERVIDOR).toEqual({ nome: 'nome', tipodocumento: 'tipoDocumento', etapaid: 'etapaId' });
  });
});
