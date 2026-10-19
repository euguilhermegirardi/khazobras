import { describe, expect, it } from 'vitest';
import type { EtapaCronograma } from '@/interfaces/etapa';
import {
  type EtapaFormValues,
  etapaFormDefaults,
  etapaFormSchema,
  mapServerErrors,
  sugerirStatus,
  toCreateBody,
  toUpdateBody,
} from './etapaForm';

const base = (over: Partial<EtapaFormValues> = {}): EtapaFormValues => ({
  nome: 'Alvenaria',
  ordem: '2',
  percentualPeso: '30',
  dataInicioPrevista: '2026-05-01',
  dataFimPrevista: '2026-12-31',
  dataInicioReal: '2026-05-05',
  dataFimReal: '',
  status: 'em_andamento',
  percentualConcluido: '40',
  ...over,
});

/** Campos com erro (caminho do primeiro nível) para os valores informados. */
const camposComErro = (values: EtapaFormValues): string[] => {
  const result = etapaFormSchema.safeParse(values);
  return result.success ? [] : [...new Set(result.error.issues.map((i) => String(i.path[0])))];
};

const etapa: EtapaCronograma = {
  id: 'e2',
  obraId: 'o1',
  nome: 'Alvenaria',
  ordem: 2,
  percentualPeso: 12.5,
  dataInicioPrevista: '2026-05-01',
  dataFimPrevista: null,
  dataInicioReal: '2026-05-05',
  dataFimReal: null,
  status: 'em_andamento',
  percentualConcluido: 40,
  createdAt: '2026-01-10T12:00:00Z',
};

describe('sugerirStatus', () => {
  it.each([
    ['0', 'nao_iniciada'],
    ['100', 'concluida'],
    ['1', 'em_andamento'],
    ['50', 'em_andamento'],
    ['99,9', 'em_andamento'],
    ['99.9', 'em_andamento'],
    [' 100 ', 'concluida'],
  ])('%s sugere %s', (texto, esperado) => {
    expect(sugerirStatus(texto)).toBe(esperado);
  });

  it.each(['', '   ', 'abc', '-1', '100,1', '101', '1e999'])('%j não é um % válido: sem sugestão', (texto) => {
    expect(sugerirStatus(texto)).toBeNull();
  });
});

describe('mapServerErrors', () => {
  it('converte chaves PascalCase do backend para os campos do formulário', () => {
    const { campos, gerais } = mapServerErrors({
      Nome: ['O nome é obrigatório.'],
      PercentualConcluido: ['Valor inválido.'],
      DataFimReal: ['Fim real anterior ao início.'],
      DataInicioPrevista: ['Data inválida.'],
      PercentualPeso: ['Peso inválido.'],
      Ordem: ['Ordem inválida.'],
      Status: ['Status inválido.'],
      DataFimPrevista: ['x'],
      DataInicioReal: ['y'],
    });
    expect(campos).toEqual({
      nome: 'O nome é obrigatório.',
      percentualConcluido: 'Valor inválido.',
      dataFimReal: 'Fim real anterior ao início.',
      dataInicioPrevista: 'Data inválida.',
      percentualPeso: 'Peso inválido.',
      ordem: 'Ordem inválida.',
      status: 'Status inválido.',
      dataFimPrevista: 'x',
      dataInicioReal: 'y',
    });
    expect(gerais).toEqual([]);
  });

  it('junta várias mensagens do mesmo campo', () => {
    const { campos } = mapServerErrors({ Nome: ['Primeira.', 'Segunda.'] });
    expect(campos.nome).toBe('Primeira. Segunda.');
  });

  it('o que não é campo do formulário vai para gerais', () => {
    const { campos, gerais } = mapServerErrors({ ObraId: ['Obra inválida.'], Nome: ['Ruim.'] });
    expect(campos).toEqual({ nome: 'Ruim.' });
    expect(gerais).toEqual(['Obra inválida.']);
  });

  it('sem erros devolve vazio', () => {
    expect(mapServerErrors(undefined)).toEqual({ campos: {}, gerais: [] });
    expect(mapServerErrors({})).toEqual({ campos: {}, gerais: [] });
  });
});

