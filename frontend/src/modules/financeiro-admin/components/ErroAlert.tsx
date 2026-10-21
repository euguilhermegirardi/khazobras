import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { MensagemErro } from '../erros';

interface ErroAlertProps {
  erro: MensagemErro;
}

/** Faixa vermelha de erro de uma ação, com o código para o suporte nos 500. */
export const ErroAlert = ({ erro }: ErroAlertProps) => (
  <Alert variant="danger">
    <CircleAlert aria-hidden />
    <AlertDescription>
      <p>{erro.message}</p>
      {erro.requestId && <p>Código para o suporte: {erro.requestId}</p>}
    </AlertDescription>
  </Alert>
);
