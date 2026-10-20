import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardSerieMes } from '@/interfaces/dashboard';
import { formatCurrency, formatCurrencyCompact } from '@/utils/format';
import { ALTURA_GRAFICO, COR_BARRA, COR_LINHA, LARGURA_INICIAL_GRAFICO, NOME_BARRA, NOME_LINHA } from '../constants';
import { maximoDoEixo, resumoDoGrafico } from '../series';

interface CustoAcumuladoGraficoProps {
  serie: DashboardSerieMes[];
}

/** Até aqui todo mês tem rótulo no eixo X (cabe em 1280); acima, o Recharts pula alguns. */
const MESES_TODOS_ROTULOS = 12;
/** Rótulos no máximo ~10: passo fixo (espaçamento regular, o último rótulo não cola na borda do card). */
const ROTULOS_MAXIMOS = 10;
const TICK = { fill: 'var(--muted-foreground)', fontSize: 11 };
const EIXO = { stroke: 'var(--border)' };
const TOOLTIP_BOX = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--card-foreground)',
  fontSize: 12,
};

/** `interval` do Recharts é quantos rótulos pular entre dois exibidos (0 = todos). */
const intervaloDoEixo = (meses: number): number =>
  meses <= MESES_TODOS_ROTULOS ? 0 : Math.ceil(meses / ROTULOS_MAXIMOS) - 1;

/**
 * Barras (medido no mês) + linha (acumulado). Sem 3D, só grade horizontal leve. Largura segue o card; altura fixa.
 * `role="img"` com resumo: a tabela alternativa fica fora deste bloco (filhos de `img` não são lidos).
 */
export const CustoAcumuladoGrafico = ({ serie }: CustoAcumuladoGraficoProps) => (
  <div role="img" aria-label={resumoDoGrafico(serie)} style={{ height: ALTURA_GRAFICO }}>
    <ResponsiveContainer
      width="100%"
      height={ALTURA_GRAFICO}
      initialDimension={{ width: LARGURA_INICIAL_GRAFICO, height: ALTURA_GRAFICO }}
    >
      <ComposedChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer={false}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tick={TICK} axisLine={EIXO} tickLine={false} interval={intervaloDoEixo(serie.length)} />
        <YAxis
          tick={TICK}
          axisLine={false}
          tickLine={false}
          width={68}
          domain={[0, maximoDoEixo(serie)]}
          tickCount={5}
          tickFormatter={(valor: number) => formatCurrencyCompact(valor)}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
          contentStyle={TOOLTIP_BOX}
          labelStyle={{ color: 'var(--card-foreground)', fontWeight: 500 }}
          formatter={(valor) => formatCurrency(Number(valor))}
        />
        <Bar
          dataKey="valorMedido"
          name={NOME_BARRA}
          fill={COR_BARRA}
          maxBarSize={40}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          dataKey="valorMedidoAcumulado"
          name={NOME_LINHA}
          type="monotone"
          stroke={COR_LINHA}
          strokeWidth={2}
          dot={{ r: 4, fill: COR_LINHA, stroke: 'var(--card)', strokeWidth: 1.5 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);
