import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ErroAlert } from '@/components/ErroAlert';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Foto } from '@/interfaces/relatorioFotografico';
import { ApiError } from '@/services/apiClient';
import { toMensagemErro, type MensagemErro } from '@/utils/erros';
import { FOTO_DESCRICAO_MAX } from '@/utils/foto';
import { mapServerErrors } from '@/utils/serverErrors';
import {
  dataMaximaFoto,
  FOTO_CAMPOS_SERVIDOR,
  type FotoCampo,
  fotoFormFrom,
  fotoFormSchemaPara,
  type FotoFormValues,
  toFotoPatch,
} from '../fotoForm';
import { useEditarFoto } from '../hooks';

interface FotoEditFormProps {
  obraId: string;
  foto: Foto;
  onCancel: () => void;
  onSaved: (mensagem: string) => void;
}

const MENSAGEM_FALHA = 'Não foi possível salvar a foto. Tente novamente.';
const MENSAGEM_NAO_ENCONTRADO = 'Esta foto não foi encontrada. Feche e atualize a página.';

export const FotoEditForm = ({ obraId, foto, onCancel, onSaved }: FotoEditFormProps) => {
  // Estados
  const [formError, setFormError] = useState<MensagemErro | null>(null);
  // Hoje fixado na montagem: a data da foto vai até amanhã.
  const [hoje] = useState(() => new Date());
  // Hooks
  const editar = useEditarFoto(obraId);
  const schema = useMemo(() => fotoFormSchemaPara(hoje), [hoje]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FotoFormValues>({ resolver: zodResolver(schema), defaultValues: fotoFormFrom(foto) });

  // Functions
  const handleServerError = (error: unknown) => {
    const { campos, gerais } = mapServerErrors(
      error instanceof ApiError ? error.fieldErrors : undefined,
      FOTO_CAMPOS_SERVIDOR,
    );
    for (const [campo, message] of Object.entries(campos)) {
      setError(campo as FotoCampo, { type: 'server', message });
    }
    const temErroDeCampo = Object.keys(campos).length > 0;
    if (gerais.length > 0) setFormError({ message: gerais.join(' ') });
    else if (temErroDeCampo) setFormError(null);
    else setFormError(toMensagemErro(error, MENSAGEM_FALHA, MENSAGEM_NAO_ENCONTRADO));
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const patch = toFotoPatch(values, foto);
    // Nada mudou: não há o que gravar.
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    try {
      await editar.mutateAsync({ fotoId: foto.id, body: patch });
      onSaved('Foto atualizada.');
    } catch (error) {
      handleServerError(error);
    }
  });

  // Return
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
      {formError && <ErroAlert erro={formError} />}

      <FormField
        id="foto-descricao"
        label="Descrição"
        error={errors.descricao?.message}
        hint="Opcional. Aparece abaixo da foto, para o cliente também."
      >
        {(c) => <Input {...c} maxLength={FOTO_DESCRICAO_MAX} autoComplete="off" {...register('descricao')} />}
      </FormField>

      <FormField id="foto-data" label="Data da foto" error={errors.dataFoto?.message} hint="Opcional.">
        {(c) => <Input {...c} type="date" min="2000-01-01" max={dataMaximaFoto(hoje)} {...register('dataFoto')} />}
      </FormField>

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={editar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={editar.isPending}>
          {editar.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </DialogFooter>
    </form>
  );
};
