import { describe, expect, it } from 'vitest';
import type { LancamentoAdmin } from '@/interfaces/financeiroAdmin';
import { mapServerErrors } from '@/utils/serverErrors';
import {
  isMesValido,
  LANCAMENTO_CAMPOS_SERVIDOR,
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

describe('lancamentoFormSchema - bordas', () => {
  it('valor: espaços nas pontas e vírgula ou ponto decimal; separador de milhar é recusado', () => {
    expect(erros({ ...valido, valor: ' 10,50 ' }).valor).toBeUndefined();
    expect(erros({ ...valido, valor: '10.50' }).valor).toBeUndefined();
    expect(erros({ ...valido, valor: '1.500,50' }).valor).toBeDefined();
    expect(erros({ ...valido, valor: '1e3' }).valor).toBeDefined();
    expect(erros({ ...valido, valor: ',5' }).valor).toBeDefined();
    expect(erros({ ...valido, valor: '999999999999,99' }).valor).toBeUndefined();
    expect(erros({ ...valido, valor: '999999999999,995' }).valor).toBeDefined();
    expect(erros({ ...valido, valor: '1000000000000,00' }).valor).toMatch(/limite/);
  });

  it('data: limites 2000-01-01 e 2100-12-31, dias inexistentes e ano bissexto', () => {
    for (const dataLancamento of ['2000-01-01', '2100-12-31', '2024-02-29', '2000-02-29']) {
      expect(erros({ ...valido, dataLancamento }).dataLancamento).toBeUndefined();
    }
    for (const dataLancamento of ['2023-02-29', '2100-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-1-1']) {
      expect(erros({ ...valido, dataLancamento }).dataLancamento).toBeDefined();
    }
    expect(erros({ ...valido, dataLancamento: '1999-12-31' }).dataLancamento).toMatch(/entre 2000 e 2100/);
    expect(erros({ ...valido, dataLancamento: '2101-01-01' }).dataLancamento).toMatch(/entre 2000 e 2100/);
  });

  it('competência: limites 2000-01 e 2100-12 e mensagens distintas para vazio, formato e ano', () => {
    expect(erros({ ...valido, mesCompetencia: '2000-01' }).mesCompetencia).toBeUndefined();
    expect(erros({ ...valido, mesCompetencia: '2100-12' }).mesCompetencia).toBeUndefined();
    expect(erros({ ...valido, mesCompetencia: '' }).mesCompetencia).toMatch(/Informe o mês/);
    expect(erros({ ...valido, mesCompetencia: '2026-13' }).mesCompetencia).toMatch(/mês válido/);
    expect(erros({ ...valido, mesCompetencia: '1999-12' }).mesCompetencia).toMatch(/entre 2000 e 2100/);
  });

  it('descrição: aparada antes de contar (255 + espaços passa; 256 úteis não)', () => {
    expect(erros({ ...valido, descricao: `  ${'x'.repeat(255)}  ` }).descricao).toBeUndefined();
    expect(erros({ ...valido, descricao: `  ${'x'.repeat(256)}  ` }).descricao).toBeDefined();
    expect(erros({ ...valido, descricao: '' }).descricao).toBe('Informe a descrição do lançamento.');
  });

  it('todos os campos inválidos geram um erro por campo e nenhum para a flag', () => {
    const todos = erros({
      categoria: '',
      descricao: '',
      valor: '',
      dataLancamento: '',
      mesCompetencia: '',
      visivelCliente: false,
    });
    expect(Object.keys(todos).sort()).toEqual(['categoria', 'dataLancamento', 'descricao', 'mesCompetencia', 'valor']);
  });

  it('categoria só aceita o valor snake_case do request (PascalCase da resposta não vale no formulário)', () => {
    expect(erros({ ...valido, categoria: 'MaoDeObra' }).categoria).toBeDefined();
    expect(erros({ ...valido, categoria: 'Material' }).categoria).toBeDefined();
  });
});

describe('toLancamentoBody - bordas', () => {
  it('apara descrição, data e competência, aceita ponto ou vírgula e mantém a flag', () => {
    expect(
      toLancamentoBody({
        categoria: 'equipamento',
        descricao: '  Betoneira   alugada  ',
        valor: ' 0,10 ',
        dataLancamento: ' 2026-10-05 ',
        mesCompetencia: ' 2026-10 ',
        visivelCliente: true,
      }),
    ).toEqual({
      categoria: 'equipamento',
      descricao: 'Betoneira   alugada',
      valor: 0.1,
      dataLancamento: '2026-10-05',
      mesCompetencia: '2026-10-01',
      visivelCliente: true,
    });
  });

  it('o corpo não tem obraId nem createdByUserId e só as 6 chaves do contrato', () => {
    expect(Object.keys(toLancamentoBody(valido)).sort()).toEqual([
      'categoria',
      'dataLancamento',
      'descricao',
      'mesCompetencia',
      'valor',
      'visivelCliente',
    ]);
  });

  it('valor máximo e centavos mantêm a precisão do número', () => {
    expect(toLancamentoBody({ ...valido, valor: '999999999999,99' }).valor).toBe(999999999999.99);
    expect(toLancamentoBody({ ...valido, valor: '12345678,90' }).valor).toBe(12345678.9);
    expect(toLancamentoBody({ ...valido, valor: '0,01' }).valor).toBe(0.01);
  });
});

describe('valores iniciais - bordas', () => {
  const base: LancamentoAdmin = {
    id: 'l1',
    obraId: 'o1',
    categoria: 'Material',
    descricao: 'Cimento',
    valor: 1500,
    dataLancamento: '2026-09-10',
    mesCompetencia: '2026-09-01',
    visivelCliente: false,
    createdAt: '2026-09-10T12:00:00Z',
    anexos: [],
  };

  it('novo: último dia do mês e virada de ano mantêm data e competência coerentes', () => {
    expect(lancamentoFormDefaults(new Date(2026, 0, 31))).toMatchObject({
      dataLancamento: '2026-01-31',
      mesCompetencia: '2026-01',
      visivelCliente: false,
    });
    expect(lancamentoFormDefaults(new Date(2026, 11, 31))).toMatchObject({
      dataLancamento: '2026-12-31',
      mesCompetencia: '2026-12',
    });
  });

  it('editar: valor inteiro, com uma casa e grande viram texto com vírgula; flag e categoria preservadas', () => {
    expect(lancamentoFormFrom(base).valor).toBe('1500');
    expect(lancamentoFormFrom({ ...base, valor: 12.5 }).valor).toBe('12,5');
    expect(lancamentoFormFrom({ ...base, valor: 12345678.9 }).valor).toBe('12345678,9');
    expect(lancamentoFormFrom({ ...base, categoria: 'Equipamento', visivelCliente: true })).toMatchObject({
      categoria: 'equipamento',
      visivelCliente: true,
    });
  });

  it('editar -> corpo devolve os mesmos dados (sem perda) com a flag atual explícita', () => {
    const corpo = toLancamentoBody(lancamentoFormFrom({ ...base, valor: 2300.75, visivelCliente: true }));
    expect(corpo).toEqual({
      categoria: 'material',
      descricao: 'Cimento',
      valor: 2300.75,
      dataLancamento: '2026-09-10',
      mesCompetencia: '2026-09-01',
      visivelCliente: true,
    });
  });

  it('o resultado de editar passa na validação do schema', () => {
    expect(erros(lancamentoFormFrom(base))).toEqual({});
  });
});

describe('LANCAMENTO_CAMPOS_SERVIDOR', () => {
  it('liga as chaves do servidor (em qualquer caixa) aos campos do formulário; ObraId cai em gerais', () => {
    const { campos, gerais } = mapServerErrors(
      {
        Categoria: ['c'],
        DESCRICAO: ['d'],
        valor: ['v1', 'v2'],
        DataLancamento: ['dl'],
        MesCompetencia: ['mc'],
        VisivelCliente: ['vc'],
        ObraId: ['obra ruim'],
        Outro: ['x'],
      },
      LANCAMENTO_CAMPOS_SERVIDOR,
    );
    expect(campos).toEqual({
      categoria: 'c',
      descricao: 'd',
      valor: 'v1 v2',
      dataLancamento: 'dl',
      mesCompetencia: 'mc',
      visivelCliente: 'vc',
    });
    expect(gerais).toEqual(['obra ruim', 'x']);
    expect(mapServerErrors(undefined, LANCAMENTO_CAMPOS_SERVIDOR)).toEqual({ campos: {}, gerais: [] });
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
