import type { ReactNode } from 'react';

interface ControlProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

interface FormFieldProps {
  id: string;
  label: string;
  /** Mensagem de erro do campo (validação local ou do servidor). */
  error?: string;
  /** Texto de ajuda sob o campo (some quando há erro). */
  hint?: string;
  /** Recebe os atributos de acessibilidade para espalhar no controle (`<Input {...control} />`). */
  children: (control: ControlProps) => ReactNode;
}

/** Rótulo (11px) + controle + mensagem, do jeito do `.form-group` do protótipo. */
export const FormField = ({ id, label, error, hint, children }: FormFieldProps) => {
  // Constants derivadas
  const messageId = `${id}-message`;
  const message = error ?? hint;

  // Return
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': message ? messageId : undefined })}
      {message && (
        <p id={messageId} className={error ? 'text-[11px] text-danger' : 'text-[11px] text-muted-foreground'}>
          {message}
        </p>
      )}
    </div>
  );
};
