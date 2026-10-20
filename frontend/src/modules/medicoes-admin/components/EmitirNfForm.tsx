import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/services/apiClient';
import {
  emitirNfSchema,
  type EmitirNfFormValues,
  mapNfServerErrors,
  NF_MAX_LENGTH,
  toIssueInvoiceBody,
} from '../emitirNfForm';
import { useEmitirNf } from '../hooks';

interface EmitirNfFormProps {
  obraId: string;
  medicaoId: string;
  onCancel: () => void;
  /** Recebe a mensagem de sucesso para a tela mostrar. */
  onSaved: (mensagem: string) => void;
}

interface FormError {
  message: string;
  requestId?: string;
}

const MENSAGEM_FALHA = 'Não foi possível emitir a NF. Tente novamente.';

/** Erro que não é do campo: 409 (status mudou), 403/404/500, rede ou mensagens gerais do 400. */
const toFormError = (error: unknown, gerais: string[]): FormError => {
  if (gerais.length > 0) return { message: gerais.join(' ') };
  if (error instanceof ApiError) {
    if (error.kind === 'not_found') return { message: 'Esta medição não foi encontrada. Feche e atualize a página.' };
    return { message: error.message, requestId: error.requestId };
  }
  return { message: MENSAGEM_FALHA };
};

export const EmitirNfForm = ({ obraId, medicaoId, onCancel, onSaved }: EmitirNfFormProps) => {
  // Estados
  const [formError, setFormError] = useState<FormError | null>(null);
  // Hooks
  const emitir = useEmitirNf(obraId, medicaoId);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EmitirNfFormValues>({
    resolver: zodResolver(emitirNfSchema),
    defaultValues: { nfNumber: '' },
  });

  // Functions
  const handleServerError = (error: unknown) => {
    const { nfNumber, gerais } = mapNfServerErrors(error instanceof ApiError ? error.fieldErrors : undefined);
    if (nfNumber) setError('nfNumber', { type: 'server', message: nfNumber });
    setFormError(nfNumber && gerais.length === 0 ? null : toFormError(error, gerais));
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const emitida = await emitir.mutateAsync(toIssueInvoiceBody(values));
      onSaved(`NF ${emitida.nfNumber ?? values.nfNumber.trim()} emitida.`);
    } catch (error) {
      handleServerError(error);
    }
  });

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

      <FormField id="nf-numero" label="Número da NF" error={errors.nfNumber?.message}>
        {(c) => <Input {...c} maxLength={NF_MAX_LENGTH} autoComplete="off" {...register('nfNumber')} />}
      </FormField>

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={emitir.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={emitir.isPending}>
          {emitir.isPending ? 'Emitindo…' : 'Emitir NF'}
        </Button>
      </DialogFooter>
    </form>
  );
};
