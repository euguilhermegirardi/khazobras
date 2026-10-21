import * as React from 'react';
import { cn } from '@/utils/cn';

// Base: shadcn/ui Textarea, com o mesmo estilo do Input (raio 8px, borda fina, 13px, foco azul).
// Escrito à mão com o código do registro do shadcn (sem acesso à rede ao adicionar): ver PLAN-09.
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-[13px] text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
