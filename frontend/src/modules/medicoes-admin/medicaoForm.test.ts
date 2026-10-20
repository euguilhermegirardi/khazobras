import { describe, expect, it } from 'vitest';
import {
  itemVazio,
  mapServerErrors,
  type MedicaoFormValues,
  medicaoFormDefaults,
  medicaoFormSchema,
  mesAtual,
  parseDecimal,
  proximoNumero,
  toCreateBody,
  totalDoItem,
  totalGeral,
} from './medicaoForm';

const OBRA_ID = '11111111-1111-1111-1111-111111111111';
const ETAPA_ID = '22222222-2222-2222-2222-222222222222';

const base = (over: Partial<MedicaoFormValues> = {}): MedicaoFormValues => ({
  numero: '3',
  competencia: '2026-10',
  etapaId: '',
  itens: [{ tipo: 'material', descricao: 'Cimento', quantidade: '10', valorUnitario: '35,50' }],
  ...over,
});

/** Caminhos com erro ("itens.0.quantidade") para os valores informados. */
const caminhosComErro = (values: MedicaoFormValues): string[] => {
  const result = medicaoFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('parseDecimal', () => {
  it('aceita ponto ou vírgula com até 2 casas', () => {
    expect(parseDecimal('10')).toBe(10);
    expect(parseDecimal('10.5')).toBe(10.5);
    expect(parseDecimal(' 35,50 ')).toBe(35.5);
    expect(parseDecimal('0')).toBe(0);
  });

  it('recusa vazio, 3 casas, negativo e texto', () => {
    for (const texto of ['', '1,234', '-1', 'abc', '1e3', '1,2,3']) expect(parseDecimal(texto)).toBeNull();
  });
});

describe('totais (só exibição)', () => {
  it('multiplica quantidade por valor unitário com 2 casas', () => {
    expect(totalDoItem({ quantidade: '10', valorUnitario: '35,50' })).toBe(355);
    expect(totalDoItem({ quantidade: '0,07', valorUnitario: '100' })).toBe(7);
  });

  it('item incompleto vale 0', () => {
    expect(totalDoItem({ quantidade: '', valorUnitario: '10' })).toBe(0);
    expect(totalDoItem({ quantidade: '2', valorUnitario: 'x' })).toBe(0);
  });

  it('soma sem erro de ponto flutuante', () => {
    const itens = [
      { quantidade: '1', valorUnitario: '0,10' },
      { quantidade: '1', valorUnitario: '0,20' },
    ];
    expect(totalGeral(itens)).toBe(0.3);
    expect(totalGeral([])).toBe(0);
  });
});

describe('proximoNumero / mesAtual', () => {
  it('maior número visto + 1, com o total como piso', () => {
    expect(proximoNumero(7, 3)).toBe(8);
    expect(proximoNumero(2, 5)).toBe(6);
    expect(proximoNumero(0, 0)).toBe(1);
  });

  it('mês local no formato aaaa-mm', () => {
    expect(mesAtual(new Date(2026, 0, 31))).toBe('2026-01');
    expect(mesAtual(new Date(2026, 9, 1))).toBe('2026-10');
  });
});

describe('medicaoFormSchema', () => {
  it('aceita um formulário válido e os defaults com item preenchido', () => {
    expect(caminhosComErro(base())).toEqual([]);
    const defaults = medicaoFormDefaults(4, '2026-10');
    expect(defaults).toEqual({ numero: '4', competencia: '2026-10', etapaId: '', itens: [itemVazio()] });
  });

  it('número: inteiro de 1 a 100000', () => {
    for (const numero of ['', '0', '-1', '1,5', '100001', 'abc']) {
      expect(caminhosComErro(base({ numero }))).toEqual(['numero']);
    }
    expect(caminhosComErro(base({ numero: '100000' }))).toEqual([]);
  });

  it('competência: mês válido entre 2000 e 2100', () => {
    for (const competencia of ['', '2026-13', '2026-1', '1999-12', '2101-01']) {
      expect(caminhosComErro(base({ competencia }))).toEqual(['competencia']);
    }
  });

  it('exige de 1 a 200 itens', () => {
    expect(caminhosComErro(base({ itens: [] }))).toEqual(['itens']);
    const muitos = Array.from({ length: 201 }, () => ({ ...itemVazio(), descricao: 'x', valorUnitario: '1' }));
    expect(caminhosComErro(base({ itens: muitos }))).toEqual(['itens']);
    expect(caminhosComErro(base({ itens: muitos.slice(0, 200) }))).toEqual([]);
  });

  it('item: tipo, descrição ≤255, quantidade > 0, valor ≥ 0, 2 casas', () => {
    const item = (over: Partial<MedicaoFormValues['itens'][number]>) =>
      base({ itens: [{ tipo: 'material', descricao: 'Cimento', quantidade: '1', valorUnitario: '0', ...over }] });

    expect(caminhosComErro(item({ tipo: 'outro' }))).toEqual(['itens.0.tipo']);
    expect(caminhosComErro(item({ descricao: '   ' }))).toEqual(['itens.0.descricao']);
    expect(caminhosComErro(item({ descricao: 'a'.repeat(256) }))).toEqual(['itens.0.descricao']);
    expect(caminhosComErro(item({ descricao: 'a'.repeat(255) }))).toEqual([]);
    expect(caminhosComErro(item({ quantidade: '0' }))).toEqual(['itens.0.quantidade']);
    expect(caminhosComErro(item({ quantidade: '1,234' }))).toEqual(['itens.0.quantidade']);
    expect(caminhosComErro(item({ valorUnitario: '' }))).toEqual(['itens.0.valorUnitario']);
    expect(caminhosComErro(item({ valorUnitario: '-5' }))).toEqual(['itens.0.valorUnitario']);
    expect(caminhosComErro(item({ valorUnitario: '0' }))).toEqual([]);
  });

  it('aponta o item certo quando há vários', () => {
    const itens = [
      { tipo: 'material', descricao: 'Ok', quantidade: '1', valorUnitario: '1' },
      { tipo: 'equipamento', descricao: '', quantidade: '1', valorUnitario: '1' },
    ];
    expect(caminhosComErro(base({ itens }))).toEqual(['itens.1.descricao']);
  });

  it('recusa soma acima do limite da coluna', () => {
    const itens = [{ tipo: 'material', descricao: 'Ouro', quantidade: '2', valorUnitario: '999999999999,99' }];
    expect(caminhosComErro(base({ itens }))).toEqual(['itens']);
  });
});

describe('toCreateBody', () => {
  it('monta o request em snake_case, competência no dia 1 e números', () => {
    const body = toCreateBody(
      OBRA_ID,
      base({
        etapaId: ETAPA_ID,
        itens: [
          { tipo: 'mao_de_obra', descricao: '  Pedreiro ', quantidade: '2,5', valorUnitario: '120' },
          { tipo: 'equipamento', descricao: 'Betoneira', quantidade: '1', valorUnitario: '0' },
        ],
      }),
    );
    expect(body).toEqual({
      obraId: OBRA_ID,
      etapaId: ETAPA_ID,
      numero: 3,
      competencia: '2026-10-01',
      itens: [
        { tipo: 'mao_de_obra', descricao: 'Pedreiro', quantidade: 2.5, valorUnitario: 120 },
        { tipo: 'equipamento', descricao: 'Betoneira', quantidade: 1, valorUnitario: 0 },
      ],
    });
  });

  it('sem etapa vai null e o body não carrega totais', () => {
    const body = toCreateBody(OBRA_ID, base());
    expect(body.etapaId).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/valorTotal/);
  });
});

