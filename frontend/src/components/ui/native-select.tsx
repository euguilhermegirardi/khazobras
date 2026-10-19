import * as React from 'react';
import { cn } from '@/utils/cn';

// Base: shadcn/ui NativeSelect (<select> do navegador, acessível por padrão), no mesmo estilo do Input.
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        'h-8 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-[13px] text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
