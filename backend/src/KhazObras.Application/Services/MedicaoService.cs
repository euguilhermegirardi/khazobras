using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Medicoes;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Application.Services;

public sealed class MedicaoService
{
    private readonly IMedicaoRepository _medicaoRepository;

    public MedicaoService(IMedicaoRepository medicaoRepository)
    {
        _medicaoRepository = medicaoRepository;
    }

    public async Task<MedicaoResponse> CreateAsync(CreateMedicaoRequest request)
    {
        var itens = request.Itens.Select(i => new MedicaoItem
        {
            Id = Guid.NewGuid(),
            Tipo = ParseItemTipo(i.Tipo),
            Descricao = i.Descricao,
            Quantidade = i.Quantidade,
            ValorUnitario = i.ValorUnitario,
            ValorTotal = i.Quantidade * i.ValorUnitario
        }).ToList();

        var medicao = new Medicao
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            EtapaId = request.EtapaId,
            Numero = request.Numero,
            Competencia = request.Competencia,
            ValorTotal = itens.Sum(i => i.ValorTotal),
            Status = MedicaoStatus.PendingApproval,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Itens = itens
        };

        var created = await _medicaoRepository.CreateAsync(medicao);
        
        return ToResponse(created);
    }

    public async Task<MedicaoResponse?> GetByIdAsync(Guid id)
    {
        var medicao = await _medicaoRepository.GetByIdAsync(id);
        return medicao is null ? null : ToResponse(medicao);
    }

    public async Task<IReadOnlyList<MedicaoResponse>> GetByObraIdAsync(Guid obraId)
    {
        var medicoes = await _medicaoRepository.GetByObraIdAsync(obraId);
        return medicoes.Select(ToResponse).ToList();
    }

    public async Task<MedicaoResponse> ApproveAsync(Guid id, Guid approvedByUserId)
    {
        var medicao = await _medicaoRepository.GetByIdAsync(id)
            ?? throw new InvalidOperationException("Medicao nao encontrada.");

        if (medicao.Status != MedicaoStatus.PendingApproval)
        {
            throw new InvalidOperationException(
                $"Medicao nao pode ser aprovada no status atual: {medicao.Status}.");
        }

        var approvedAt = DateTime.UtcNow;
        await _medicaoRepository.ApproveAsync(id, approvedByUserId, approvedAt);

        medicao.Status = MedicaoStatus.Approved;
        medicao.ApprovedAt = approvedAt;
        medicao.ApprovedByUserId = approvedByUserId;

        return ToResponse(medicao);
    }

    public async Task<MedicaoResponse> IssueInvoiceAsync(Guid id, string nfNumber)
    {
        var medicao = await _medicaoRepository.GetByIdAsync(id)
            ?? throw new InvalidOperationException("Medicao nao encontrada.");

        if (medicao.Status != MedicaoStatus.Approved)
        {
            throw new InvalidOperationException(
                $"NF so pode ser emitida para medicao aprovada. Status atual: {medicao.Status}.");
        }

        var nfIssuedAt = DateTime.UtcNow;
        await _medicaoRepository.IssueInvoiceAsync(id, nfNumber, nfIssuedAt);

        medicao.Status = MedicaoStatus.InvoiceIssued;
        medicao.NfNumber = nfNumber;
        medicao.NfIssuedAt = nfIssuedAt;

        return ToResponse(medicao);
    }

    private static ItemTipo ParseItemTipo(string tipo) => tipo.ToLowerInvariant() switch
    {
        "mao_de_obra" => ItemTipo.MaoDeObra,
        "material" => ItemTipo.Material,
        "equipamento" => ItemTipo.Equipamento,
        _ => throw new ArgumentException($"Tipo de item invalido: {tipo}")
    };

    private static MedicaoResponse ToResponse(Medicao m) => new(
        m.Id, m.ObraId, m.EtapaId, m.Numero, m.Competencia, m.ValorTotal, m.Status.ToString(),
        m.ApprovedAt, m.ApprovedByUserId, m.NfNumber, m.NfIssuedAt, m.CreatedAt,
        m.Itens.Select(i => new MedicaoItemResponse(
            i.Id, i.Tipo.ToString(), i.Descricao, i.Quantidade, i.ValorUnitario, i.ValorTotal)).ToList());
}