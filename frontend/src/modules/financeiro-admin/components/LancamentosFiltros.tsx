import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { CategoriaOpcao, CategoriaRequest, LancamentosFiltros as Filtros } from '@/interfaces/financeiroAdmin';
import { FILTROS_VAZIOS, VISIBILIDADE_OPCOES } from '../constants';

interface LancamentosFiltrosProps {
  filtros: Filtros;
  categorias: CategoriaOpcao[];
  onChange: (filtros: Filtros) => void;
}

/** Filtros da lista (visibilidade, categoria, competência). Qualquer mudança volta à página 1 (a página cuida disso). */
export const LancamentosFiltros = ({ filtros, categorias, onChange }: LancamentosFiltrosProps) => {
  // Constants derivadas
  const filtrando = filtros.visivelCliente !== '' || filtros.categoria !== '' || filtros.competencia !== '';

  // Functions
  const handleVisibilidade = (valor: string) =>
    onChange({ ...filtros, visivelCliente: valor as Filtros['visivelCliente'] });
  const handleCategoria = (valor: string) => onChange({ ...filtros, categoria: valor as '' | CategoriaRequest });
  const handleCompetencia = (valor: string) => onChange({ ...filtros, competencia: valor });
  const handleLimpar = () => onChange(FILTROS_VAZIOS);

  // Return
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-52">
        <FormField id="financeiro-filtro-visibilidade" label="Visibilidade">
          {(c) => (
            <NativeSelect {...c} value={filtros.visivelCliente} onChange={(e) => handleVisibilidade(e.target.value)}>
              {VISIBILIDADE_OPCOES.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      <div className="w-44">
        <FormField id="financeiro-filtro-categoria" label="Categoria">
          {(c) => (
            <NativeSelect {...c} value={filtros.categoria} onChange={(e) => handleCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((categoria) => (
                <option key={categoria.valor} value={categoria.valor}>
                  {categoria.rotulo}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      <div className="w-44">
        <FormField id="financeiro-filtro-competencia" label="Competência">
          {(c) => (
            <Input
              {...c}
              type="month"
              value={filtros.competencia}
              onChange={(e) => handleCompetencia(e.target.value)}
            />
          )}
        </FormField>
      </div>
      {filtrando && (
        <Button type="button" variant="outline" onClick={handleLimpar}>
          Limpar filtros
        </Button>
      )}
    </div>
  );
};