describe('etapaFormSchema', () => {
  it('aceita uma etapa em andamento coerente', () => {
    expect(camposComErro(base())).toEqual([]);
  });

  describe('nome', () => {
    it('obrigatório (vazio ou só espaços)', () => {
      expect(camposComErro(base({ nome: '' }))).toEqual(['nome']);
      expect(camposComErro(base({ nome: '   ' }))).toEqual(['nome']);
    });
    it('aceita 150 e recusa 151 caracteres', () => {
      expect(camposComErro(base({ nome: 'a'.repeat(150) }))).toEqual([]);
      expect(camposComErro(base({ nome: 'a'.repeat(151) }))).toEqual(['nome']);
    });
  });

  describe('ordem', () => {
    it.each(['0', '-1', '1.5', '', 'abc'])('recusa %j', (ordem) => {
      expect(camposComErro(base({ ordem }))).toEqual(['ordem']);
    });
    it('aceita 1', () => {
      expect(camposComErro(base({ ordem: '1' }))).toEqual([]);
    });
  });

  describe('peso e % concluído (0..100)', () => {
    it.each(['-0.1', '100.1', '101', '', 'abc'])('peso recusa %j', (percentualPeso) => {
      expect(camposComErro(base({ percentualPeso }))).toEqual(['percentualPeso']);
    });
    it.each(['0', '100', '12,5', '33.33'])('peso aceita %j', (percentualPeso) => {
      expect(camposComErro(base({ percentualPeso }))).toEqual([]);
    });
    it.each(['-1', '100.5', '', 'abc'])('% concluído recusa %j', (percentualConcluido) => {
      expect(camposComErro(base({ percentualConcluido }))).toContain('percentualConcluido');
    });
  });

  describe('datas (fim >= início)', () => {
    it('fim previsto antes do início previsto', () => {
      expect(camposComErro(base({ dataFimPrevista: '2026-04-30' }))).toEqual(['dataFimPrevista']);
    });
    it('fim previsto igual ao início é aceito', () => {
      expect(camposComErro(base({ dataFimPrevista: '2026-05-01' }))).toEqual([]);
    });
    it('fim real antes do início real', () => {
      const v = base({ status: 'concluida', percentualConcluido: '100', dataFimReal: '2026-05-04' });
      expect(camposComErro(v)).toEqual(['dataFimReal']);
    });
    it('sem uma das datas previstas, não compara', () => {
      expect(camposComErro(base({ dataInicioPrevista: '' }))).toEqual([]);
      expect(camposComErro(base({ dataFimPrevista: '' }))).toEqual([]);
    });
  });

  describe('status nao_iniciada => 0% e sem datas reais', () => {
    const naoIniciada = (over: Partial<EtapaFormValues> = {}) =>
      base({ status: 'nao_iniciada', percentualConcluido: '0', dataInicioReal: '', dataFimReal: '', ...over });

    it('coerente passa', () => {
      expect(camposComErro(naoIniciada())).toEqual([]);
    });
    it('% diferente de 0', () => {
      expect(camposComErro(naoIniciada({ percentualConcluido: '10' }))).toEqual(['percentualConcluido']);
    });
    it('com início real', () => {
      expect(camposComErro(naoIniciada({ dataInicioReal: '2026-05-05' }))).toEqual(['dataInicioReal']);
    });
    it('com fim real', () => {
      expect(camposComErro(naoIniciada({ dataFimReal: '2026-06-05' }))).toContain('dataFimReal');
    });
  });

  describe('status em_andamento => % < 100, início real, sem fim real', () => {
    it('% 100 exige concluída', () => {
      expect(camposComErro(base({ percentualConcluido: '100' }))).toEqual(['percentualConcluido']);
    });
    it('% 99,9 passa', () => {
      expect(camposComErro(base({ percentualConcluido: '99.9' }))).toEqual([]);
    });
    it('exige início real', () => {
      expect(camposComErro(base({ dataInicioReal: '' }))).toEqual(['dataInicioReal']);
    });
    it('não aceita fim real', () => {
      expect(camposComErro(base({ dataFimReal: '2026-06-05' }))).toEqual(['dataFimReal']);
    });
  });

  describe('status concluida => 100%, início e fim reais', () => {
    const concluida = (over: Partial<EtapaFormValues> = {}) =>
      base({ status: 'concluida', percentualConcluido: '100', dataFimReal: '2026-06-05', ...over });

    it('coerente passa', () => {
      expect(camposComErro(concluida())).toEqual([]);
    });
    it('% menor que 100', () => {
      expect(camposComErro(concluida({ percentualConcluido: '90' }))).toEqual(['percentualConcluido']);
    });
    it('exige início real', () => {
      expect(camposComErro(concluida({ dataInicioReal: '' }))).toEqual(['dataInicioReal']);
    });
    it('exige fim real', () => {
      expect(camposComErro(concluida({ dataFimReal: '' }))).toEqual(['dataFimReal']);
    });
  });

  it('status fora da lista é recusado', () => {
    expect(camposComErro(base({ status: 'suspensa' }))).toEqual(['status']);
    expect(camposComErro(base({ status: '' }))).toEqual(['status']);
  });

  it('acumula erros de campos diferentes de uma vez', () => {
    const campos = camposComErro(base({ nome: '', ordem: '0', percentualPeso: '200' }));
    expect(campos).toEqual(expect.arrayContaining(['nome', 'ordem', 'percentualPeso']));
  });
});

