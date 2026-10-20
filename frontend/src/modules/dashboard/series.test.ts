import { describe, expect, it } from 'vitest';
import { completarMeses, maximoDoEixo, resumoDoGrafico } from './series';

describe('completarMeses', () => {
  it('devolve vazio sem medições', () => {
    expect(completarMeses([])).toEqual([]);
  });

  it('um mês só vira um ponto com rótulo curto', () => {
    const serie = completarMeses([{ competencia: '2026-10-01', valorMedido: 20, valorMedidoAcumulado: 20 }]);
    expect(serie).toEqual([{ competencia: '2026-10-01', rotulo: 'Out/26', valorMedido: 20, valorMedidoAcumulado: 20 }]);
  });

  it('completa os meses vazios com 0 e mantém o acumulado', () => {
    const serie = completarMeses([
      { competencia: '2026-08-01', valorMedido: 30, valorMedidoAcumulado: 30 },
      { competencia: '2026-10-01', valorMedido: 20, valorMedidoAcumulado: 50 },
    ]);
    expect(serie.map((m) => [m.rotulo, m.valorMedido, m.valorMedidoAcumulado])).toEqual([
      ['Ago/26', 30, 30],
      ['Set/26', 0, 30],
      ['Out/26', 20, 50],
    ]);
  });

  it('atravessa a virada de ano', () => {
    const serie = completarMeses([
      { competencia: '2026-12-01', valorMedido: 10, valorMedidoAcumulado: 10 },
      { competencia: '2027-02-01', valorMedido: 5, valorMedidoAcumulado: 15 },
    ]);
    expect(serie.map((m) => m.competencia)).toEqual(['2026-12-01', '2027-01-01', '2027-02-01']);
  });

  it('não completa um intervalo absurdo (mantém só os meses da API)', () => {
    const serie = completarMeses([
      { competencia: '2010-01-01', valorMedido: 1, valorMedidoAcumulado: 1 },
      { competencia: '2026-01-01', valorMedido: 1, valorMedidoAcumulado: 2 },
    ]);
    expect(serie).toHaveLength(2);
  });
});

describe('maximoDoEixo', () => {
  const ponto = (acumulado: number, medido = 0) => ({
    competencia: '2026-10-01',
    rotulo: 'Out/26',
    valorMedido: medido,
    valorMedidoAcumulado: acumulado,
  });

  it('arredonda para um teto redondo com 4 intervalos iguais', () => {
    expect(maximoDoEixo([ponto(366386.55)])).toBe(400000);
    expect(maximoDoEixo([ponto(48000)])).toBe(60000);
    expect(maximoDoEixo([ponto(52000)])).toBe(60000);
    expect(maximoDoEixo([ponto(1000)])).toBe(1000);
    expect(maximoDoEixo([ponto(1250000)])).toBe(1600000);
  });

  it('olha também a barra do mês e nunca fica abaixo do maior valor', () => {
    expect(maximoDoEixo([ponto(10, 90)])).toBeGreaterThanOrEqual(90);
  });

  it('sem valores positivos devolve uma escala mínima', () => {
    expect(maximoDoEixo([ponto(0)])).toBe(4);
    expect(maximoDoEixo([])).toBe(4);
  });
});

describe('resumoDoGrafico', () => {
  it('descreve período e acumulado final', () => {
    const serie = completarMeses([
      { competencia: '2026-08-01', valorMedido: 30000, valorMedidoAcumulado: 30000 },
      { competencia: '2026-10-01', valorMedido: 20000, valorMedidoAcumulado: 50000 },
    ]);
    const texto = resumoDoGrafico(serie).replace(/ /g, ' ');
    expect(texto).toContain('de Ago/26 a Out/26');
    expect(texto).toContain('R$ 50.000,00');
  });

  it('com um mês só não repete o período', () => {
    const serie = completarMeses([{ competencia: '2026-10-01', valorMedido: 1, valorMedidoAcumulado: 1 }]);
    expect(resumoDoGrafico(serie)).toContain('de Out/26.');
  });
});
