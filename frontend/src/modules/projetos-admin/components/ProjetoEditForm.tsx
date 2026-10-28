import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ErroAlert } from '@/components/ErroAlert';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useEtapas } from '@/hooks/useEtapas';
import { useEnvioUnico } from '@/hooks/useEnvioUnico';
import type { ProjetoDocumento } from '@/interfaces/projeto';
import { ApiError } from '@/services/apiClient';
import { toMensagemErro, type MensagemErro } from '@/utils/erros';
import { mapServerErrors } from '@/utils/serverErrors';
import { useEditarProjeto } from '../hooks';
import {
  PROJETO_CAMPOS_SERVIDOR,
  type ProjetoCampo,
  projetoFormFrom,
  projetoFormSchemaPara,
  type ProjetoFormValues,
  semMudancas,
  toProjetoBody,
} from '../projetoForm';
import { extensaoDe, PROJETO_NOME_MAX, PROJETO_TIPO_MAX } from '../projetoRegras';
import { EtapaOpcoes } from './EtapaOpcoes';

interface ProjetoEditFormProps {
  obraId: string;
  projeto: ProjetoDocumento;
  onCancel: () => void;
  onSaved: (mensagem: string) => void;
}

const MENSAGEM_FALHA = 'Não foi possível salvar o documento. Tente novamente.';
const MENSAGEM_NAO_ENCONTRADO = 'Este documento não foi encontrado. Feche e atualize a página.';

export const ProjetoEditForm = ({ obraId, projeto, onCancel, onSaved }: ProjetoEditFormProps) => {
  // Estados
  const [formError, setFormError] = useState<MensagemErro | null>(null);
  // Hooks
  const envio = useEnvioUnico();
  const editar = useEditarProjeto(obraId);
  // O diálogo só monta o formulário com as etapas resolvidas (o select nativo não reaplica o valor se as opções
  // chegarem depois); se falharam, o formulário segue só com "Sem etapa" (e "Etapa atual" se o documento tem uma).
  const { data: etapas = [] } = useEtapas(obraId);
  const extensao = extensaoDe(projeto.nome);
  const schema = useMemo(() => projetoFormSchemaPara(extensao), [extensao]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProjetoFormValues>({ resolver: zodResolver(schema), defaultValues: projetoFormFrom(projeto) });

  // Functions
  const handleServerError = (error: unknown) => {
    const { campos, gerais } = mapServerErrors(
      error instanceof ApiError ? error.fieldErrors : undefined,
      PROJETO_CAMPOS_SERVIDOR,
    );
    for (const [campo, message] of Object.entries(campos)) {
      setError(campo as ProjetoCampo, { type: 'server', message });
    }
    const temErroDeCampo = Object.keys(campos).length > 0;
    if (gerais.length > 0) setFormError({ message: gerais.join(' ') });
    else if (temErroDeCampo) setFormError(null);
    else setFormError(toMensagemErro(error, MENSAGEM_FALHA, MENSAGEM_NAO_ENCONTRADO));
  };

  const onSubmit = handleSubmit((values) =>
    envio.executar(async () => {
      setFormError(null);
      const body = toProjetoBody(values);
      // Nada mudou: não há o que gravar.
      if (semMudancas(body, projeto)) {
        onCancel();
        return;
      }
      try {
        await editar.mutateAsync({ id: projeto.id, body });
        envio.concluir();
        onSaved('Documento atualizado.');
      } catch (error) {
        handleServerError(error);
      }
    }),
  );

  // Return
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
      {formError && <ErroAlert erro={formError} />}

      <FormField
        id="projeto-nome"
        label="Nome do documento"
        error={errors.nome?.message}
        hint={extensao ? `Mantenha a extensão do arquivo (${extensao}).` : undefined}
      >
        {(c) => <Input {...c} maxLength={PROJETO_NOME_MAX} autoComplete="off" {...register('nome')} />}
      </FormField>

      <FormField
        id="projeto-tipo"
        label="Tipo de documento"
        error={errors.tipoDocumento?.message}
        hint="Opcional. Ex.: Planta baixa, Memorial descritivo."
      >
        {(c) => <Input {...c} maxLength={PROJETO_TIPO_MAX} autoComplete="off" {...register('tipoDocumento')} />}
      </FormField>

      <FormField
        id="projeto-etapa"
        label="Etapa"
        error={errors.etapaId?.message}
        hint="Opcional. O cliente vê o documento no grupo da etapa."
      >
        {(c) => (
          <NativeSelect {...c} {...register('etapaId')}>
            <EtapaOpcoes etapas={etapas} etapaAtualId={projeto.etapaId} />
          </NativeSelect>
        )}
      </FormField>

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={editar.isPending || envio.enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={editar.isPending || envio.enviando}>
          {editar.isPending || envio.enviando ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </DialogFooter>
    </form>
  );
};
