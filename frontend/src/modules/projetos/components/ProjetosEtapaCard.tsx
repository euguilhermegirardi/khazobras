import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ProjetoAcao } from '../hooks'
import type { ProjetoDocumento } from '@/interfaces/projeto'
import { ProjetoLinha } from './ProjetoLinha'

interface ProjetosEtapaCardProps {
  titulo: string
  projetos: ProjetoDocumento[]
  ocupadoId: string | null
  onAcao: (projeto: ProjetoDocumento, acao: ProjetoAcao) => void
}

export const ProjetosEtapaCard = ({ titulo, projetos, ocupadoId, onAcao }: ProjetosEtapaCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle>
        <h2>{titulo}</h2>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40%]">Nome</TableHead>
            <TableHead className="w-[20%]">Tipo</TableHead>
            <TableHead className="w-[15%]">Enviado em</TableHead>
            <TableHead className="w-[25%] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projetos.map((projeto) => (
            <ProjetoLinha key={projeto.id} projeto={projeto} ocupadoId={ocupadoId} onAcao={onAcao} />
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
)
