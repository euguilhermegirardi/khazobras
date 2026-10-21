import { describe, expect, it } from 'vitest';
import type { RelatorioFotografico } from '@/interfaces/relatorioFotografico';
import {
  relatorioFormDefaults,
  relatorioFormFrom,
  relatorioFormSchema,
  type RelatorioFormValues,
  sugestoesDoFormulario,
  toRelatorioBody,
} from './relatorioForm';

const valido: RelatorioFormValues = { tipo: 'mensal', etapaId: '', titulo: 'Setembro', competencia: '2026-09' };

const erros = (v: RelatorioFormValues) =>
  Object.fromEntries((relatorioFormSchema.safeParse(v).error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));

describe('relatorioFormSchema', () => {
  it('aceita mensal e etapa; etapa e competência são opcionais (o backend não exige)', () => {
    expect(relatorioFormSchema.safeParse(valido).success).toBe(true);
    expect(relatorioFormSchema.safeParse({ ...valido, tipo: 'etapa', etapaId: '', competencia: '' }).success).toBe(
      true,
    );
    expect(relatorioFormSchema.safeParse({ ...valido, tipo: 'mensal', competencia: '' }).success).toBe(true);
  });

  it('recusa tipo desconhecido, título vazio ou acima de 150 e competência fora de 2000–2100', () => {
    expect(erros({ ...valido, tipo: 'semanal' }).tipo).toBeDefined();
    expect(erros({ ...valido, titulo: '   ' }).titulo).toMatch(/título/);
    expect(erros({ ...valido, titulo: 'a'.repeat(150) }).titulo).toBeUndefined();
    expect(erros({ ...valido, titulo: 'a'.repeat(151) }).titulo).toMatch(/150/);
    expect(erros({ ...valido, competencia: '1999-12' }).competencia).toMatch(/2000/);
    expect(erros({ ...valido, competencia: '2101-01' }).competencia).toMatch(/2100/);
    expect(erros({ ...valido, competencia: '2026-13' }).competencia).toMatch(/válido/);
    expect(erros({ ...valido, competencia: '2000-01' }).competencia).toBeUndefined();
    expect(erros({ ...valido, competencia: '2100-12' }).competencia).toBeUndefined();
  });
});

describe('toRelatorioBody e valores iniciais', () => {
  it('manda os quatro campos: etapa vazia e competência vazia viram null; competência vira o dia 1', () => {
    expect(toRelatorioBody(valido)).toEqual({
      tipo: 'mensal',
      etapaId: null,
      titulo: 'Setembro',
      competencia: '2026-09-01',
    });
    expect(toRelatorioBody({ tipo: 'etapa', etapaId: 'e1', titulo: '  Fundação ', competencia: '' })).toEqual({
      tipo: 'etapa',
      etapaId: 'e1',
      titulo: 'Fundação',
      competencia: null,
    });
  });

  it('novo: mensal, mês de hoje, sem título; editar: valores do relatório', () => {
    expect(relatorioFormDefaults(new Date(2026, 9, 20))).toEqual({
      tipo: 'mensal',
      etapaId: '',
      titulo: '',
      competencia: '2026-10',
    });
    const relatorio: RelatorioFotografico = {
      id: 'r',
      obraId: 'o',
      tipo: 'etapa',
      etapaId: 'e1',
      titulo: 'Fundação',
      competencia: null,
      createdAt: '2026-10-12T10:00:00Z',
      fotos: [],
    };
    expect(relatorioFormFrom(relatorio)).toEqual({ tipo: 'etapa', etapaId: 'e1', titulo: 'Fundação', competencia: '' });
  });
});

describe('sugestoesDoFormulario', () => {
  it('sugere etapa no tipo etapa e competência no tipo mensal, só quando faltam', () => {
    expect(sugestoesDoFormulario({ tipo: 'etapa', etapaId: '', competencia: '' }).etapa).toMatch(/Recomendado/);
    expect(sugestoesDoFormulario({ tipo: 'etapa', etapaId: 'e1', competencia: '' }).etapa).toBe('');
    expect(sugestoesDoFormulario({ tipo: 'mensal', etapaId: '', competencia: '' }).competencia).toMatch(/Recomendado/);
    expect(sugestoesDoFormulario({ tipo: 'mensal', etapaId: '', competencia: '2026-09' }).competencia).toBe('');
    expect(sugestoesDoFormulario({ tipo: 'mensal', etapaId: '', competencia: '' }).etapa).toBe('');
  });
});
