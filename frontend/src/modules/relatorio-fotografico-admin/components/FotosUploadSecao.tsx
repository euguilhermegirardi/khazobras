import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { FormField } from '@/components/FormField';
import { UploadDropzone } from '@/components/UploadDropzone';
import { UploadFilaAcoes } from '@/components/UploadFilaAcoes';
import { UploadFilaPainel } from '@/components/UploadFilaPainel';
import { UploadRecusadosAlert } from '@/components/UploadRecusadosAlert';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FOTO_ACCEPT, FOTO_DESCRICAO_MAX, FOTO_EXTENSOES_TEXTO, FOTO_MAX_POR_RELATORIO } from '@/utils/foto';
import { resumoFila } from '@/utils/uploadFila';
import { dataMaximaFoto, validarLote } from '../fotoForm';
import { useUploadFila } from '../useUploadFila';
import { UploadItemLinha } from './UploadItemLinha';

interface FotosUploadSecaoProps {
  obraId: string;
  relatorioId: string;
  /** Fotos que o relatório já tem (conta para o limite de 100). */
  jaNoRelatorio: number;
}

/**
 * Envio de fotos em lote: escolher (vários) ou soltar arquivos, descrição e data opcionais para o lote, fila sequencial
 * com status por arquivo, progresso, "tentar de novo" nas falhas e cancelar.
 */
export const FotosUploadSecao = ({ obraId, relatorioId, jaNoRelatorio }: FotosUploadSecaoProps) => {
  // Estados
  const [descricao, setDescricao] = useState('');
  const [dataFoto, setDataFoto] = useState('');
  const [errosLote, setErrosLote] = useState<{ descricao?: string; dataFoto?: string }>({});
  // Hoje fixado na montagem: a data da foto vai até amanhã.
  const [hoje] = useState(() => new Date());
  // Hooks
  const upload = useUploadFila({ obraId, relatorioId, jaNoRelatorio });

  // Constants derivadas
  const { fila, rodando, cancelando, recusados, interrompida } = upload;
  const resumo = resumoFila(fila);
  const emAndamento = resumo.pendentes + resumo.enviando;
  const relatorioCheio = jaNoRelatorio + emAndamento >= FOTO_MAX_POR_RELATORIO;

  // Functions
  /** Valida descrição e data do lote; `null` = há erro (mostrado nos campos). */
  const metadadosDoLote = () => {
    const erros = validarLote({ descricao, dataFoto }, hoje);
    setErrosLote(erros);
    if (Object.keys(erros).length > 0) return null;
    return { descricao: descricao.trim() || undefined, dataFoto: dataFoto.trim() || undefined };
  };

  const handleSend = () => {
    const metadados = metadadosDoLote();
    if (metadados) void upload.iniciar(metadados);
  };

  const handleRetry = () => {
    const metadados = metadadosDoLote();
    if (metadados) upload.repetirFalhas(metadados);
  };

  const handleDescricao = (e: ChangeEvent<HTMLInputElement>) => setDescricao(e.target.value);
  const handleData = (e: ChangeEvent<HTMLInputElement>) => setDataFoto(e.target.value);

  // Return
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Enviar fotos</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        <UploadDropzone
          id="upload-fotos"
          accept={FOTO_ACCEPT}
          disabled={relatorioCheio}
          texto="Arraste as fotos aqui ou clique para selecionar (várias de uma vez)"
          textoDesabilitado="Limite de 100 fotos atingido: remova uma foto para enviar outra."
          ajuda={
            <>
              Até 10 MB por foto. Tipos: {FOTO_EXTENSOES_TEXTO}. O relatório tem {jaNoRelatorio} de{' '}
              {FOTO_MAX_POR_RELATORIO} fotos.
            </>
          }
          onFiles={upload.adicionar}
        />

        {recusados.length > 0 && <UploadRecusadosAlert recusados={recusados} />}

        <div className="grid grid-cols-2 gap-3.5">
          <FormField
            id="upload-descricao"
            label="Descrição do lote"
            error={errosLote.descricao}
            hint="Opcional. Vale para todas as fotos enviadas agora; dá para ajustar uma a uma depois."
          >
            {(c) => (
              <Input
                {...c}
                value={descricao}
                maxLength={FOTO_DESCRICAO_MAX}
                autoComplete="off"
                disabled={rodando}
                onChange={handleDescricao}
              />
            )}
          </FormField>
          <FormField id="upload-data" label="Data das fotos" error={errosLote.dataFoto} hint="Opcional.">
            {(c) => (
              <Input
                {...c}
                type="date"
                min="2000-01-01"
                max={dataMaximaFoto(hoje)}
                value={dataFoto}
                disabled={rodando}
                onChange={handleData}
              />
            )}
          </FormField>
        </div>

        {interrompida && (
          <Alert variant="danger">
            <AlertDescription>
              <p>{interrompida}</p>
              <p>As fotos que não foram enviadas continuam na fila: corrija e envie de novo.</p>
            </AlertDescription>
          </Alert>
        )}

        {fila.length > 0 && (
          <UploadFilaPainel resumo={resumo} cancelando={cancelando} singular="foto" plural="fotos">
            {fila.map((item) => (
              <UploadItemLinha key={item.id} item={item} onRemove={upload.remover} />
            ))}
          </UploadFilaPainel>
        )}

        {fila.length > 0 && (
          <UploadFilaAcoes
            resumo={resumo}
            rodando={rodando}
            cancelando={cancelando}
            singular="foto"
            plural="fotos"
            onSend={handleSend}
            onCancel={upload.cancelar}
            onRetry={handleRetry}
            onClear={upload.limpar}
          />
        )}
      </CardContent>
    </Card>
  );
};
