import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageSection } from '@/components/PageSection';
import { Button } from '@/components/ui/button';
import type { RelatorioMensalAdmin } from '@/interfaces/relatorioMensal';
import { RelatorioEditor } from '../components/RelatorioEditor';
import type { RelatorioNavState } from '../types';

export const RelatorioAdminNovoPage = () => {
  // Hooks
  const { obraId = '' } = useParams();
  const navigate = useNavigate();

  // Constants derivadas
  const listaPath = `/admin/obras/${obraId}/relatorio-ao-cliente`;

  // Functions
  const handleCancel = () => navigate(listaPath);

  const handleSaved = (mensagem: string, salvo: RelatorioMensalAdmin) => {
    const state: RelatorioNavState = { feedback: mensagem };
    navigate(`${listaPath}/${salvo.id}`, { state });
  };

  const voltar = (
    <Button asChild variant="outline">
      <Link to={listaPath}>
        <ArrowLeft aria-hidden />
        Relatórios
      </Link>
    </Button>
  );

  // Return
  return (
    <PageSection
      title="Novo relatório ao cliente"
      description="Escreva o texto do mês. Ele fica em rascunho até você publicar; o cliente só vê depois."
      actions={voltar}
    >
      <RelatorioEditor obraId={obraId} relatorio={null} onCancel={handleCancel} onSaved={handleSaved} />
    </PageSection>
  );
};
