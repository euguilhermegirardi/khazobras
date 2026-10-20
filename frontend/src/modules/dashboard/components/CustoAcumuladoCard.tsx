import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardMedidoMes } from '@/interfaces/dashboard';
import { MENSAGEM_SEM_MEDICOES } from '../constants';
import { completarMeses } from '../series';
import { CustoAcumuladoGrafico } from './CustoAcumuladoGrafico';
import { CustoAcumuladoLegenda } from './CustoAcumuladoLegenda';
import { CustoAcumuladoTabela } from './CustoAcumuladoTabela';

interface CustoAcumuladoCardProps {
  medidoPorMes: DashboardMedidoMes[];
}

export const CustoAcumuladoCard = ({ medidoPorMes }: CustoAcumuladoCardProps) => {
  // Constants derivadas
  const serie = completarMeses(medidoPorMes);

  // Return
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>
          <TrendingUp aria-hidden />
          Custo acumulado — todos os meses
        </CardTitle>
      </CardHeader>
      <CardContent>
        {serie.length === 0 ? (
          <div className="rounded-xl border border-dashed p-7 text-center text-muted-foreground">
            <p className="text-[13px] font-medium text-foreground">{MENSAGEM_SEM_MEDICOES}</p>
            <p className="mt-1 text-[13px]">Quando você aprovar uma medição, o custo acumulado aparece aqui.</p>
          </div>
        ) : (
          <>
            <CustoAcumuladoLegenda />
            <CustoAcumuladoGrafico serie={serie} />
            <CustoAcumuladoTabela serie={serie} />
          </>
        )}
      </CardContent>
    </Card>
  );
};
