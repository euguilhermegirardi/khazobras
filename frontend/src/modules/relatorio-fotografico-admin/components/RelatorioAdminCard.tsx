import { Camera, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { RelatorioFotografico } from '@/interfaces/relatorioFotografico';
import { formatTimestamp } from '@/utils/dates';
import { RELATORIO_TIPO_LABEL, tituloDoRelatorio } from '@/utils/relatorioFotografico';

interface RelatorioAdminCardProps {
  relatorio: RelatorioFotografico;
  /** Nome da etapa (relatórios `etapa`); sem ele, vale o título do relatório. */
  etapaNome?: string;
  /** Destino do "Gerenciar fotos". */
  detalhePath: string;
  onEdit: (relatorio: RelatorioFotografico) => void;
  onDelete: (relatorio: RelatorioFotografico) => void;
}

export const RelatorioAdminCard = ({
  relatorio,
  etapaNome,
  detalhePath,
  onEdit,
  onDelete,
}: RelatorioAdminCardProps) => {
  // Constants derivadas
  const titulo = tituloDoRelatorio(relatorio, etapaNome);
  const quantidade = relatorio.quantidadeFotos ?? relatorio.fotos.length;
  const detalhe = [
    titulo !== relatorio.titulo ? relatorio.titulo : null,
    `registrado em ${formatTimestamp(relatorio.createdAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  // Functions
  const handleEdit = () => onEdit(relatorio);
  const handleDelete = () => onDelete(relatorio);

  // Return
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="min-w-0">
          <h2 className="truncate" title={titulo}>
            {titulo}
          </h2>
        </CardTitle>
        <CardAction>
          <Badge variant="neutral">{RELATORIO_TIPO_LABEL[relatorio.tipo]}</Badge>
        </CardAction>
        <CardDescription className="min-w-0 truncate" title={detalhe}>
          {detalhe}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="flex items-center gap-1.5 text-[13px]">
          <Camera aria-hidden className="size-4 text-muted-foreground" />
          {quantidade === 1 ? '1 foto' : `${quantidade} fotos`}
        </p>
      </CardContent>
      <CardFooter className="mt-auto gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={detalhePath} aria-label={`Gerenciar fotos: ${titulo}`}>
            Gerenciar fotos
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Editar relatório: ${titulo}`}
          onClick={handleEdit}
        >
          <Pencil aria-hidden />
          Editar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto text-danger"
          aria-label={`Excluir relatório: ${titulo}`}
          onClick={handleDelete}
        >
          <Trash2 aria-hidden />
        </Button>
      </CardFooter>
    </Card>
  );
};
