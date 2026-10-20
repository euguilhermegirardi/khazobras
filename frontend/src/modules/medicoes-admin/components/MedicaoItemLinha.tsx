import { Trash2 } from 'lucide-react';
import type { FieldError, FieldErrorsImpl, Merge, UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { formatCurrency } from '@/utils/format';
import { ITEM_GRID, ITEM_TIPO_OPCOES } from '../constants';
import type { MedicaoFormValues, MedicaoItemCampo, MedicaoItemFormValues } from '../medicaoForm';

interface MedicaoItemLinhaProps {
  /** Posição na lista (0 = primeiro item). */
  index: number;
  register: UseFormRegister<MedicaoFormValues>;
  errors: Merge<FieldError, FieldErrorsImpl<MedicaoItemFormValues>> | undefined;
  /** Total do item, calculado só para exibir (o servidor recalcula). */
  total: number;
  canRemove: boolean;
  onRemove: () => void;
}

const CAMPOS_COM_ROTULO: { campo: MedicaoItemCampo; rotulo: string }[] = [
  { campo: 'tipo', rotulo: 'Tipo' },
  { campo: 'descricao', rotulo: 'Descrição' },
  { campo: 'quantidade', rotulo: 'Quantidade' },
  { campo: 'valorUnitario', rotulo: 'Valor unitário' },
];

/** Uma linha de item: tipo, descrição, quantidade, valor unitário, total (só leitura) e remover. */
export const MedicaoItemLinha = ({ index, register, errors, total, canRemove, onRemove }: MedicaoItemLinhaProps) => {
  // Constants derivadas
  const numero = index + 1;
  const errorId = `item-${index}-erros`;
  const mensagens = CAMPOS_COM_ROTULO.flatMap(({ campo, rotulo }) => {
    const message = errors?.[campo]?.message;
    return message ? [`${rotulo}: ${message}`] : [];
  });
  const invalid = (campo: MedicaoItemCampo) => Boolean(errors?.[campo]);
  const describedBy = mensagens.length > 0 ? errorId : undefined;

  // Return
  return (
    <li className="flex flex-col gap-1">
      <div className={ITEM_GRID}>
        <NativeSelect
          aria-label={`Tipo do item ${numero}`}
          aria-invalid={invalid('tipo')}
          aria-describedby={describedBy}
          {...register(`itens.${index}.tipo`)}
        >
          {ITEM_TIPO_OPCOES.map((opcao) => (
            <option key={opcao.value} value={opcao.value}>
              {opcao.label}
            </option>
          ))}
        </NativeSelect>
        <Input
          aria-label={`Descrição do item ${numero}`}
          aria-invalid={invalid('descricao')}
          aria-describedby={describedBy}
          maxLength={255}
          autoComplete="off"
          {...register(`itens.${index}.descricao`)}
        />
        <Input
          aria-label={`Quantidade do item ${numero}`}
          aria-invalid={invalid('quantidade')}
          aria-describedby={describedBy}
          inputMode="decimal"
          autoComplete="off"
          className="text-right"
          {...register(`itens.${index}.quantidade`)}
        />
        <Input
          aria-label={`Valor unitário do item ${numero}`}
          aria-invalid={invalid('valorUnitario')}
          aria-describedby={describedBy}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          className="text-right"
          {...register(`itens.${index}.valorUnitario`)}
        />
        <span className="text-right text-[13px] font-medium tabular-nums">
          <span className="sr-only">Total do item {numero}: </span>
          {formatCurrency(total)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={`Remover item ${numero}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {mensagens.length > 0 && (
        <ul id={errorId} className="text-[11px] text-danger">
          {mensagens.map((mensagem) => (
            <li key={mensagem}>{mensagem}</li>
          ))}
        </ul>
      )}
    </li>
  );
};
