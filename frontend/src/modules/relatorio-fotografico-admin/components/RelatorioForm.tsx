import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErroAlert } from '@/components/ErroAlert';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useEtapas } from '@/hooks/useEtapas';
import type { RelatorioFotografico } from '@/interfaces/relatorioFotografico';
import { ApiError } from '@/services/apiClient';
import { toMensagemErro, type MensagemErro } from '@/utils/erros';
import { RELATORIO_TIPO_LABEL } from '@/utils/relatorioFotografico';
import { mapServerErrors } from '@/utils/serverErrors';
import { TITULO_MAX_LENGTH } from '../constants';
import { useCriarRelatorio, useEditarRelatorio } from '../hooks';
import {
  RELATORIO_CAMPOS_SERVIDOR,
  type RelatorioCampo,
  relatorioFormDefaults,
  relatorioFormFrom,
  relatorioFormSchema,
  type RelatorioFormValues,
  sugestoesDoFormulario,
  toRelatorioBody,
} from '../relatorioForm';

interface RelatorioFormProps {
  obraId: string;
  /** Relatório a editar; `null` = novo. */
  relatorio: RelatorioFotografico | null;
  onCancel: () => void;
  /** Recebe a mensagem de sucesso e o relatório salvo (a tela abre a aba do tipo dele). */
  onSaved: (mensagem: string, salvo: RelatorioFotografico) => void;
}

const MENSAGEM_FALHA = 'Não foi possível salvar o relatório. Tente novamente.';
const MENSAGEM_NAO_ENCONTRADO = 'Este relatório não foi encontrado. Feche e atualize a página.';

export const RelatorioForm = ({ obraId, relatorio, onCancel, onSaved }: RelatorioFormProps) => {
  // Estados
  const [formError, setFormError] = useState<MensagemErro | null>(null);
  // Hoje fixado na montagem: competência padrão do relatório novo.
  const [hoje] = useState(() => new Date());
  // Hooks
  const criar = useCriarRelatorio(obraId);
  const editar = useEditarRelatorio(obraId, relatorio?.id ?? '');
  // O diálogo só monta o formulário com as etapas resolvidas (o select nativo não reaplica o valor se as opções
  // chegarem depois); se falharam, o formulário segue só com "Sem etapa".
  const { data: etapas = [] } = useEtapas(obraId);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<RelatorioFormValues>({
    resolver: zodResolver(relatorioFormSchema),
    defaultValues: relatorio ? relatorioFormFrom(relatorio) : relatorioFormDefaults(hoje),
  });

  const [tipo, etapaId, competencia] = useWatch({ control, name: ['tipo', 'etapaId', 'competencia'] });

  // Constants derivadas
  const salvando = criar.isPending || editar.isPending;
  const sugestoes = sugestoesDoFormulario({ tipo, etapaId, competencia });
  const etapaAtualDesconhecida = Boolean(relatorio?.etapaId) && !etapas.some((e) => e.id === relatorio?.etapaId);

  // Functions
  const handleServerError = (error: unknown) => {
    const { campos, gerais } = mapServerErrors(
      error instanceof ApiError ? error.fieldErrors : undefined,
      RELATORIO_CAMPOS_SERVIDOR,
    );
    for (const [campo, message] of Object.entries(campos)) {
      setError(campo as RelatorioCampo, { type: 'server', message });
    }
    const temErroDeCampo = Object.keys(campos).length > 0;
    if (gerais.length > 0) setFormError({ message: gerais.join(' ') });
    else if (temErroDeCampo) setFormError(null);
    else setFormError(toMensagemErro(error, MENSAGEM_FALHA, MENSAGEM_NAO_ENCONTRADO));
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const body = toRelatorioBody(values);
      const salvo = relatorio ? await editar.mutateAsync(body) : await criar.mutateAsync({ obraId, ...body });
      onSaved(relatorio ? `Relatório “${body.titulo}” atualizado.` : `Relatório “${body.titulo}” criado.`, salvo);
    } catch (error) {
      handleServerError(error);
    }
  });

  // Return
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
      {formError && <ErroAlert erro={formError} />}

      <div className="grid grid-cols-2 gap-3.5">
        <FormField id="relatorio-tipo" label="Tipo" error={errors.tipo?.message}>
          {(c) => (
            <NativeSelect {...c} {...register('tipo')}>
              <option value="mensal">{RELATORIO_TIPO_LABEL.mensal}</option>
              <option value="etapa">{RELATORIO_TIPO_LABEL.etapa}</option>
            </NativeSelect>
          )}
        </FormField>
        <FormField
          id="relatorio-competencia"
          label="Competência"
          error={errors.competencia?.message}
          hint={sugestoes.competencia || 'Mês a que o relatório se refere (opcional).'}
        >
          {(c) => <Input {...c} type="month" {...register('competencia')} />}
        </FormField>
      </div>

      <FormField
        id="relatorio-etapa"
        label="Etapa"
        error={errors.etapaId?.message}
        hint={sugestoes.etapa || 'Etapa da obra a que o relatório se refere (opcional).'}
      >
        {(c) => (
          <NativeSelect {...c} {...register('etapaId')}>
            <option value="">Sem etapa</option>
            {etapaAtualDesconhecida && relatorio?.etapaId && <option value={relatorio.etapaId}>Etapa atual</option>}
            {etapas.map((etapa) => (
              <option key={etapa.id} value={etapa.id}>
                {etapa.nome}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <FormField
        id="relatorio-titulo"
        label="Título"
        error={errors.titulo?.message}
        hint="Ex.: “Setembro” ou “Fundação concluída”."
      >
        {(c) => <Input {...c} maxLength={TITULO_MAX_LENGTH} autoComplete="off" {...register('titulo')} />}
      </FormField>

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : relatorio ? 'Salvar alterações' : 'Criar relatório'}
        </Button>
      </DialogFooter>
    </form>
  );
};
