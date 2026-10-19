import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormField } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { EtapaCronograma } from '@/interfaces/etapa';
import { ApiError } from '@/services/apiClient';
import { STATUS_OPCOES, STATUS_REGRA } from '../constants';
import {
  etapaFormDefaults,
  etapaFormSchema,
  type EtapaFormValues,
  mapServerErrors,
  sugerirStatus,
  toCreateBody,
  toUpdateBody,
} from '../etapaForm';
import { useSalvarEtapa } from '../hooks';

interface EtapaFormProps {
  obraId: string;
  /** Etapa em edição; null = criação (só nome, ordem, peso e datas previstas). */
  etapa: EtapaCronograma | null;
  proximaOrdem: number;
  onCancel: () => void;
  /** Recebe a mensagem de sucesso para a tela mostrar. */
  onSaved: (mensagem: string) => void;
}

interface FormError {
  message: string;
  requestId?: string;
}

/** Erro que não é de campo: 403/404/500, rede ou mensagens gerais do 400. */
const toFormError = (error: unknown, gerais: string[]): FormError => {
  if (gerais.length > 0) return { message: gerais.join(' ') };
  if (error instanceof ApiError) {
    if (error.kind === 'not_found') return { message: 'Esta etapa não foi encontrada. Feche e atualize a página.' };
    return { message: error.message, requestId: error.requestId };
  }
  return { message: 'Não foi possível salvar a etapa. Tente novamente.' };
};

export const EtapaForm = ({ obraId, etapa, proximaOrdem, onCancel, onSaved }: EtapaFormProps) => {
  // Estados
  const [formError, setFormError] = useState<FormError | null>(null);
  // Hooks
  const salvar = useSalvarEtapa(obraId);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<EtapaFormValues>({
    resolver: zodResolver(etapaFormSchema),
    defaultValues: etapaFormDefaults(etapa, proximaOrdem),
  });

  const statusAtual = useWatch({ control, name: 'status' });

  // Constants derivadas
  const editando = etapa !== null;
  const regraDoStatus = STATUS_REGRA[statusAtual];

  // Functions
  // Ajuda de UX: o % sugere o status, sem travar a escolha (o select continua livre).
  const handlePercentualChange = (texto: string) => {
    const sugerido = sugerirStatus(texto);
    if (sugerido) setValue('status', sugerido, { shouldDirty: true });
  };

  const handleServerError = (error: unknown) => {
    const { campos, gerais } = mapServerErrors(error instanceof ApiError ? error.fieldErrors : undefined);
    for (const [campo, message] of Object.entries(campos)) {
      setError(campo as keyof EtapaFormValues, { type: 'server', message });
    }
    const temErroDeCampo = Object.keys(campos).length > 0;
    setFormError(temErroDeCampo && gerais.length === 0 ? null : toFormError(error, gerais));
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const salva = await salvar.mutateAsync(
        etapa
          ? { mode: 'edit', id: etapa.id, body: toUpdateBody(values) }
          : { mode: 'create', body: toCreateBody(obraId, values) },
      );
      onSaved(`Etapa "${salva.nome}" ${editando ? 'atualizada' : 'criada'}.`);
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

      <FormField id="etapa-nome" label="Nome da etapa" error={errors.nome?.message}>
        {(control) => <Input {...control} maxLength={150} autoComplete="off" {...register('nome')} />}
      </FormField>

      <div className="grid grid-cols-2 gap-3.5">
        <FormField id="etapa-ordem" label="Ordem" error={errors.ordem?.message}>
          {(control) => <Input {...control} type="number" min={1} step={1} {...register('ordem')} />}
        </FormField>
        <FormField id="etapa-peso" label="Peso (%)" error={errors.percentualPeso?.message}>
          {(control) => (
            <Input {...control} type="number" min={0} max={100} step="any" {...register('percentualPeso')} />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <FormField id="etapa-inicio-previsto" label="Início previsto" error={errors.dataInicioPrevista?.message}>
          {(control) => <Input {...control} type="date" {...register('dataInicioPrevista')} />}
        </FormField>
        <FormField id="etapa-fim-previsto" label="Fim previsto" error={errors.dataFimPrevista?.message}>
          {(control) => <Input {...control} type="date" {...register('dataFimPrevista')} />}
        </FormField>
      </div>

      {editando && (
        <>
          <div className="grid grid-cols-2 gap-3.5">
            <FormField id="etapa-inicio-real" label="Início real" error={errors.dataInicioReal?.message}>
              {(control) => <Input {...control} type="date" {...register('dataInicioReal')} />}
            </FormField>
            <FormField id="etapa-fim-real" label="Fim real" error={errors.dataFimReal?.message}>
              {(control) => <Input {...control} type="date" {...register('dataFimReal')} />}
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <FormField id="etapa-status" label="Status" error={errors.status?.message} hint={regraDoStatus}>
              {(control) => (
                <NativeSelect {...control} {...register('status')}>
                  {STATUS_OPCOES.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="etapa-percentual" label="% concluído" error={errors.percentualConcluido?.message}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  {...register('percentualConcluido', { onChange: (e) => handlePercentualChange(e.target.value) })}
                />
              )}
            </FormField>
          </div>
        </>
      )}

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={salvar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>
  );
};
