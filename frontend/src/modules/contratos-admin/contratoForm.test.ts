import { describe, expect, it } from 'vitest';
import { contratoFormSchema, type ContratoFormValues, isDataValida, toCreateContratoBody } from './contratoForm';
import { mapServerErrors } from './serverErrors';
import { CONTRATO_CAMPOS_SERVIDOR } from './contratoForm';

const valido: ContratoFormValues = {
  numero: ' CT-2026/01 ',
  valorContratado: '125000,55',
  dataAssinatura: '2026-03-15',
};

const erros = (v: ContratoFormValues) => {
  const r = contratoFormSchema.safeParse(v);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe('contratoFormSchema', () => {
  it('aceita um contrato válido, com ou sem data', () => {
    expect(erros(valido)).toEqual({});
    expect(erros({ ...valido, dataAssinatura: '' })).toEqual({});
  });

  it('exige número, no máximo 50 caracteres e sem caracteres de controle', () => {
    expect(erros({ ...valido, numero: '   ' }).numero).toBeDefined();
    expect(erros({ ...valido, numero: 'x'.repeat(51) }).numero).toBeDefined();
    expect(erros({ ...valido, numero: 'x'.repeat(50) }).numero).toBeUndefined();
    expect(erros({ ...valido, numero: 'CT\u0007' }).numero).toBeDefined();
  });

  it('valor precisa ser maior que zero, com até 2 casas e dentro do limite', () => {
    for (const valorContratado of ['', '0', '0,00', '-5', '10,999', 'abc', '1000000000000']) {
      expect(erros({ ...valido, valorContratado }).valorContratado).toBeDefined();
    }
    expect(erros({ ...valido, valorContratado: '999999999999,99' }).valorContratado).toBeUndefined();
  });

  it('data de assinatura entre 2000 e 2100 e real', () => {
    expect(erros({ ...valido, dataAssinatura: '1999-12-31' }).dataAssinatura).toBeDefined();
    expect(erros({ ...valido, dataAssinatura: '2101-01-01' }).dataAssinatura).toBeDefined();
    expect(erros({ ...valido, dataAssinatura: '2026-02-31' }).dataAssinatura).toBeDefined();
  });
});

describe('toCreateContratoBody', () => {
  it('apara o número, converte o valor e usa null sem data', () => {
    expect(toCreateContratoBody('obra-1', valido)).toEqual({
      obraId: 'obra-1',
      numero: 'CT-2026/01',
      valorContratado: 125000.55,
      dataAssinatura: '2026-03-15',
    });
    expect(toCreateContratoBody('obra-1', { ...valido, dataAssinatura: '' }).dataAssinatura).toBeNull();
  });
});

describe('isDataValida', () => {
  it('rejeita dias que não existem', () => {
    expect(isDataValida('2024-02-29')).toBe(true);
    expect(isDataValida('2026-02-29')).toBe(false);
    expect(isDataValida('26-02-01')).toBe(false);
  });
});

describe('mapServerErrors', () => {
  it('liga a chave do servidor ao campo e separa o resto em gerais', () => {
    const { campos, gerais } = mapServerErrors(
      { Numero: ['Repetido.'], ValorContratado: ['Muito alto.'], ObraId: ['Inválida.'] },
      CONTRATO_CAMPOS_SERVIDOR,
    );
    expect(campos).toEqual({ numero: 'Repetido.', valorContratado: 'Muito alto.' });
    expect(gerais).toEqual(['Inválida.']);
  });
});
