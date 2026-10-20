using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IContratoRepository
{
    /// <summary>Cria o contrato. Lanca <see cref="ContratoNumeroDuplicadoException"/> se (obra, numero) ja existir.</summary>
    Task<Contrato> CreateAsync(Contrato contrato);

    Task<bool> ExistsNumeroAsync(Guid obraId, string numero);

    /// <summary>Resolve so o obra_id do contrato (query enxuta); o endpoint valida o acesso a ela antes de ler/gravar.</summary>
    Task<Guid?> GetObraIdByIdAsync(Guid id);

    /// <summary>Contrato com TotalPago (SUM no SQL), preso a obra (WHERE id AND obra_id). Outra obra = null.</summary>
    Task<Contrato?> GetByIdAndObraAsync(Guid id, Guid obraId);

    /// <summary>Contratos da obra com TotalPago, numa consulta so (JOIN + GROUP BY, sem N+1). Mais antigo primeiro.</summary>
    Task<IReadOnlyList<Contrato>> GetByObraIdAsync(Guid obraId);

    /// <summary>Pagamentos do contrato (preso a obra via JOIN), data do pagamento mais recente primeiro.</summary>
    Task<IReadOnlyList<Pagamento>> GetPagamentosAsync(Guid contratoId, Guid obraId);

    /// <summary>True se a medicao existe NESSA obra e esta com status invoice_issued (SPEC secao 8: pagamento apos NF).</summary>
    Task<bool> MedicaoComNfNaObraAsync(Guid medicaoId, Guid obraId);

    /// <summary>
    /// Grava o pagamento so se o contrato for da obra e, quando houver medicao, ela for da mesma obra e estiver com NF
    /// emitida (tudo no mesmo INSERT ... SELECT). Retorna false se nenhuma linha foi gravada.
    /// </summary>
    Task<bool> CreatePagamentoAsync(Pagamento pagamento, Guid obraId);
}
