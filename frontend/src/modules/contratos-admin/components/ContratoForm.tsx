import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useEnvioUnico } from '@/hooks/useEnvioUnico';
import { ApiError } from '@/services/apiClient';
import {
  CONTRATO_CAMPOS_SERVIDOR,
  contratoFormDefaults,
  type ContratoCampo,
  contratoFormSchema,
  type ContratoFormValues,
  NUMERO_MAX_LENGTH,
  toCreateContratoBody,
} from '../contratoForm';
import { useCriarContrato } from '../hooks';
import { mapServerErrors } from '../serverErrors';

interface ContratoFormProps {
  obraId: string;
  onCancel: () => void;
  /** Recebe a mensagem de sucesso para a tela mostrar. */
  onSaved: (mensagem: string) => void;
}

interface FormError {
  message: string;
  requestId?: string;
}

const MENSAGEM_FALHA = 'Não foi possível criar o contrato. Tente novamente.';

/** Erro que não é de campo: 403/404/500, rede ou mensagens gerais do 400. */
const toFormError = (error: unknown, gerais: string[]): FormError => {
  if (gerais.length > 0) return { message: gerais.join(' ') };
  if (error instanceof ApiError) {
    if (error.kind === 'not_found') return { message: 'Esta obra não foi encontrada. Feche e atualize a página.' };
    return { message: error.message, requestId: error.requestId };
  }
  return { message: MENSAGEM_FALHA };
};

export const ContratoForm = ({ obraId, onCancel, onSaved }: ContratoFormProps) => {
  // Estados
  const [formError, setFormError] = useState<FormError | null>(null);
  // Hooks
  const envio = useEnvioUnico();
  const criar = useCriarContrato(obraId);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ContratoFormValues>({
    resolver: zodResolver(contratoFormSchema),
    defaultValues: contratoFormDefaults,
  });

  // Functions
  const handleServerError = (error: unknown) => {
    // 409: número repetido na obra; a mensagem do servidor vai no campo do número.
    if (error instanceof ApiError && error.kind === 'conflict') {
      setError('numero', { type: 'server', message: error.message });
      setFormError(null);
      return;
    }
    const { campos, gerais } = mapServerErrors(
      error instanceof ApiError ? error.fieldErrors : undefined,
      CONTRATO_CAMPOS_SERVIDOR,
    );
    for (const [campo, message] of Object.entries(campos)) {
      setError(campo as ContratoCampo, { type: 'server', message });
    }
    const temErroDeCampo = Object.keys(campos).length > 0;
    setFormError(temErroDeCampo && gerais.length === 0 ? null : toFormError(error, gerais));
  };

  const onSubmit = handleSubmit((values) =>
    envio.executar(async () => {
      setFormError(null);
      try {
        const criado = await criar.mutateAsync(toCreateContratoBody(obraId, values));
        envio.concluir();
        onSaved(`Contrato ${criado.numero} criado.`);
      } catch (error) {
        handleServerError(error);
      }
    }),
  );

  // Return
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
      {formError && (
        <Alert variant="danger">
          <CircleAlert aria-hidden />
          <AlertDescription>
            <p>{formError.message}</p>
            {formError.requestId && <p>Código para o suporte: {formError.requestId}</p>}
          </AlertDescription>
        </Alert>
      )}

      <FormField id="contrato-numero" label="Número do contrato" error={errors.numero?.message}>
        {(c) => <Input {...c} maxLength={NUMERO_MAX_LENGTH} autoComplete="off" {...register('numero')} />}
      </FormField>

      <div className="grid grid-cols-2 gap-3.5">
        <FormField
          id="contrato-valor"
          label="Valor contratado (R$)"
          error={errors.valorContratado?.message}
          hint="Ex.: 125000,55"
        >
          {(c) => <Input {...c} inputMode="decimal" autoComplete="off" {...register('valorContratado')} />}
        </FormField>
        <FormField id="contrato-data" label="Data de assinatura (opcional)" error={errors.dataAssinatura?.message}>
          {(c) => <Input {...c} type="date" {...register('dataAssinatura')} />}
        </FormField>
      </div>

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={criar.isPending || envio.enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={criar.isPending || envio.enviando}>
          {criar.isPending || envio.enviando ? 'Salvando…' : 'Criar contrato'}
        </Button>
      </DialogFooter>
    </form>
  );
};
