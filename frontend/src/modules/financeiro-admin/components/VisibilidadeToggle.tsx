import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface VisibilidadeToggleProps {
  /** Descrição do lançamento: compõe o nome acessível do interruptor. */
  descricao: string;
  liberado: boolean;
  /** Este lançamento está gravando a mudança agora. */
  gravando: boolean;
  /** Outra linha está gravando: trava o interruptor (um PATCH por vez). */
  travado: boolean;
  onChange: (visivelCliente: boolean) => void;
}

/** Badge "Liberado"/"Oculto" + interruptor. Altura fixa (h-7) para a linha não mudar de tamanho. */
export const VisibilidadeToggle = ({ descricao, liberado, gravando, travado, onChange }: VisibilidadeToggleProps) => (
  <div className="flex h-7 items-center gap-2">
    <Badge variant={liberado ? 'success' : 'neutral'}>{liberado ? 'Liberado' : 'Oculto'}</Badge>
    <Switch
      checked={liberado}
      loading={gravando}
      disabled={travado}
      onCheckedChange={onChange}
      aria-label={`Visível ao cliente: ${descricao}`}
      title={liberado ? 'Ocultar do cliente' : 'Liberar ao cliente'}
    />
  </div>
);
