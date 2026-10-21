import { describe, expect, it } from 'vitest';
import type { RelatorioMensalAdmin } from '@/interfaces/relatorioMensal';
import { ApiError } from '@/services/apiClient';
import {
  acaoLegivel,
  autorLegivel,
  camposLegiveis,
  filtrarPorStatus,
  mensagemDeAcao,
  ordenarPorCompetencia,
} from './relatorioLista';

const r = (id: string, competencia: string, status: 'draft' | 'published'): RelatorioMensalAdmin => ({
  id,
  obraId: 'o',
  competencia,
  conteudo: 'x',
  status,
  publishedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('lista', () => {
  const lista = [r('a', '2026-03-01', 'published'), r('b', '2026-09-01', 'draft'), r('c', '2025-12-01', 'draft')];

  it('ordena do mês mais novo para o mais antigo sem alterar o original', () => {
    expect(ordenarPorCompetencia(lista).map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(lista.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('filtra por status', () => {
    expect(filtrarPorStatus(lista, 'todos')).toHaveLength(3);
    expect(filtrarPorStatus(lista, 'draft').map((x) => x.id)).toEqual(['b', 'c']);
    expect(filtrarPorStatus(lista, 'published').map((x) => x.id)).toEqual(['a']);
  });
});

describe('histórico', () => {
  it('traduz a ação e cai num texto genérico se for desconhecida', () => {
    expect(acaoLegivel('relatorio_mensal_criado')).toBe('Relatório criado');
    expect(acaoLegivel('relatorio_mensal_editado')).toBe('Relatório editado');
    expect(acaoLegivel('relatorio_mensal_publicado')).toBe('Relatório publicado');
    expect(acaoLegivel('relatorio_mensal_excluido')).toBe('Alteração no relatório');
  });

  it('traduz os campos e junta com vírgula e "e"', () => {
    expect(camposLegiveis([])).toBe('');
    expect(camposLegiveis(['conteudo'])).toBe('Conteúdo');
    expect(camposLegiveis(['competencia', 'conteudo'])).toBe('Competência e Conteúdo');
    expect(camposLegiveis(['desconhecido'])).toBe('');
  });

  it('mostra "Usuário removido" sem nome', () => {
    expect(autorLegivel({ userName: null })).toBe('Usuário removido');
    expect(autorLegivel({ userName: '  ' })).toBe('Usuário removido');
    expect(autorLegivel({ userName: 'Ana Admin' })).toBe('Ana Admin');
  });
});

describe('mensagemDeAcao', () => {
  it('409 vira o texto da tela; 404 e o resto seguem o padrão', () => {
    expect(
      mensagemDeAcao(new ApiError('conflict', 409, 'Relatorio ja esta publicado.'), 'f', 'nf', 'conflito'),
    ).toEqual({
      message: 'conflito',
    });
    expect(mensagemDeAcao(new ApiError('not_found', 404, 'Não encontrado.'), 'f', 'nf', 'c')).toEqual({
      message: 'nf',
    });
    expect(mensagemDeAcao(new Error('x'), 'f', 'nf', 'c')).toEqual({ message: 'f' });
  });
});