describe('mapServerErrors', () => {
  it('mapeia chaves PascalCase do servidor para caminhos do formulário', () => {
    const { campos, gerais } = mapServerErrors({
      Numero: ['Numero invalido.'],
      Competencia: ['Competencia fora do intervalo.'],
      EtapaId: ['Etapa nao pertence a obra.'],
      'Itens[0].Tipo': ['Tipo deve ser mao_de_obra, material ou equipamento.'],
      'Itens[2].ValorUnitario': ['Valor unitario aceita no maximo 2 casas decimais.'],
      Itens: ['A medicao precisa de pelo menos um item.'],
    });
    expect(campos).toEqual({
      numero: 'Numero invalido.',
      competencia: 'Competencia fora do intervalo.',
      etapaId: 'Etapa nao pertence a obra.',
      'itens.0.tipo': 'Tipo deve ser mao_de_obra, material ou equipamento.',
      'itens.2.valorUnitario': 'Valor unitario aceita no maximo 2 casas decimais.',
      itens: 'A medicao precisa de pelo menos um item.',
    });
    expect(gerais).toEqual([]);
  });

  it('junta várias mensagens do mesmo campo e manda o que não é campo para as gerais', () => {
    const { campos, gerais } = mapServerErrors({
      'Itens[1].Descricao': ['A', 'B'],
      ObraId: ['ObraId obrigatorio.'],
      'Itens[3]': ['Item da medicao nao pode ser nulo.'],
    });
    expect(campos).toEqual({ 'itens.1.descricao': 'A B' });
    expect(gerais).toEqual(['ObraId obrigatorio.', 'Item da medicao nao pode ser nulo.']);
  });

  it('sem erros de campo devolve vazio', () => {
    expect(mapServerErrors(undefined)).toEqual({ campos: {}, gerais: [] });
  });
});
