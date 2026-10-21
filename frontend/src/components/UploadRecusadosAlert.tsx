import { Alert, AlertDescription } from '@/components/ui/alert';
import { plural, type UploadRecusado } from '@/utils/uploadFila';

interface UploadRecusadosAlertProps {
  recusados: UploadRecusado[];
}

/** Arquivos que nem entraram na fila, cada um com o motivo. O nome é texto, nunca HTML. */
export const UploadRecusadosAlert = ({ recusados }: UploadRecusadosAlertProps) => (
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
);
