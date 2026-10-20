import { describe, expect, it } from 'vitest';
import { emitirNfSchema, mapNfServerErrors, toIssueInvoiceBody } from './emitirNfForm';

const mensagem = (nfNumber: string): string | undefined => {
  const result = emitirNfSchema.safeParse({ nfNumber });
  return result.success ? undefined : result.error.issues[0]?.message;
};

describe('emitirNfSchema', () => {
  it('aceita um número comum e 50 caracteres', () => {
    expect(mensagem('NF-000123')).toBeUndefined();
    expect(mensagem('9'.repeat(50))).toBeUndefined();
  });

  it('recusa vazio ou só espaços', () => {
    expect(mensagem('')).toBe('Informe o número da nota fiscal.');
    expect(mensagem('   ')).toBe('Informe o número da nota fiscal.');
  });

  it('recusa mais de 50 caracteres', () => {
    expect(mensagem('9'.repeat(51))).toMatch(/no máximo 50/);
  });

  it('recusa caracteres de controle no meio do número', () => {
    expect(mensagem('12\u0000345')).toMatch(/inválidos/);
    expect(mensagem('12\n345')).toMatch(/inválidos/);
  });
});

describe('toIssueInvoiceBody', () => {
  it('envia o número sem espaços nas pontas', () => {
    expect(toIssueInvoiceBody({ nfNumber: '  NF-1  ' })).toEqual({ nfNumber: 'NF-1' });
  });
});

describe('mapNfServerErrors', () => {
  it('manda NfNumber para o campo e o resto para as gerais', () => {
    expect(mapNfServerErrors({ NfNumber: ['Informe o numero da nota fiscal.'], Outro: ['x'] })).toEqual({
      nfNumber: 'Informe o numero da nota fiscal.',
      gerais: ['x'],
    });
  });

  it('sem erros devolve vazio', () => {
    expect(mapNfServerErrors(undefined)).toEqual({ nfNumber: undefined, gerais: [] });
  });
});
