import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SwitchProps extends Omit<React.ComponentProps<'button'>, 'onChange' | 'role' | 'type'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Gravando a mudança: trava o controle e mostra um indicador no botão. */
  loading?: boolean;
}

// Interruptor acessível (`role="switch"` + `aria-checked`) escrito à mão: `@radix-ui/react-switch` não está instalado
// e o registro do shadcn é bloqueado na nuvem. Trocar pelo `switch` do shadcn quando houver acesso (mesma API de uso).
// O nome acessível vem de `aria-label` (obrigatório na prática: o botão não tem texto).
function Switch({ className, checked, onCheckedChange, loading = false, disabled, ...props }: SwitchProps) {
  const handleClick = () => onCheckedChange(!checked);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={loading || undefined}
      data-slot="switch"
      disabled={disabled || loading}
      onClick={handleClick}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent p-0.5 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-success' : 'bg-neutral',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-4 items-center justify-center rounded-full bg-card text-foreground transition-transform',
          checked ? 'translate-x-3.5' : 'translate-x-0',
        )}
      >
        {loading && <Loader2 className="size-3 animate-spin" />}
      </span>
    </button>
  );
}

export { Switch };
