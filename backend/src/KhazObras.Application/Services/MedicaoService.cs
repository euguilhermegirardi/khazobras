using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Common;
using KhazObras.Application.Dtos.Medicoes;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Application.Services;

public enum MedicaoCreateStatus
{
    Created,
    ObraNaoEncontrada,
    EtapaInvalida,
    NumeroDuplicado
}

public sealed record MedicaoCreateResult(MedicaoCreateStatus Status, MedicaoResponse? Medicao);

public sealed class MedicaoService
{
    private const string EntidadeAuditoria = "medicao";

    private readonly IMedicaoRepository _medicaoRepository;
    private readonly IEtapaRepository _etapaRepository;
    private readonly IObraRepository _obraRepository;
    private readonly LogAuditoriaService _auditoria;

    public MedicaoService(
        IMedicaoRepository medicaoRepository,
        IEtapaRepository etapaRepository,
        IObraRepository obraRepository,
        LogAuditoriaService auditoria)
    {
        _medicaoRepository = medicaoRepository;
        _etapaRepository = etapaRepository;
        _obraRepository = obraRepository;
        _auditoria = auditoria;
    }

    /// <summary>
    /// Cria a medicao (sempre em pending_approval). O endpoint ja validou acesso a obra e o corpo.
    /// Aqui conferem-se as referencias: obra existente, etapa DA MESMA obra e numero livre na obra.
    /// O total de cada item e da medicao e calculado no servidor (nunca vem do cliente).
    /// </summary>
    public async Task<MedicaoCreateResult> CreateAsync(CreateMedicaoRequest request, Guid actorUserId)
    {
        if (await _obraRepository.GetByIdAsync(request.ObraId) is null)
        {
            return new MedicaoCreateResult(MedicaoCreateStatus.ObraNaoEncontrada, null);
        }

        if (request.EtapaId is { } etapaId
            && await _etapaRepository.GetByIdAndObraAsync(etapaId, request.ObraId) is null)
        {
            return new MedicaoCreateResult(MedicaoCreateStatus.EtapaInvalida, null);
        }

        if (await _medicaoRepository.ExistsNumeroAsync(request.ObraId, request.Numero))
        {
            return new MedicaoCreateResult(MedicaoCreateStatus.NumeroDuplicado, null);
        }

        var itens = request.Itens.Select(i => new MedicaoItem
        {
            Id = Guid.NewGuid(),
            Tipo = ParseItemTipo(i.Tipo),
            Descricao = i.Descricao.Trim(),
            Quantidade = i.Quantidade,
            ValorUnitario = i.ValorUnitario,
            ValorTotal = TotalDoItem(i.Quantidade, i.ValorUnitario)
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

        Medicao created;
        try
        {
            created = await _medicaoRepository.CreateAsync(medicao);
        }
        catch (MedicaoNumeroDuplicadoException)
        {
            return new MedicaoCreateResult(MedicaoCreateStatus.NumeroDuplicado, null);
        }

        await RegistrarAuditoriaAsync(actorUserId, "medicao_criada", created, statusAnterior: null);

        return new MedicaoCreateResult(MedicaoCreateStatus.Created, ToResponse(created));
    }

    /// <summary>Resolve so a obra da medicao (query enxuta); o endpoint valida o acesso a ela antes de ler/alterar.</summary>
    public Task<Guid?> ResolveMedicaoAsync(Guid id) => _medicaoRepository.GetObraIdByIdAsync(id);

    /// <summary>Devolve null se a medicao nao existir ou nao pertencer a obra informada (a mesma que foi autorizada).</summary>
    public async Task<MedicaoResponse?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var medicao = await _medicaoRepository.GetByIdAndObraAsync(id, obraId);
        return medicao is null ? null : ToResponse(medicao);
    }

    public async Task<IReadOnlyList<MedicaoResponse>> GetByObraIdAsync(Guid obraId)
    {
        var medicoes = await _medicaoRepository.GetByObraIdAsync(obraId);
        return medicoes.Select(ToResponse).ToList();
    }

    public async Task<PagedResult<MedicaoResumoResponse>> GetResumoPagedByObraIdAsync(
        Guid obraId, int pageIndex, int pageSize, MedicaoStatus? status)
    {
        var (items, totalItems) = await _medicaoRepository.GetResumoPagedByObraIdAsync(obraId, pageIndex, pageSize, status);
        var responses = items.Select(m => new MedicaoResumoResponse(
            m.Id, m.ObraId, m.EtapaId, m.EtapaNome, m.Numero, m.Competencia, m.ValorTotal, m.Status.ToString(),
            m.QuantidadeItens, m.CreatedAt, m.ApprovedAt, m.NfIssuedAt, m.NfNumber)).ToList();
        return new PagedResult<MedicaoResumoResponse>(totalItems, pageIndex, pageSize, responses);
    }

    /// <summary>Filtro de status da lista admin: snake_case, como nas requisicoes. Vazio = sem filtro.</summary>
    public static bool TryParseStatusFiltro(string? valor, out MedicaoStatus? status)
    {
        status = null;
        if (string.IsNullOrWhiteSpace(valor))
        {
            return true;
        }

        switch (valor.Trim().ToLowerInvariant())
        {
            case "pending_approval":
                status = MedicaoStatus.PendingApproval;
                return true;
            case "approved":
                status = MedicaoStatus.Approved;
                return true;
            case "invoice_issued":
                status = MedicaoStatus.InvoiceIssued;
                return true;
            default:
                return false;
        }
    }

    /// <summary>
    /// Aprova a medicao da obra ja autorizada pelo endpoint. Null = nao existe nessa obra.
    /// <see cref="InvalidOperationException"/> = transicao invalida (o endpoint responde 409).
    /// </summary>
    public async Task<MedicaoResponse?> ApproveAsync(Guid id, Guid obraId, Guid approvedByUserId)
    {
        var medicao = await _medicaoRepository.GetByIdAndObraAsync(id, obraId);
        if (medicao is null)
        {
            return null;
        }

        if (medicao.Status != MedicaoStatus.PendingApproval)
        {
            throw new InvalidOperationException(
                $"Medicao nao pode ser aprovada no status atual: {medicao.Status}.");
        }

        var approvedAt = DateTime.UtcNow;
        // O UPDATE confere o status e a obra de novo (atomico): perde a corrida contra aprovacao/NF concorrente.
        var updated = await _medicaoRepository.ApproveAsync(id, obraId, approvedByUserId, approvedAt);
        if (!updated)
        {
            throw new InvalidOperationException("Medicao nao esta mais pendente de aprovacao.");
        }

        medicao.Status = MedicaoStatus.Approved;
        medicao.ApprovedAt = approvedAt;
        medicao.ApprovedByUserId = approvedByUserId;

        await RegistrarAuditoriaAsync(approvedByUserId, "medicao_aprovada", medicao, MedicaoStatus.PendingApproval);

        return ToResponse(medicao);
    }

    /// <summary>
    /// Emite a NF da medicao da obra ja autorizada pelo endpoint (so a partir de approved). Null = nao existe nessa obra.
    /// <see cref="InvalidOperationException"/> = transicao invalida (o endpoint responde 409).
    /// </summary>
    public async Task<MedicaoResponse?> IssueInvoiceAsync(Guid id, Guid obraId, string nfNumber, Guid actorUserId)
    {
        var medicao = await _medicaoRepository.GetByIdAndObraAsync(id, obraId);
        if (medicao is null)
        {
            return null;
        }

        if (medicao.Status != MedicaoStatus.Approved)
        {
            throw new InvalidOperationException(
                $"NF so pode ser emitida para medicao aprovada. Status atual: {medicao.Status}.");
        }

        var numero = nfNumber.Trim();
        var nfIssuedAt = DateTime.UtcNow;
        var updated = await _medicaoRepository.IssueInvoiceAsync(id, obraId, numero, nfIssuedAt);
        if (!updated)
        {
            throw new InvalidOperationException("Medicao nao esta mais aprovada para emissao de NF.");
        }

        medicao.Status = MedicaoStatus.InvoiceIssued;
        medicao.NfNumber = numero;
        medicao.NfIssuedAt = nfIssuedAt;

        await RegistrarAuditoriaAsync(actorUserId, "medicao_nf_emitida", medicao, MedicaoStatus.Approved);

        return ToResponse(medicao);
    }

    /// <summary>Visao do CLIENTE: mesma medicao sem o id interno de quem aprovou.</summary>
    public static MedicaoClienteResponse ToClienteView(MedicaoResponse m) => new(
        m.Id, m.ObraId, m.EtapaId, m.Numero, m.Competencia, m.ValorTotal, m.Status,
        m.ApprovedAt, m.NfNumber, m.NfIssuedAt, m.CreatedAt, m.Itens);

    /// <summary>
    /// SPEC secao 8: toda mudanca de status gera registro em log_auditoria. O payload leva so ids e status
    /// (sem valores, descricoes nem numero de NF). Roda DEPOIS do UPDATE; se o registro falhar a excecao sobe (500 com
    /// requestId nos logs) em vez de a falha ficar silenciosa.
    /// </summary>
    private Task RegistrarAuditoriaAsync(Guid actorUserId, string acao, Medicao medicao, MedicaoStatus? statusAnterior)
    {
        var detalhes = JsonSerializer.Serialize(new
        {
            obraId = medicao.ObraId,
            numero = medicao.Numero,
            statusAnterior = statusAnterior is null ? null : ToDbStatus(statusAnterior.Value),
            statusNovo = ToDbStatus(medicao.Status)
        });

        return _auditoria.RegistrarAsync(actorUserId, acao, EntidadeAuditoria, medicao.Id, detalhes);
    }

    private static decimal TotalDoItem(decimal quantidade, decimal valorUnitario) =>
        Math.Round(quantidade * valorUnitario, 2, MidpointRounding.AwayFromZero);

    private static string ToDbStatus(MedicaoStatus status) => status switch
    {
        MedicaoStatus.PendingApproval => "pending_approval",
        MedicaoStatus.Approved => "approved",
        MedicaoStatus.InvoiceIssued => "invoice_issued",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

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
