import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Plus } from 'lucide-react';
import { useState } from 'react';
import { type FieldPath, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { FormField } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useEtapas } from '@/hooks/useEtapas';
import { useEnvioUnico } from '@/hooks/useEnvioUnico';
import { ApiError } from '@/services/apiClient';
import { formatCurrency } from '@/utils/format';
import { ITEM_GRID, MAX_ITENS } from '../constants';
import { useCriarMedicao } from '../hooks';
import {
  itemVazio,
  mapServerErrors,
  type MedicaoFormValues,
  medicaoFormDefaults,
  medicaoFormSchema,
  mesAtual,
  toCreateBody,
  totalDoItem,
  totalGeral,
} from '../medicaoForm';
import { MedicaoItemLinha } from './MedicaoItemLinha';

interface MedicaoFormProps {
  obraId: string;
  /** Número sugerido (maior da lista + 1); editável. */
  proximoNumero: number;
  onCancel: () => void;
  /** Recebe a mensagem de sucesso para a tela mostrar. */
  onSaved: (mensagem: string) => void;
}

interface FormError {
  message: string;
  requestId?: string;
}

const MENSAGEM_FALHA = 'Não foi possível criar a medição. Tente novamente.';

/** Erro que não é de campo: 403/404/500, rede ou mensagens gerais do 400. */
const toFormError = (error: unknown, gerais: string[]): FormError => {
  if (gerais.length > 0) return { message: gerais.join(' ') };
  if (error instanceof ApiError) {
    if (error.kind === 'not_found') return { message: 'Esta obra não foi encontrada. Feche e atualize a página.' };
    return { message: error.message, requestId: error.requestId };
  }
  return { message: MENSAGEM_FALHA };
};

export const MedicaoForm = ({ obraId, proximoNumero, onCancel, onSaved }: MedicaoFormProps) => {
  // Estados
  const [formError, setFormError] = useState<FormError | null>(null);
  // Mês de hoje fixado na montagem (competência padrão).
  const [competenciaInicial] = useState(() => mesAtual(new Date()));
  // Hooks
  const envio = useEnvioUnico();
  const criar = useCriarMedicao(obraId);
  const etapas = useEtapas(obraId);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<MedicaoFormValues>({
    resolver: zodResolver(medicaoFormSchema),
    defaultValues: medicaoFormDefaults(proximoNumero, competenciaInicial),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });
  const itens = useWatch({ control, name: 'itens' });

  // Constants derivadas
  const listaDeEtapas = etapas.data ?? [];
  const erroDosItens = errors.itens?.root?.message ?? errors.itens?.message;
  const dicaEtapa = etapas.isError
    ? 'Não foi possível carregar as etapas; a medição pode ser criada sem etapa.'
    : undefined;

  // Functions
  const handleAddItem = () => append(itemVazio());

  const handleServerError = (error: unknown) => {
    const { campos, gerais } = mapServerErrors(error instanceof ApiError ? error.fieldErrors : undefined);
    for (const [caminho, message] of Object.entries(campos)) {
      // O erro da lista inteira (ex.: "pelo menos um item") fica em `itens.root`.
      const alvo = caminho === 'itens' ? 'itens.root' : caminho;
      setError(alvo as FieldPath<MedicaoFormValues>, { type: 'server', message });
    }
    // 409: número repetido na obra, mensagem do servidor no campo do número.
    if (error instanceof ApiError && error.kind === 'conflict') {
      setError('numero', { type: 'server', message: error.message });
      setFormError(null);
      return;
    }
    const temErroDeCampo = Object.keys(campos).length > 0;
    setFormError(temErroDeCampo && gerais.length === 0 ? null : toFormError(error, gerais));
  };

  const onSubmit = handleSubmit((values) =>
    envio.executar(async () => {
      setFormError(null);
      try {
        const criada = await criar.mutateAsync(toCreateBody(obraId, values));
        envio.concluir();
        onSaved(`Medição ${criada.numero} criada.`);
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

      <div className="grid grid-cols-[8rem_12rem_minmax(0,1fr)] gap-3.5">
        <FormField id="medicao-numero" label="Número" error={errors.numero?.message}>
          {(c) => <Input {...c} inputMode="numeric" autoComplete="off" {...register('numero')} />}
        </FormField>
        <FormField
          id="medicao-competencia"
          label="Competência (mês)"
          error={errors.competencia?.message}
          hint="Formato aaaa-mm"
        >
          {(c) => <Input {...c} type="month" placeholder="aaaa-mm" {...register('competencia')} />}
        </FormField>
        <FormField id="medicao-etapa" label="Etapa (opcional)" error={errors.etapaId?.message} hint={dicaEtapa}>
          {(c) => (
            <NativeSelect {...c} disabled={etapas.isPending} {...register('etapaId')}>
              <option value="">{etapas.isPending ? 'Carregando etapas…' : 'Sem etapa'}</option>
              {listaDeEtapas.map((etapa) => (
                <option key={etapa.id} value={etapa.id}>
                  {etapa.nome}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>

      <section aria-label="Itens da medição" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-medium">Itens</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= MAX_ITENS}
            onClick={handleAddItem}
          >
            <Plus aria-hidden />
            Item
          </Button>
        </div>

        <div aria-hidden className={`${ITEM_GRID} text-[11px] font-medium text-muted-foreground`}>
          <span>Tipo</span>
          <span>Descrição</span>
          <span className="text-right">Quantidade</span>
          <span className="text-right">Valor unit.</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        <ul className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <MedicaoItemLinha
              key={field.id}
              index={index}
              register={register}
              errors={errors.itens?.[index]}
              total={itens?.[index] ? totalDoItem(itens[index]) : 0}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
            />
          ))}
        </ul>

        {erroDosItens && (
          <p role="alert" className="text-[11px] text-danger">
            {erroDosItens}
          </p>
        )}

        <div className="flex items-center justify-end gap-4 rounded-md bg-muted px-3 py-2 text-[13px] font-medium">
          <span>Total da medição</span>
          <span className="tabular-nums">{formatCurrency(totalGeral(itens ?? []))}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Os totais aqui são só uma prévia: o servidor recalcula.</p>
      </section>

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={criar.isPending || envio.enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={criar.isPending || envio.enviando}>
          {criar.isPending || envio.enviando ? 'Salvando…' : 'Criar medição'}
        </Button>
      </DialogFooter>
    </form>
  );
};
