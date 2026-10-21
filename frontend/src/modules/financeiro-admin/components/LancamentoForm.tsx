import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { LancamentoAdmin } from '@/interfaces/financeiroAdmin';
import { ApiError } from '@/services/apiClient';
import { mapServerErrors } from '@/utils/serverErrors';
import { formatCurrency } from '@/utils/format';
import { DESCRICAO_MAX_LENGTH } from '../constants';
import { toMensagemErro, type MensagemErro } from '../erros';
import { useCategoriaOpcoes, useCriarLancamento, useEditarLancamento } from '../hooks';
import {
  LANCAMENTO_CAMPOS_SERVIDOR,
  type LancamentoCampo,
  lancamentoFormDefaults,
  lancamentoFormFrom,
  lancamentoFormSchema,
  type LancamentoFormValues,
  toLancamentoBody,
} from '../lancamentoForm';
import { ErroAlert } from './ErroAlert';

interface LancamentoFormProps {
  obraId: string;
  /** Lançamento a editar; `null` = novo. */
  lancamento: LancamentoAdmin | null;
  onCancel: () => void;
  /** Recebe a mensagem de sucesso para a tela mostrar. */
  onSaved: (mensagem: string) => void;
}

const MENSAGEM_FALHA = 'Não foi possível salvar o lançamento. Tente novamente.';
const MENSAGEM_NAO_ENCONTRADO = 'Este lançamento não foi encontrado. Feche e atualize a página.';

export const LancamentoForm = ({ obraId, lancamento, onCancel, onSaved }: LancamentoFormProps) => {
  // Estados
  const [formError, setFormError] = useState<MensagemErro | null>(null);
  // Hoje fixado na montagem: data e competência padrão do lançamento novo.
  const [hoje] = useState(() => new Date());
  // Hooks
  const criar = useCriarLancamento(obraId);
  const editar = useEditarLancamento(obraId, lancamento?.id ?? '');
  const categorias = useCategoriaOpcoes();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LancamentoFormValues>({
    resolver: zodResolver(lancamentoFormSchema),
    defaultValues: lancamento ? lancamentoFormFrom(lancamento) : lancamentoFormDefaults(hoje),
  });

  // Constants derivadas
  const salvando = criar.isPending || editar.isPending;

  // Functions
  const handleServerError = (error: unknown) => {
    const { campos, gerais } = mapServerErrors(
      error instanceof ApiError ? error.fieldErrors : undefined,
      LANCAMENTO_CAMPOS_SERVIDOR,
    );
    for (const [campo, message] of Object.entries(campos)) {
      setError(campo as LancamentoCampo, { type: 'server', message });
    }
    const temErroDeCampo = Object.keys(campos).length > 0;
    if (gerais.length > 0) setFormError({ message: gerais.join(' ') });
    else if (temErroDeCampo) setFormError(null);
    else setFormError(toMensagemErro(error, MENSAGEM_FALHA, MENSAGEM_NAO_ENCONTRADO));
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const body = toLancamentoBody(values);
      if (lancamento) await editar.mutateAsync(body);
      else await criar.mutateAsync({ obraId, ...body });
      const valor = formatCurrency(body.valor);
      onSaved(lancamento ? `Lançamento de ${valor} atualizado.` : `Lançamento de ${valor} criado.`);
    } catch (error) {
      handleServerError(error);
    }
  });

  // Return
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
      {formError && <ErroAlert erro={formError} />}

      <div className="grid grid-cols-2 gap-3.5">
        <FormField id="lancamento-categoria" label="Categoria" error={errors.categoria?.message}>
          {(c) => (
            <NativeSelect {...c} {...register('categoria')}>
              <option value="">Escolha…</option>
              {categorias.map((categoria) => (
                <option key={categoria.valor} value={categoria.valor}>
                  {categoria.rotulo}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField id="lancamento-valor" label="Valor (R$)" error={errors.valor?.message} hint="Ex.: 1500,50">
          {(c) => <Input {...c} inputMode="decimal" autoComplete="off" {...register('valor')} />}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <FormField id="lancamento-data" label="Data do lançamento" error={errors.dataLancamento?.message}>
          {(c) => <Input {...c} type="date" {...register('dataLancamento')} />}
        </FormField>
        <FormField
          id="lancamento-competencia"
          label="Competência"
          error={errors.mesCompetencia?.message}
          hint="Mês a que o custo pertence."
        >
          {(c) => <Input {...c} type="month" {...register('mesCompetencia')} />}
        </FormField>
      </div>

      <FormField id="lancamento-descricao" label="Descrição" error={errors.descricao?.message}>
        {(c) => <Input {...c} maxLength={DESCRICAO_MAX_LENGTH} autoComplete="off" {...register('descricao')} />}
      </FormField>

      <div className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2.5">
        <label htmlFor="lancamento-visivel" className="flex items-center gap-2 text-[13px] font-medium">
          <input
            id="lancamento-visivel"
            type="checkbox"
            className="size-4 accent-primary"
            aria-describedby="lancamento-visivel-ajuda"
            {...register('visivelCliente')}
          />
          Liberar ao cliente
        </label>
        <p id="lancamento-visivel-ajuda" className="text-[11px] text-muted-foreground">
          O cliente só vê os lançamentos liberados (e baixa os comprovantes deles). Por padrão o lançamento fica oculto.
        </p>
        {errors.visivelCliente?.message && <p className="text-[11px] text-danger">{errors.visivelCliente.message}</p>}
      </div>

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : lancamento ? 'Salvar alterações' : 'Criar lançamento'}
        </Button>
      </DialogFooter>
    </form>
  );
};
