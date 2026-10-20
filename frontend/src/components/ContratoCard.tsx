import type { ReactNode } from 'react';
import { ProgressBar } from '@/components/ProgressBar';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import type { ContratoCliente } from '@/interfaces/contrato';
import { percentualPago, saldoExibicao } from '@/utils/contrato';
import { formatDateOnly } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';

interface ContratoCardProps {
  /** Aceita também o `Contrato` do admin (que só acrescenta campos). */
  contrato: ContratoCliente;
  /** Botões à direita do título (admin: "Registrar pagamento"). */
  actions?: ReactNode;
  /** Abaixo dos números: a seção de pagamentos. */
  children: ReactNode;
}

/** Card de um contrato (protótipo: docs/design/capturas/contratos.png): título, números, barra do pago e pagamentos. */
export const ContratoCard = ({ contrato, actions, children }: ContratoCardProps) => {
  // Constants derivadas
  const saldo = saldoExibicao(contrato.saldoAPagar);
  const pago = percentualPago(contrato);

  // Return
  return (
    <Card role="group" aria-label={`Contrato ${contrato.numero}`}>
      <CardHeader>
        <h2 className="min-w-0 text-sm font-medium break-words">Contrato {contrato.numero}</h2>
        <p className="text-xs text-muted-foreground">
          {contrato.dataAssinatura
            ? `Assinado em ${formatDateOnly(contrato.dataAssinatura)}`
            : 'Data de assinatura não informada'}
        </p>
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        <dl className="grid grid-cols-3 gap-3.5">
          <div>
            <dt className="text-[11px] text-muted-foreground">Valor contratado</dt>
            <dd className="text-[13px] font-medium tabular-nums">{formatCurrency(contrato.valorContratado)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Pago</dt>
            <dd className="text-[13px] font-medium text-success tabular-nums">{formatCurrency(contrato.totalPago)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">{saldo.label}</dt>
            <dd className={`text-[13px] font-medium tabular-nums ${saldo.aMais ? 'text-danger' : 'text-warning'}`}>
              {formatCurrency(saldo.valor)}
            </dd>
          </div>
        </dl>
        <ProgressBar
          label={`Pago do contrato ${contrato.numero}`}
          value={pago}
          tone={saldo.aMais ? 'danger' : 'success'}
        />
        {children}
      </CardContent>
    </Card>
  );
};
