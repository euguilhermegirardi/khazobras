import { Upload } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { FormField } from '@/components/FormField';
import { ProgressBar } from '@/components/ProgressBar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/cn';
import { FOTO_ACCEPT, FOTO_DESCRICAO_MAX, FOTO_EXTENSOES_TEXTO, FOTO_MAX_POR_RELATORIO } from '@/utils/foto';
import { dataMaximaFoto, validarLote } from '../fotoForm';
import { resumoFila } from '../uploadFila';
import { useUploadFila } from '../useUploadFila';
import { UploadItemLinha } from './UploadItemLinha';

interface FotosUploadSecaoProps {
  obraId: string;
  relatorioId: string;
  /** Fotos que o relatório já tem (conta para o limite de 100). */
  jaNoRelatorio: number;
}

const plural = (n: number, singular: string, pluralTxt: string) => `${n} ${n === 1 ? singular : pluralTxt}`;

/**
 * Envio de fotos em lote: escolher (vários) ou soltar arquivos, descrição e data opcionais para o lote, fila sequencial
 * com status por arquivo, progresso, "tentar de novo" nas falhas e cancelar.
 */
export const FotosUploadSecao = ({ obraId, relatorioId, jaNoRelatorio }: FotosUploadSecaoProps) => {
  // Estados
  const [descricao, setDescricao] = useState('');
  const [dataFoto, setDataFoto] = useState('');
  const [errosLote, setErrosLote] = useState<{ descricao?: string; dataFoto?: string }>({});
  const [arrastando, setArrastando] = useState(false);
  // Hoje fixado na montagem: a data da foto vai até amanhã.
  const [hoje] = useState(() => new Date());
  // Hooks
  const upload = useUploadFila({ obraId, relatorioId, jaNoRelatorio });

  // Constants derivadas
  const { fila, rodando, cancelando, recusados, interrompida } = upload;
  const resumo = resumoFila(fila);
  const emAndamento = resumo.pendentes + resumo.enviando;
  const relatorioCheio = jaNoRelatorio + emAndamento >= FOTO_MAX_POR_RELATORIO;
  const tomProgresso = resumo.falhas > 0 ? 'warning' : resumo.enviadas === resumo.total ? 'success' : 'info';
  const resumoTexto = [
    `${resumo.enviadas} de ${plural(resumo.total, 'foto', 'fotos')} ${resumo.enviadas === 1 ? 'enviada' : 'enviadas'}`,
    resumo.falhas > 0 ? plural(resumo.falhas, 'com erro', 'com erro') : null,
    resumo.canceladas > 0 ? plural(resumo.canceladas, 'cancelada', 'canceladas') : null,
    resumo.pendentes > 0 ? plural(resumo.pendentes, 'pendente', 'pendentes') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Functions
  const adicionar = (arquivos: File[]) => {
    if (arquivos.length > 0) upload.adicionar(arquivos);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const arquivos = Array.from(input.files ?? []);
    // Limpa o campo: escolher o mesmo arquivo de novo (depois de tirá-lo da lista) dispara o evento outra vez.
    input.value = '';
    adicionar(arquivos);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setArrastando(true);
  };

  const handleDragLeave = () => setArrastando(false);

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setArrastando(false);
    if (relatorioCheio) return;
    adicionar(Array.from(e.dataTransfer.files));
  };

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
        <div>
          <input
            id="upload-fotos"
            type="file"
            multiple
            accept={FOTO_ACCEPT}
            disabled={relatorioCheio}
            aria-describedby="upload-fotos-ajuda"
            className="peer sr-only"
            onChange={handleChange}
          />
          {/* Soltar arquivos é só um atalho: o teclado e o leitor de tela usam o input de arquivo desta mesma label. */}
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <label
            htmlFor="upload-fotos"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed bg-card p-5 text-center text-[13px] text-muted-foreground outline-none hover:bg-accent peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
              arrastando && 'border-primary bg-info-soft text-info-soft-foreground',
            )}
          >
            <Upload aria-hidden className="size-6" />
            <span>
              {relatorioCheio
                ? 'Limite de 100 fotos atingido: remova uma foto para enviar outra.'
                : 'Arraste as fotos aqui ou clique para selecionar (várias de uma vez)'}
            </span>
          </label>
          <p id="upload-fotos-ajuda" className="mt-1.5 text-[11px] text-muted-foreground">
            Até 10 MB por foto. Tipos: {FOTO_EXTENSOES_TEXTO}. O relatório tem {jaNoRelatorio} de{' '}
            {FOTO_MAX_POR_RELATORIO} fotos.
          </p>
        </div>

        {recusados.length > 0 && (
          <Alert variant="warning">
            <AlertDescription>
              <p className="font-medium">
                {plural(recusados.length, 'arquivo não foi adicionado', 'arquivos não foram adicionados')}:
              </p>
              <ul className="mt-1 list-disc pl-4">
                {recusados.map((r, indice) => (
                  <li key={`${r.nome}-${indice}`} className="break-all">
                    {r.nome}: {r.motivo}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

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
          <div className="flex flex-col gap-2.5">
            <ProgressBar label="Progresso do envio" value={resumo.progresso} tone={tomProgresso} />
            <p role="status" aria-live="polite" className="text-[13px]">
              {resumoTexto}
              {cancelando && ' · cancelando: aguardando o envio atual terminar'}
            </p>
            <div
              role="region"
              aria-label="Fila de envio"
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- área rolável precisa de foco para rolar pelo teclado
              tabIndex={0}
              className="max-h-72 overflow-y-auto rounded-md border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ul>
                {fila.map((item) => (
                  <UploadItemLinha key={item.id} item={item} onRemove={upload.remover} />
                ))}
              </ul>
            </div>
          </div>
        )}

        {fila.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={rodando || resumo.pendentes === 0} onClick={handleSend}>
              {rodando ? 'Enviando…' : `Enviar ${plural(resumo.pendentes, 'foto', 'fotos')}`}
            </Button>
            {(rodando || resumo.pendentes > 0) && (
              <Button type="button" variant="outline" disabled={cancelando} onClick={upload.cancelar}>
                Cancelar fila
              </Button>
            )}
            {!rodando && resumo.falhas > 0 && (
              <Button type="button" variant="outline" onClick={handleRetry}>
                Tentar de novo ({resumo.falhas})
              </Button>
            )}
            {!rodando && resumo.enviadas + resumo.falhas + resumo.canceladas > 0 && (
              <Button type="button" variant="ghost" className="ml-auto" onClick={upload.limpar}>
                Limpar finalizadas
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
