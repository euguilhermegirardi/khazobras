import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RelatorioFotografico } from '@/interfaces/relatorioFotografico';
import { formatTimestamp } from '@/utils/dates';
import { ordenarFotos, tituloDoRelatorio } from '@/utils/relatorioFotografico';
import { FotoThumb } from './FotoThumb';

interface RelatorioFotograficoCardProps {
  relatorio: RelatorioFotografico;
  /** Nome da etapa (relatórios `etapa`); sem ele, vale o título do relatório. */
  etapaNome?: string;
}

export const RelatorioFotograficoCard = ({ relatorio, etapaNome }: RelatorioFotograficoCardProps) => {
  // Constants derivadas
  const titulo = tituloDoRelatorio(relatorio, etapaNome);
  const fotos = ordenarFotos(relatorio.fotos);

  // Return
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{titulo}</h2>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {titulo !== relatorio.titulo && `${relatorio.titulo} · `}
          Registrado em {formatTimestamp(relatorio.createdAt)}
        </p>
      </CardHeader>
      <CardContent>
        {fotos.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Este relatório ainda não tem fotos.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
            {fotos.map((foto) => (
              <FotoThumb key={foto.id} foto={foto} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
