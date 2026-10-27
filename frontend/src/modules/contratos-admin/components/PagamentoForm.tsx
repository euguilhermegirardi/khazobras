import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useEnvioUnico } from '@/hooks/useEnvioUnico';
import { ApiError } from '@/services/apiClient';
import { formatMonthYearTitle } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';
import { useMedicoesComNf, useRegistrarPagamento } from '../hooks';
import {
  amanha,
  FORMA_MAX_LENGTH,
  PAGAMENTO_CAMPOS_SERVIDOR,
  type PagamentoCampo,
  pagamentoFormDefaults,
  pagamentoFormSchema,
  type PagamentoFormValues,
  toCreatePagamentoBody,
} from '../pagamentoForm';
import { mapServerErrors } from '../serverErrors';

interface PagamentoFormProps {
  obraId: string;
  contratoId: string;
  numeroContrato: string;
  onCancel: () => void;
  /** Recebe a mensagem de sucesso para a tela mostrar. */
  onSaved: (mensagem: string) => void;
}

interface FormError {
  message: string;
  requestId?: string;
}

const MENSAGEM_FALHA = 'Não foi possível registrar o pagamento. Tente novamente.';

/** Erro que não é de campo: 403/404/500, rede ou mensagens gerais do 400. */
const toFormError = (error: unknown, gerais: string[]): FormError => {
  if (gerais.length > 0) return { message: gerais.join(' ') };
  if (error instanceof ApiError) {
    if (error.kind === 'not_found') return { message: 'Este contrato não foi encontrado. Feche e atualize a página.' };
    return { message: error.message, requestId: error.requestId };
  }
  return { message: MENSAGEM_FALHA };
};

export const PagamentoForm = ({ obraId, contratoId, numeroContrato, onCancel, onSaved }: PagamentoFormProps) => {
  // Estados
  const [formError, setFormError] = useState<FormError | null>(null);
  // Hoje fixado na montagem: data padrão e limite do campo.
  const [hoje] = useState(() => new Date());
  // Hooks
  const envio = useEnvioUnico();
  const registrar = useRegistrarPagamento(obraId, contratoId);
  const medicoes = useMedicoesComNf(obraId);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PagamentoFormValues>({
    resolver: zodResolver(pagamentoFormSchema),
    defaultValues: pagamentoFormDefaults(hoje),
  });

  // Constants derivadas
  const listaDeMedicoes = medicoes.data ?? [];
  const dicaMedicao = medicoes.isError
    ? 'Não foi possível carregar as medições; o pagamento pode ser registrado sem medição.'
    : medicoes.isSuccess && listaDeMedicoes.length === 0
      ? 'Nenhuma medição com NF emitida nesta obra.'
      : 'Só medições com NF emitida podem ser vinculadas.';

  // Functions
  const handleServerError = (error: unknown) => {
    const { campos, gerais } = mapServerErrors(
      error instanceof ApiError ? error.fieldErrors : undefined,
      PAGAMENTO_CAMPOS_SERVIDOR,
    );
    for (const [campo, message] of Object.entries(campos)) {
      setError(campo as PagamentoCampo, { type: 'server', message });
    }
    const temErroDeCampo = Object.keys(campos).length > 0;
    setFormError(temErroDeCampo && gerais.length === 0 ? null : toFormError(error, gerais));
  };

  const onSubmit = handleSubmit((values) =>
    envio.executar(async () => {
      setFormError(null);
      try {
        const body = toCreatePagamentoBody(values);
        await registrar.mutateAsync(body);
        envio.concluir();
        onSaved(`Pagamento de ${formatCurrency(body.valor)} registrado no contrato ${numeroContrato}.`);
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

      <div className="grid grid-cols-2 gap-3.5">
        <FormField id="pagamento-valor" label="Valor (R$)" error={errors.valor?.message} hint="Ex.: 2500,50">
          {(c) => <Input {...c} inputMode="decimal" autoComplete="off" {...register('valor')} />}
        </FormField>
        <FormField id="pagamento-data" label="Data do pagamento" error={errors.dataPagamento?.message}>
          {(c) => <Input {...c} type="date" max={amanha(hoje)} {...register('dataPagamento')} />}
        </FormField>
      </div>

      <FormField
        id="pagamento-forma"
        label="Forma de pagamento (opcional)"
        error={errors.formaPagamento?.message}
        hint="Ex.: Pix, TED, boleto"
      >
        {(c) => <Input {...c} maxLength={FORMA_MAX_LENGTH} autoComplete="off" {...register('formaPagamento')} />}
      </FormField>

      <FormField
        id="pagamento-medicao"
        label="Medição vinculada (opcional)"
        error={errors.referenteMedicaoId?.message}
        hint={dicaMedicao}
      >
        {(c) => (
          <NativeSelect {...c} disabled={medicoes.isPending} {...register('referenteMedicaoId')}>
            <option value="">{medicoes.isPending ? 'Carregando medições…' : 'Sem medição'}</option>
            {listaDeMedicoes.map((medicao) => (
              <option key={medicao.id} value={medicao.id}>
                {`Medição nº ${medicao.numero} — ${formatMonthYearTitle(medicao.competencia)} — ${formatCurrency(medicao.valorTotal)}`}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={registrar.isPending || envio.enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={registrar.isPending || envio.enviando}>
          {registrar.isPending || envio.enviando ? 'Salvando…' : 'Registrar pagamento'}
        </Button>
      </DialogFooter>
    </form>
  );
};
