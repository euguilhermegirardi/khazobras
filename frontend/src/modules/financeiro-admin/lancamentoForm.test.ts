import { describe, expect, it } from 'vitest';
import type { LancamentoAdmin } from '@/interfaces/financeiroAdmin';
import {
  isMesValido,
  lancamentoFormDefaults,
  lancamentoFormFrom,
  lancamentoFormSchema,
  type LancamentoFormValues,
  toLancamentoBody,
} from './lancamentoForm';

const valido: LancamentoFormValues = {
  categoria: 'material',
  descricao: ' Cimento CP-II ',
  valor: '1500,50',
  dataLancamento: '2026-09-10',
  mesCompetencia: '2026-09',
  visivelCliente: false,
};

const erros = (v: LancamentoFormValues) => {
  const r = lancamentoFormSchema.safeParse(v);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe('lancamentoFormSchema', () => {
  it('aceita um lançamento válido', () => {
    expect(erros(valido)).toEqual({});
  });

  it('exige categoria do enum', () => {
    expect(erros({ ...valido, categoria: '' }).categoria).toBeDefined();
    expect(erros({ ...valido, categoria: 'outra' }).categoria).toBeDefined();
    expect(erros({ ...valido, categoria: 'mao_de_obra' }).categoria).toBeUndefined();
    expect(erros({ ...valido, categoria: 'equipamento' }).categoria).toBeUndefined();
  });

  it('descrição obrigatória e no máximo 255 caracteres', () => {
    expect(erros({ ...valido, descricao: '   ' }).descricao).toBeDefined();
    expect(erros({ ...valido, descricao: 'x'.repeat(256) }).descricao).toBeDefined();
    expect(erros({ ...valido, descricao: 'x'.repeat(255) }).descricao).toBeUndefined();
  });

  it('valor > 0, até 2 casas e no limite de NUMERIC(14,2)', () => {
    for (const valor of ['', '0', '0,00', '-5', '10,999', 'abc', '1000000000000']) {
      expect(erros({ ...valido, valor }).valor).toBeDefined();
    }
    expect(erros({ ...valido, valor: '999999999999,99' }).valor).toBeUndefined();
    expect(erros({ ...valido, valor: '0,01' }).valor).toBeUndefined();
    expect(erros({ ...valido, valor: '1500.5' }).valor).toBeUndefined();
  });

  it('data real entre os anos 2000 e 2100', () => {
    for (const dataLancamento of ['', '2026-02-31', '1999-12-31', '2101-01-01', '10/09/2026']) {
      expect(erros({ ...valido, dataLancamento }).dataLancamento).toBeDefined();
    }
    expect(erros({ ...valido, dataLancamento: '2024-02-29' }).dataLancamento).toBeUndefined();
  });

  it('competência yyyy-MM entre os anos 2000 e 2100', () => {
    for (const mesCompetencia of ['', '2026-13', '2026-00', '2026-9', '1999-12', '2101-01', 'setembro']) {
      expect(erros({ ...valido, mesCompetencia }).mesCompetencia).toBeDefined();
    }
    expect(erros({ ...valido, mesCompetencia: '2026-12' }).mesCompetencia).toBeUndefined();
  });
});

describe('isMesValido', () => {
  it('só yyyy-MM completo', () => {
    expect(isMesValido('2026-09')).toBe(true);
    expect(isMesValido('2026-9')).toBe(false);
    expect(isMesValido('2026-09-01')).toBe(false);
  });
});

describe('toLancamentoBody', () => {
  it('converte para o contrato da API (valor numérico, competência no dia 1, descrição aparada)', () => {
    expect(toLancamentoBody(valido)).toEqual({
      categoria: 'material',
      descricao: 'Cimento CP-II',
      valor: 1500.5,
      dataLancamento: '2026-09-10',
      mesCompetencia: '2026-09-01',
      visivelCliente: false,
    });
  });
});

describe('valores iniciais', () => {
  it('lançamento novo: hoje, competência = mês de hoje e OCULTO ao cliente', () => {
    expect(lancamentoFormDefaults(new Date(2026, 9, 20))).toEqual({
      categoria: '',
      descricao: '',
      valor: '',
      dataLancamento: '2026-10-20',
      mesCompetencia: '2026-10',
      visivelCliente: false,
    });
  });

  it('editar: categoria PascalCase vira snake_case, valor com vírgula e competência yyyy-MM', () => {
    const lancamento: LancamentoAdmin = {
      id: 'l1',
      obraId: 'o1',
      categoria: 'MaoDeObra',
      descricao: 'Pedreiro',
      valor: 2300.75,
      dataLancamento: '2026-10-05',
      mesCompetencia: '2026-10-01',
      visivelCliente: true,
      createdAt: '2026-10-05T12:00:00Z',
      anexos: [],
    };
    expect(lancamentoFormFrom(lancamento)).toEqual({
      categoria: 'mao_de_obra',
      descricao: 'Pedreiro',
      valor: '2300,75',
      dataLancamento: '2026-10-05',
      mesCompetencia: '2026-10',
      visivelCliente: true,
    });
  });
});
