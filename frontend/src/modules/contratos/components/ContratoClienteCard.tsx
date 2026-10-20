import { ContratoCard } from '@/components/ContratoCard';
import { PagamentosSecao } from '@/components/PagamentosSecao';
import type { ContratoCliente } from '@/interfaces/contrato';
import { useContratoDetalhe } from '../hooks';

interface ContratoClienteCardProps {
  obraId: string;
  contrato: ContratoCliente;
}

/**
 * Um contrato com os seus pagamentos. O detalhe é buscado ao montar o card (todos de uma vez): uma obra tem poucos
 * contratos, então é mais simples que expandir sob demanda e não esconde nenhum pagamento.
 */
export const ContratoClienteCard = ({ obraId, contrato }: ContratoClienteCardProps) => {
  // Hooks
  const detalhe = useContratoDetalhe(obraId, contrato.id);

  // Functions
  const handleRetry = () => void detalhe.refetch();

  // Return
  return (
    <ContratoCard contrato={contrato}>
      <PagamentosSecao
        numeroContrato={contrato.numero}
        pagamentos={detalhe.data?.pagamentos}
        isPending={detalhe.isPending}
        error={detalhe.error}
        onRetry={handleRetry}
        mensagemVazio="Nenhum pagamento registrado neste contrato ainda."
      />
    </ContratoCard>
  );
};
