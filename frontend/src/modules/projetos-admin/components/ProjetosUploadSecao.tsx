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
import { NativeSelect } from '@/components/ui/native-select';
import type { Etapa } from '@/interfaces/etapa';
import { resumoFila } from '@/utils/uploadFila';
import { validarLote } from '../projetoForm';
import { PROJETO_ACCEPT, PROJETO_EXTENSOES_TEXTO, PROJETO_MAX_POR_OBRA, PROJETO_TIPO_MAX } from '../projetoRegras';
import { useUploadFila } from '../useUploadFila';
import { EtapaOpcoes } from './EtapaOpcoes';
import { UploadItemLinha } from './UploadItemLinha';

/** "documento" é masculino: "2 de 3 documentos enviados". */
const ENVIADOS = { singular: 'enviado', plural: 'enviados' };

interface ProjetosUploadSecaoProps {
  obraId: string;
  /** Documentos que a obra já tem (conta para o limite de 200). */
  jaNaObra: number;
  etapas: Etapa[];
}

/**
 * Envio de documentos em lote: escolher (vários) ou soltar arquivos, etapa e tipo de documento opcionais para o lote,
 * fila sequencial com status por arquivo, progresso, "tentar de novo" nas falhas e cancelar.
 */
export const ProjetosUploadSecao = ({ obraId, jaNaObra, etapas }: ProjetosUploadSecaoProps) => {
  // Estados
  const [etapaId, setEtapaId] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [errosLote, setErrosLote] = useState<{ tipoDocumento?: string }>({});
  // Hooks
  const upload = useUploadFila({ obraId, jaNaObra });

  // Constants derivadas
  const { fila, rodando, cancelando, recusados, interrompida } = upload;
  const resumo = resumoFila(fila);
  const emAndamento = resumo.pendentes + resumo.enviando;
  const obraCheia = jaNaObra + emAndamento >= PROJETO_MAX_POR_OBRA;

  // Functions
  /** Valida o tipo do lote; `null` = há erro (mostrado no campo). */
  const metadadosDoLote = () => {
    const erros = validarLote({ tipoDocumento, etapaId });
    setErrosLote(erros);
    if (Object.keys(erros).length > 0) return null;
    return { etapaId: etapaId || undefined, tipoDocumento: tipoDocumento.trim() || undefined };
  };

  const handleSend = () => {
    const metadados = metadadosDoLote();
    if (metadados) void upload.iniciar(metadados);
  };

  const handleRetry = () => {
    const metadados = metadadosDoLote();
    if (metadados) upload.repetirFalhas(metadados);
  };

  const handleEtapa = (e: ChangeEvent<HTMLSelectElement>) => setEtapaId(e.target.value);
  const handleTipo = (e: ChangeEvent<HTMLInputElement>) => setTipoDocumento(e.target.value);

  // Return
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Enviar documentos</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        <UploadDropzone
          id="upload-projetos"
          accept={PROJETO_ACCEPT}
          disabled={obraCheia}
          texto="Arraste os documentos aqui ou clique para selecionar (vários de uma vez)"
          textoDesabilitado="Limite de 200 documentos atingido: exclua um documento para enviar outro."
          ajuda={
            <>
              Até 10 MB por arquivo. Tipos: {PROJETO_EXTENSOES_TEXTO}. A obra tem {jaNaObra} de {PROJETO_MAX_POR_OBRA}{' '}
              documentos.
            </>
          }
          onFiles={upload.adicionar}
        />

        {recusados.length > 0 && <UploadRecusadosAlert recusados={recusados} />}

        <div className="grid grid-cols-2 gap-3.5">
          <FormField
            id="upload-etapa"
            label="Etapa do lote"
            hint="Opcional. Vale para todos os documentos enviados agora; dá para ajustar um a um depois."
          >
            {(c) => (
              <NativeSelect {...c} value={etapaId} disabled={rodando} onChange={handleEtapa}>
                <EtapaOpcoes etapas={etapas} />
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id="upload-tipo"
            label="Tipo de documento do lote"
            error={errosLote.tipoDocumento}
            hint="Opcional. Ex.: Planta baixa, Memorial descritivo."
          >
            {(c) => (
              <Input
                {...c}
                value={tipoDocumento}
                maxLength={PROJETO_TIPO_MAX}
                autoComplete="off"
                disabled={rodando}
                onChange={handleTipo}
              />
            )}
          </FormField>
        </div>

        {interrompida && (
          <Alert variant="danger">
            <AlertDescription>
              <p>{interrompida}</p>
              <p>Os documentos que não foram enviados continuam na fila: corrija e envie de novo.</p>
            </AlertDescription>
          </Alert>
        )}

        {fila.length > 0 && (
          <UploadFilaPainel
            resumo={resumo}
            cancelando={cancelando}
            singular="documento"
            plural="documentos"
            enviados={ENVIADOS}
          >
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
            singular="documento"
            plural="documentos"
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
