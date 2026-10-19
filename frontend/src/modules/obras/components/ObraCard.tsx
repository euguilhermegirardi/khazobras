import { Link } from 'react-router-dom';
import type { Obra } from '@/interfaces/obra';
import { formatDateOnly } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OBRA_STATUS_BADGE, OBRA_STATUS_LABEL } from '../constants';

interface ObraCardProps {
  obra: Obra;
  to: string;
}

/** Card de obra no Hub (protótipo: docs/design/capturas/hub.png). */
export const ObraCard = ({ obra, to }: ObraCardProps) => {
  const dataInicio = obra.dataInicio ? formatDateOnly(obra.dataInicio) : '—';
  const dataPrevisaoTermino = obra.dataPrevisaoTermino ? formatDateOnly(obra.dataPrevisaoTermino) : '—';

  return (
    <li>
      <Link to={to} className="block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <Card className="transition-colors hover:border-primary">
          <CardHeader>
            <CardTitle>
              <h2 className="text-[15px] font-medium text-foreground">{obra.nome}</h2>
            </CardTitle>
            {obra.endereco && <CardDescription>{obra.endereco}</CardDescription>}
            <CardAction>
              <Badge variant={OBRA_STATUS_BADGE[obra.status]}>{OBRA_STATUS_LABEL[obra.status]}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Valor contratado</dt>
                <dd className="text-[13px] font-medium">{formatCurrency(obra.valorContratado)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Início</dt>
                <dd className="text-[13px] font-medium">{dataInicio}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Previsão de término</dt>
                <dd className="text-[13px] font-medium">{dataPrevisaoTermino}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </Link>
    </li>
  );
};
