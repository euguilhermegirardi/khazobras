import { describe, expect, it } from 'vitest';
import {
  competenciaDoMes,
  contadorConteudo,
  relatorioFormDefaults,
  relatorioFormFrom,
  relatorioFormSchema,
  temCaractereInvalido,
  toRelatorioBody,
} from './relatorioForm';

const erros = (v: { competencia: string; conteudo: string }) => {
  const r = relatorioFormSchema.safeParse(v);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe('relatorioFormSchema', () => {
  it('aceita mês e texto válidos, com quebras de linha e tabulação', () => {
    expect(erros({ competencia: '2026-09', conteudo: 'Linha 1\r\nLinha 2\t- ok' })).toEqual({});
  });

  it('recusa competência vazia, malformada e fora de 2000..2100', () => {
    expect(erros({ competencia: '', conteudo: 'x' }).competencia).toMatch(/Informe o mês/);
    expect(erros({ competencia: '2026-13', conteudo: 'x' }).competencia).toMatch(/mês válido/);
    expect(erros({ competencia: '1999-12', conteudo: 'x' }).competencia).toMatch(/2000 e 2100/);
    expect(erros({ competencia: '2101-01', conteudo: 'x' }).competencia).toMatch(/2000 e 2100/);
    expect(erros({ competencia: '2000-01', conteudo: 'x' })).toEqual({});
    expect(erros({ competencia: '2100-12', conteudo: 'x' })).toEqual({});
  });

  it('recusa conteúdo vazio ou só espaços; aceita exatamente 20000 e recusa 20001', () => {
    expect(erros({ competencia: '2026-09', conteudo: '' }).conteudo).toMatch(/Escreva/);
    expect(erros({ competencia: '2026-09', conteudo: ' \n\t ' }).conteudo).toMatch(/Escreva/);
    expect(erros({ competencia: '2026-09', conteudo: 'a'.repeat(20000) })).toEqual({});
    expect(erros({ competencia: '2026-09', conteudo: 'a'.repeat(20001) }).conteudo).toMatch(/20000/);
  });

  it('recusa controle e caracteres de direção do texto', () => {
    expect(erros({ competencia: '2026-09', conteudo: 'a\u0000b' }).conteudo).toMatch(/controle/);
    expect(erros({ competencia: '2026-09', conteudo: 'a‮b' }).conteudo).toMatch(/controle/);
    expect(erros({ competencia: '2026-09', conteudo: 'a⁦b' }).conteudo).toMatch(/controle/);
  });
});

describe('temCaractereInvalido', () => {
  it('só libera \\n \\r \\t entre os controles', () => {
    expect(temCaractereInvalido('a\nb\rc\td')).toBe(false);
    for (const c of ['\u0000', '\u0008', '\u000B', '\u000C', '\u001F', '\u007F', '\u0085', '\u009F']) {
      expect(temCaractereInvalido(`a${c}b`)).toBe(true);
    }
    for (const c of ['‪', '‮', '⁦', '⁩']) expect(temCaractereInvalido(c)).toBe(true);
    expect(temCaractereInvalido('Ação — “aspas” 😀')).toBe(false);
  });
});

describe('conversões', () => {
  it('toRelatorioBody manda o dia 1 e preserva o texto sem aparar', () => {
    expect(toRelatorioBody({ competencia: '2026-09', conteudo: '  texto\n' })).toEqual({
      competencia: '2026-09-01',
      conteudo: '  texto\n',
    });
  });

  it('defaults usam o mês de hoje; from corta o dia', () => {
    expect(relatorioFormDefaults(new Date(2026, 9, 21))).toEqual({ competencia: '2026-10', conteudo: '' });
    expect(relatorioFormFrom({ competencia: '2026-03-01', conteudo: 'x' })).toEqual({
      competencia: '2026-03',
      conteudo: 'x',
    });
  });

  it('competenciaDoMes só devolve mês válido; contador mostra x/20000', () => {
    expect(competenciaDoMes('2026-09')).toBe('2026-09-01');
    expect(competenciaDoMes('')).toBeNull();
    expect(competenciaDoMes('2026-9')).toBeNull();
    expect(contadorConteudo('abc')).toBe('3/20000');
  });
});
