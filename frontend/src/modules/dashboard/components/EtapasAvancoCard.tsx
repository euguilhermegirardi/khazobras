import { ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardEtapa } from '@/interfaces/dashboard';
import { EtapaAvancoLinha } from './EtapaAvancoLinha';

interface EtapasAvancoCardProps {
  etapas: DashboardEtapa[];
}

export const EtapasAvancoCard = ({ etapas }: EtapasAvancoCardProps) => (
  <Card className="lg:col-span-2">
    <CardHeader>
      <CardTitle>
        <ListChecks aria-hidden />
        Avanço por etapa
      </CardTitle>
    </CardHeader>
    <CardContent>
      {etapas.length === 0 ? (
        <div className="rounded-xl border border-dashed p-7 text-center text-muted-foreground">
          <p className="text-[13px] font-medium text-foreground">Nenhuma etapa cadastrada ainda</p>
          <p className="mt-1 text-[13px]">Quando a Khaz Engenharia cadastrar as etapas, o avanço aparece aqui.</p>
        </div>
      ) : (
        <ul aria-label="Avanço por etapa" className="flex flex-col">
          {etapas.map((etapa) => (
            <EtapaAvancoLinha key={etapa.etapaId} etapa={etapa} />
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);
