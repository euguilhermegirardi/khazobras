import { ContratoCard } from '@/components/ContratoCard';
import { PagamentosSecao } from '@/components/PagamentosSecao';
import { Button } from '@/components/ui/button';
import type { Contrato } from '@/interfaces/contrato';
import { useContratoAdminDetalhe } from '../hooks';

interface ContratoAdminCardProps {
  obraId: string;
  contrato: Contrato;
  onRegistrarPagamento: (contrato: Contrato) => void;
}

/** Um contrato com os pagamentos (detalhe buscado ao montar; poucos contratos por obra) e o botão de registrar. */
export const ContratoAdminCard = ({ obraId, contrato, onRegistrarPagamento }: ContratoAdminCardProps) => {
  // Hooks
  const detalhe = useContratoAdminDetalhe(obraId, contrato.id);

  // Functions
  const handleRetry = () => void detalhe.refetch();
  const handleRegistrar = () => onRegistrarPagamento(contrato);

  // Return
  return (
    <ContratoCard
      contrato={contrato}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Registrar pagamento no contrato ${contrato.numero}`}
          onClick={handleRegistrar}
        >
          Registrar pagamento
        </Button>
      }
    >
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