describe('etapaFormDefaults', () => {
  it('criação: ordem sugerida, peso 0, não iniciada e 0%', () => {
    expect(etapaFormDefaults(null, 6)).toEqual({
      nome: '',
      ordem: '6',
      percentualPeso: '0',
      dataInicioPrevista: '',
      dataFimPrevista: '',
      dataInicioReal: '',
      dataFimReal: '',
      status: 'nao_iniciada',
      percentualConcluido: '0',
    });
  });

  it('edição: copia a etapa, com null virando texto vazio', () => {
    expect(etapaFormDefaults(etapa, 99)).toEqual({
      nome: 'Alvenaria',
      ordem: '2',
      percentualPeso: '12.5',
      dataInicioPrevista: '2026-05-01',
      dataFimPrevista: '',
      dataInicioReal: '2026-05-05',
      dataFimReal: '',
      status: 'em_andamento',
      percentualConcluido: '40',
    });
  });
});

describe('corpos da requisição', () => {
  it('PUT: todos os campos, números como número e datas vazias como null', () => {
    expect(toUpdateBody(base({ nome: '  Alvenaria estrutural  ', percentualPeso: '12,5', dataFimReal: '' }))).toEqual({
      nome: 'Alvenaria estrutural',
      ordem: 2,
      percentualPeso: 12.5,
      dataInicioPrevista: '2026-05-01',
      dataFimPrevista: '2026-12-31',
      dataInicioReal: '2026-05-05',
      dataFimReal: null,
      status: 'em_andamento',
      percentualConcluido: 40,
    });
  });

  it('POST: obraId + só os campos previstos (sem status, %, datas reais)', () => {
    const body = toCreateBody('obra-1', base({ dataInicioPrevista: '', dataFimPrevista: '' }));
    expect(body).toEqual({
      obraId: 'obra-1',
      nome: 'Alvenaria',
      ordem: 2,
      percentualPeso: 30,
      dataInicioPrevista: null,
      dataFimPrevista: null,
    });
    expect(Object.keys(body).sort()).toEqual(
      ['dataFimPrevista', 'dataInicioPrevista', 'nome', 'obraId', 'ordem', 'percentualPeso'].sort(),
    );
  });
});
