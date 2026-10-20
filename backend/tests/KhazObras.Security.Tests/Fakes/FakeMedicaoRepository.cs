using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Security.Tests.Fakes;

public sealed class FakeMedicaoRepository : IMedicaoRepository
{
    private readonly List<Medicao> _medicoes = [];

    /// <summary>Etapas conhecidas por id, para o nome da etapa na lista resumida (opcional nos testes).</summary>
    public Dictionary<Guid, string> NomesDeEtapa { get; } = [];

    public Task<Medicao> CreateAsync(Medicao medicao)
    {
        // Espelha o UNIQUE (obra_id, numero) do banco.
        if (_medicoes.Any(m => m.ObraId == medicao.ObraId && m.Numero == medicao.Numero))
        {
            throw new MedicaoNumeroDuplicadoException();
        }

        _medicoes.Add(medicao);
        return Task.FromResult(medicao);
    }

    public Task<bool> ExistsNumeroAsync(Guid obraId, int numero) =>
        Task.FromResult(_medicoes.Any(m => m.ObraId == obraId && m.Numero == numero));

    public Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id);
        return Task.FromResult<Guid?>(medicao?.ObraId);
    }

    // Espelha o SQL: WHERE id = @Id AND obra_id = @ObraId
    public Task<Medicao?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id && m.ObraId == obraId);
        return Task.FromResult(medicao);
    }

    /// <summary>Atalho dos testes antigos (sem obra). O repositorio real so expoe a consulta presa a obra.</summary>
    public Task<Medicao?> GetByIdAsync(Guid id)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id);
        return Task.FromResult(medicao);
    }

    public Task<IReadOnlyList<Medicao>> GetByObraIdAsync(Guid obraId)
    {
        var medicoes = _medicoes
            .Where(m => m.ObraId == obraId)
            .OrderBy(m => m.Numero)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<Medicao>>(medicoes);
    }

    public Task<(IReadOnlyList<MedicaoResumo> Items, int TotalItems)> GetResumoPagedByObraIdAsync(
        Guid obraId, int pageIndex, int pageSize, MedicaoStatus? status)
    {
        var filtradas = _medicoes
            .Where(m => m.ObraId == obraId && (status is null || m.Status == status))
            .OrderByDescending(m => m.Numero)
            .ToList();

        var items = filtradas
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(m => new MedicaoResumo
            {
                Id = m.Id,
                ObraId = m.ObraId,
                EtapaId = m.EtapaId,
                EtapaNome = m.EtapaId is { } etapaId && NomesDeEtapa.TryGetValue(etapaId, out var nome) ? nome : null,
                Numero = m.Numero,
                Competencia = m.Competencia,
                ValorTotal = m.ValorTotal,
                Status = m.Status,
                QuantidadeItens = m.Itens.Count,
                CreatedAt = m.CreatedAt,
                ApprovedAt = m.ApprovedAt,
                NfIssuedAt = m.NfIssuedAt,
                NfNumber = m.NfNumber
            })
            .ToList()
            .AsReadOnly();

        return Task.FromResult<(IReadOnlyList<MedicaoResumo> Items, int TotalItems)>((items, filtradas.Count));
    }

    // Espelha o UPDATE condicional do repositorio real: so transiciona a partir de pending_approval, na obra certa.
    public Task<bool> ApproveAsync(Guid id, Guid obraId, Guid approvedByUserId, DateTime approvedAt)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id && m.ObraId == obraId);
        if (medicao is null || medicao.Status != MedicaoStatus.PendingApproval)
        {
            return Task.FromResult(false);
        }

        medicao.Status = MedicaoStatus.Approved;
        medicao.ApprovedAt = approvedAt;
        medicao.ApprovedByUserId = approvedByUserId;
        medicao.UpdatedAt = DateTime.UtcNow;
        return Task.FromResult(true);
    }

    /// <summary>Atalho dos testes antigos (sem obra).</summary>
    public Task<bool> ApproveAsync(Guid id, Guid approvedByUserId, DateTime approvedAt)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id);
        return medicao is null
            ? Task.FromResult(false)
            : ApproveAsync(id, medicao.ObraId, approvedByUserId, approvedAt);
    }

    // Espelha o UPDATE condicional do repositorio real: so transiciona a partir de approved, na obra certa.
    public Task<bool> IssueInvoiceAsync(Guid id, Guid obraId, string nfNumber, DateTime nfIssuedAt)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id && m.ObraId == obraId);
        if (medicao is null || medicao.Status != MedicaoStatus.Approved)
        {
            return Task.FromResult(false);
        }

        medicao.Status = MedicaoStatus.InvoiceIssued;
        medicao.NfNumber = nfNumber;
        medicao.NfIssuedAt = nfIssuedAt;
        medicao.UpdatedAt = DateTime.UtcNow;
        return Task.FromResult(true);
    }

    /// <summary>Atalho dos testes antigos (sem obra).</summary>
    public Task<bool> IssueInvoiceAsync(Guid id, string nfNumber, DateTime nfIssuedAt)
    {
        var medicao = _medicoes.FirstOrDefault(m => m.Id == id);
        return medicao is null
            ? Task.FromResult(false)
            : IssueInvoiceAsync(id, medicao.ObraId, nfNumber, nfIssuedAt);
    }
}
