import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErroAlert } from '@/components/ErroAlert';
import { FormField } from '@/components/FormField';
import { RelatorioMensalCard } from '@/components/RelatorioMensalCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { RelatorioMensalAdmin } from '@/interfaces/relatorioMensal';
import { ApiError } from '@/services/apiClient';
import { toMensagemErro, type MensagemErro } from '@/utils/erros';
import { mapServerErrors } from '@/utils/serverErrors';
import { CONTEUDO_MAX_LENGTH } from '../constants';
import { useCriarRelatorio, useEditarRelatorio } from '../hooks';
import {
  competenciaDoMes,
  contadorConteudo,
  RELATORIO_CAMPOS_SERVIDOR,
  type RelatorioCampo,
  relatorioFormDefaults,
  relatorioFormFrom,
  relatorioFormSchema,
  type RelatorioFormValues,
  toRelatorioBody,
} from '../relatorioForm';

interface RelatorioEditorProps {
  obraId: string;
  /** Rascunho a editar; `null` = novo. */
  relatorio: RelatorioMensalAdmin | null;
  onCancel: () => void;
  /** Recebe a mensagem de sucesso e o relatório salvo (a tela decide para onde ir). */
  onSaved: (mensagem: string, salvo: RelatorioMensalAdmin) => void;
}

const MENSAGEM_FALHA = 'Não foi possível salvar o relatório. Tente novamente.';
const MENSAGEM_NAO_ENCONTRADO = 'Este relatório não foi encontrado. Volte à lista e atualize a página.';
const MENSAGEM_MES_USADO = 'Já existe um relatório desta obra para este mês. Escolha outro mês ou edite o existente.';

/**
 * Formulário (competência + conteúdo) ao lado da pré-visualização "Como o cliente vê", que acompanha o que se digita
 * (a mesma apresentação da tela do cliente). Serve ao relatório novo e à edição do rascunho.
 */
export const RelatorioEditor = ({ obraId, relatorio, onCancel, onSaved }: RelatorioEditorProps) => {
  // Estados
  const [formError, setFormError] = useState<MensagemErro | null>(null);
  // Hoje fixado na montagem: competência padrão do relatório novo.
  const [hoje] = useState(() => new Date());
  // Hooks
  const criar = useCriarRelatorio(obraId);
  const editar = useEditarRelatorio(obraId, relatorio?.id ?? '');
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
  const [mes, conteudo] = useWatch({ control, name: ['competencia', 'conteudo'] });

  // Constants derivadas
  const salvando = criar.isPending || editar.isPending;
  const competenciaPrevia = competenciaDoMes(mes);
  const passouDoLimite = conteudo.length > CONTEUDO_MAX_LENGTH;

  // Functions
  const handleServerError = (error: unknown) => {
    const { campos, gerais } = mapServerErrors(
      error instanceof ApiError ? error.fieldErrors : undefined,
      RELATORIO_CAMPOS_SERVIDOR,
    );
    // 409 de mês repetido: vai para o campo da competência (o outro 409, "publicado", fica no alerta geral).
    if (error instanceof ApiError && error.kind === 'conflict' && /competencia/i.test(error.message)) {
      campos.competencia = MENSAGEM_MES_USADO;
    }
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
      onSaved(relatorio ? 'Rascunho atualizado.' : 'Rascunho criado. O cliente só vê depois de publicar.', salvo);
    } catch (error) {
      handleServerError(error);
    }
  });

  // Return
  return (
    <form onSubmit={onSubmit} noValidate className="grid items-start gap-3.5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Dados do relatório</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3.5">
          {formError && <ErroAlert erro={formError} />}

          <FormField
            id="relatorio-competencia"
            label="Competência (mês)"
            error={errors.competencia?.message}
            hint="Um relatório por mês em cada obra."
          >
            {(c) => <Input {...c} type="month" {...register('competencia')} />}
          </FormField>

          <FormField id="relatorio-conteudo" label="Conteúdo" error={errors.conteudo?.message}>
            {(c) => (
              <Textarea
                {...c}
                rows={14}
                className="min-h-64 resize-y"
                placeholder="Resumo do mês para o cliente: o que foi feito, pendências e próximos passos."
                {...register('conteudo')}
              />
            )}
          </FormField>
          <p
            className={
              passouDoLimite ? 'text-right text-[11px] text-danger' : 'text-right text-[11px] text-muted-foreground'
            }
            aria-live="polite"
          >
            {contadorConteudo(conteudo)}
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : relatorio ? 'Salvar alterações' : 'Criar rascunho'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <section aria-label="Como o cliente vê" className="flex min-w-0 flex-col gap-2">
        <h2 className="text-[13px] font-medium text-muted-foreground">Como o cliente vê</h2>
        {competenciaPrevia ? (
          <RelatorioMensalCard
            relatorio={{
              competencia: competenciaPrevia,
              conteudo: conteudo || 'O texto aparece aqui enquanto você escreve.',
              publishedAt: null,
            }}
            contentClassName="max-h-[28rem] overflow-y-auto"
          />
        ) : (
          <p className="rounded-xl border border-dashed bg-card p-7 text-center text-[13px] text-muted-foreground">
            Escolha o mês para ver a pré-visualização.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Pré-visualização do texto digitado, sem salvar. O cliente só vê o relatório depois de publicado.
        </p>
      </section>
    </form>
  );
};
