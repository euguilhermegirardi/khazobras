import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import type { LancamentoAnexo } from '@/interfaces/financeiro';
import {
  ANEXO_ACCEPT,
  ANEXO_EXTENSOES_TEXTO,
  ANEXO_MAX_POR_LANCAMENTO,
  prepararAnexo,
  validarAnexo,
} from '@/utils/anexo';
import { toMensagemErro, type MensagemErro } from '../erros';
import { useBaixarAnexo, useEnviarAnexo, useRemoverAnexo } from '../hooks';
import { AnexoItem } from './AnexoItem';
import { ErroAlert } from './ErroAlert';

interface AnexosSecaoProps {
  obraId: string;
  lancamentoId: string;
  anexos: LancamentoAnexo[];
}

/** Comprovantes do lançamento (só ao editar): lista, baixar, remover e enviar novo (até 10, 10 MB cada). */
export const AnexosSecao = ({ obraId, lancamentoId, anexos }: AnexosSecaoProps) => {
  // Estados
  const [erro, setErro] = useState<MensagemErro | null>(null);
  // Hooks
  const enviar = useEnviarAnexo(obraId, lancamentoId);
  const remover = useRemoverAnexo(obraId);
  const baixar = useBaixarAnexo();

  // Constants derivadas
  const ocupado = enviar.isPending || remover.isPending || baixar.isPending;
  const noLimite = anexos.length >= ANEXO_MAX_POR_LANCAMENTO;
  const baixandoId = baixar.isPending ? (baixar.variables?.id ?? null) : null;
  const removendoId = remover.isPending ? (remover.variables ?? null) : null;

  // Functions
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const arquivo = input.files?.[0];
    // Limpa o campo: escolher o mesmo arquivo de novo (após um erro) dispara o evento outra vez.
    input.value = '';
    if (!arquivo) return;
    setErro(null);
    const invalido = validarAnexo(arquivo);
    if (invalido) {
      setErro({ message: invalido });
      return;
    }
    try {
      await enviar.mutateAsync(prepararAnexo(arquivo));
    } catch (error) {
      setErro(
        toMensagemErro(error, 'Não foi possível enviar o comprovante. Tente novamente.', 'Lançamento não encontrado.'),
      );
    }
  };

  const handleDownload = async (anexo: LancamentoAnexo) => {
    setErro(null);
    try {
      await baixar.mutateAsync(anexo);
    } catch (error) {
      setErro(
        toMensagemErro(error, 'Não foi possível baixar o comprovante. Tente novamente.', 'Comprovante não encontrado.'),
      );
    }
  };

  const handleRemove = async (anexo: LancamentoAnexo) => {
    setErro(null);
    try {
      await remover.mutateAsync(anexo.id);
    } catch (error) {
      setErro(
        toMensagemErro(
          error,
          'Não foi possível remover o comprovante. Tente novamente.',
          'Comprovante não encontrado.',
        ),
      );
    }
  };

  // Return
  return (
    <section aria-label="Comprovantes" className="grid gap-2.5 border-t pt-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-medium">Comprovantes</h3>
        <span className="text-[11px] text-muted-foreground">
          {anexos.length} de {ANEXO_MAX_POR_LANCAMENTO}
        </span>
      </div>

      {erro && <ErroAlert erro={erro} />}

      {anexos.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-3 text-center text-[13px] text-muted-foreground">
          Nenhum comprovante anexado.
        </p>
      ) : (
        <ul className="rounded-md border px-2">
          {anexos.map((anexo) => (
            <AnexoItem
              key={anexo.id}
              anexo={anexo}
              baixando={baixandoId === anexo.id}
              removendo={removendoId === anexo.id}
              ocupado={ocupado}
              onDownload={(a) => void handleDownload(a)}
              onRemove={(a) => void handleRemove(a)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="lancamento-anexo" className="text-[11px] font-medium text-muted-foreground">
          {enviar.isPending ? 'Enviando comprovante…' : 'Enviar comprovante'}
        </label>
        <Input
          id="lancamento-anexo"
          type="file"
          accept={ANEXO_ACCEPT}
          disabled={ocupado || noLimite}
          aria-describedby="lancamento-anexo-ajuda"
          className="h-auto py-1.5"
          onChange={(e) => void handleFile(e)}
        />
        <p id="lancamento-anexo-ajuda" className="text-[11px] text-muted-foreground">
          {noLimite
            ? 'Limite de 10 comprovantes atingido: remova um para enviar outro.'
            : `Até 10 MB por arquivo. Tipos: ${ANEXO_EXTENSOES_TEXTO}.`}
        </p>
      </div>
    </section>
  );
};
