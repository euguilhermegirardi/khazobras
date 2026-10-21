import { describe, expect, it } from 'vitest';
import type { ProjetoDocumento } from '@/interfaces/projeto';
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
  it('aceita nome com a extensão do arquivo, sem diferenciar maiúsculas', () => {
    expect(erros({ nome: 'Rev 2.pdf' })).toEqual({});
    expect(erros({ nome: 'REV 2.PDF' })).toEqual({});
  });

  it('exige nome, no máximo 255, sem barras nem controle', () => {
    expect(erros({ nome: '   ' }).nome).toMatch(/Informe o nome/);
    expect(erros({ nome: `${'a'.repeat(252)}.pdf` }).nome).toMatch(/no máximo 255/);
    expect(erros({ nome: 'a/b.pdf' }).nome).toMatch(/barras/);
    expect(erros({ nome: 'a\\b.pdf' }).nome).toMatch(/barras/);
    expect(erros({ nome: 'a\u0001b.pdf' }).nome).toMatch(/controle/);
  });

  it('exige manter a extensão do arquivo', () => {
    expect(erros({ nome: 'planta' }).nome).toMatch(/\.pdf/);
    expect(erros({ nome: 'planta.docx' }).nome).toMatch(/\.pdf/);
    expect(erros({ nome: 'planta.pdf.txt' }).nome).toMatch(/\.pdf/);
  });

  it('tipo: até 50 caracteres (50 passa), sem controle; vazio vale', () => {
    expect(erros({ nome: 'a.pdf', tipoDocumento: 'x'.repeat(50) })).toEqual({});
    expect(erros({ nome: 'a.pdf', tipoDocumento: 'x'.repeat(51) }).tipoDocumento).toMatch(/no máximo 50/);
    expect(erros({ nome: 'a.pdf', tipoDocumento: 'a\u0000b' }).tipoDocumento).toMatch(/controle/);
    expect(erros({ nome: 'a.pdf', tipoDocumento: '' })).toEqual({});
  });
});

describe('toProjetoBody / projetoFormFrom / semMudancas', () => {
  it('manda sempre os três campos; vazio vira null e o texto é aparado', () => {
    expect(toProjetoBody({ nome: ' Rev.pdf ', tipoDocumento: '  ', etapaId: '' })).toEqual({
      nome: 'Rev.pdf',
      tipoDocumento: null,
      etapaId: null,
    });
    expect(toProjetoBody({ nome: 'a.pdf', tipoDocumento: ' Memorial ', etapaId: 'e2' })).toEqual({
      nome: 'a.pdf',
      tipoDocumento: 'Memorial',
      etapaId: 'e2',
    });
  });

  it('formulário parte dos valores salvos (null vira vazio)', () => {
    expect(projetoFormFrom(projeto({ etapaId: null, tipoDocumento: null }))).toEqual({
      nome: 'Planta baixa.pdf',
      tipoDocumento: '',
      etapaId: '',
    });
  });

  it('detecta "nada mudou"', () => {
    const p = projeto();
    expect(semMudancas(toProjetoBody(projetoFormFrom(p)), p)).toBe(true);
    expect(semMudancas({ ...toProjetoBody(projetoFormFrom(p)), etapaId: null }, p)).toBe(false);
    expect(semMudancas({ ...toProjetoBody(projetoFormFrom(p)), tipoDocumento: null }, p)).toBe(false);
    expect(semMudancas({ ...toProjetoBody(projetoFormFrom(p)), nome: 'Outro.pdf' }, p)).toBe(false);
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
