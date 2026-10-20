using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Contratos;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public enum ContratoCreateStatus
{
    Created,
    ObraNaoEncontrada,
    NumeroDuplicado
}

public sealed record ContratoCreateResult(ContratoCreateStatus Status, ContratoResponse? Contrato);

public enum PagamentoCreateStatus
{
    Created,
    ContratoNaoEncontrado,
    MedicaoInvalida
}

public sealed record PagamentoCreateResult(PagamentoCreateStatus Status, PagamentoResponse? Pagamento);

public sealed class ContratoService
{
    private const string EntidadeContrato = "contrato";
    private const string EntidadePagamento = "pagamento";

    private readonly IContratoRepository _contratoRepository;
    private readonly IObraRepository _obraRepository;
    private readonly LogAuditoriaService _auditoria;

    public ContratoService(
        IContratoRepository contratoRepository,
        IObraRepository obraRepository,
        LogAuditoriaService auditoria)
    {
        _contratoRepository = contratoRepository;
        _obraRepository = obraRepository;
        _auditoria = auditoria;
    }

    /// <summary>
    /// Cria o contrato. O endpoint ja validou acesso a obra e o corpo. Aqui: obra existente e numero livre na obra
    /// (a UNIQUE do banco cobre a corrida).
    /// </summary>
    public async Task<ContratoCreateResult> CreateAsync(CreateContratoRequest request, Guid actorUserId)
    {
        if (await _obraRepository.GetByIdAsync(request.ObraId) is null)
        {
            return new ContratoCreateResult(ContratoCreateStatus.ObraNaoEncontrada, null);
        }

        var numero = request.Numero.Trim();

        if (await _contratoRepository.ExistsNumeroAsync(request.ObraId, numero))
        {
            return new ContratoCreateResult(ContratoCreateStatus.NumeroDuplicado, null);
        }

        var agora = DateTime.UtcNow;
        var contrato = new Contrato
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Numero = numero,
            ValorContratado = request.ValorContratado,
            DataAssinatura = request.DataAssinatura,
            CreatedAt = agora,
            UpdatedAt = agora
        };

        Contrato created;
        try
        {
            created = await _contratoRepository.CreateAsync(contrato);
        }
        catch (ContratoNumeroDuplicadoException)
        {
            return new ContratoCreateResult(ContratoCreateStatus.NumeroDuplicado, null);
        }

        // Auditoria financeira: ids, numero e valor contratado (leitura so do Master).
        var detalhes = JsonSerializer.Serialize(new
        {
            obraId = created.ObraId,
            numero = created.Numero,
            valorContratado = created.ValorContratado
        });
        await _auditoria.RegistrarAsync(actorUserId, "contrato_criado", EntidadeContrato, created.Id, detalhes);

        return new ContratoCreateResult(ContratoCreateStatus.Created, ToResponse(created));
    }

    /// <summary>Resolve so a obra do contrato (query enxuta); o endpoint valida o acesso a ela antes de ler/gravar.</summary>
    public Task<Guid?> ResolveContratoAsync(Guid id) => _contratoRepository.GetObraIdByIdAsync(id);

    public async Task<IReadOnlyList<ContratoResponse>> GetByObraIdAsync(Guid obraId)
    {
        var contratos = await _contratoRepository.GetByObraIdAsync(obraId);
        return contratos.Select(c => ToResponse(c)).ToList();
    }

    /// <summary>Contrato + pagamentos, presos a obra ja autorizada. Null = nao existe nessa obra.</summary>
    public async Task<ContratoDetalheResponse?> GetDetalheByIdAndObraAsync(Guid id, Guid obraId)
    {
        var contrato = await _contratoRepository.GetByIdAndObraAsync(id, obraId);
        if (contrato is null)
        {
            return null;
        }

        var pagamentos = await _contratoRepository.GetPagamentosAsync(id, obraId);
        return new ContratoDetalheResponse(
            contrato.Id, contrato.ObraId, contrato.Numero, contrato.ValorContratado, contrato.DataAssinatura,
            contrato.TotalPago, Saldo(contrato), contrato.CreatedAt, contrato.UpdatedAt,
            pagamentos.Select(p => ToResponse(p)).ToList());
    }

    /// <summary>
    /// Registra o pagamento no contrato da obra ja autorizada pelo endpoint. Se vier medicao, ela precisa ser da MESMA obra
    /// e estar com NF emitida (SPEC secao 8); a mensagem e unica para inexistente/outra obra/sem NF (nao revela outra obra).
    /// Nao ha limite de soma: pagamentos acima do valor contratado (adiantamento/aditivo) deixam o saldo negativo.
    /// </summary>
    public async Task<PagamentoCreateResult> CreatePagamentoAsync(
        Guid contratoId, Guid obraId, CreatePagamentoRequest request, Guid actorUserId)
    {
        if (request.ReferenteMedicaoId is { } medicaoId
            && !await _contratoRepository.MedicaoComNfNaObraAsync(medicaoId, obraId))
        {
            return new PagamentoCreateResult(PagamentoCreateStatus.MedicaoInvalida, null);
        }

        var forma = string.IsNullOrWhiteSpace(request.FormaPagamento) ? null : request.FormaPagamento.Trim();
        var pagamento = new Pagamento
        {
            Id = Guid.NewGuid(),
            ContratoId = contratoId,
            ReferenteMedicaoId = request.ReferenteMedicaoId,
            Valor = request.Valor,
            DataPagamento = request.DataPagamento,
            FormaPagamento = forma,
            CreatedAt = DateTime.UtcNow
        };

        // O INSERT repete as condicoes (contrato da obra, medicao da obra com NF) de forma atomica.
        var gravado = await _contratoRepository.CreatePagamentoAsync(pagamento, obraId);
        if (!gravado)
        {
            return request.ReferenteMedicaoId.HasValue
                ? new PagamentoCreateResult(PagamentoCreateStatus.MedicaoInvalida, null)
                : new PagamentoCreateResult(PagamentoCreateStatus.ContratoNaoEncontrado, null);
        }

        var detalhes = JsonSerializer.Serialize(new
        {
            obraId,
            contratoId,
            valor = pagamento.Valor,
            referenteMedicaoId = pagamento.ReferenteMedicaoId
        });
        await _auditoria.RegistrarAsync(actorUserId, "pagamento_registrado", EntidadePagamento, pagamento.Id, detalhes);

        return new PagamentoCreateResult(PagamentoCreateStatus.Created, ToResponse(pagamento));
    }

    /// <summary>Visao do CLIENTE da lista: sem storage_key, sem datas internas.</summary>
    public static ContratoClienteResponse ToClienteView(ContratoResponse c) => new(
        c.Id, c.ObraId, c.Numero, c.ValorContratado, c.DataAssinatura, c.TotalPago, c.SaldoAPagar);

    /// <summary>Visao do CLIENTE do detalhe: contrato reduzido + pagamentos reduzidos.</summary>
    public static ContratoDetalheClienteResponse ToClienteView(ContratoDetalheResponse c) => new(
        c.Id, c.ObraId, c.Numero, c.ValorContratado, c.DataAssinatura, c.TotalPago, c.SaldoAPagar,
        c.Pagamentos.Select(p => new PagamentoClienteResponse(
            p.Id, p.ReferenteMedicaoId, p.ReferenteMedicaoNumero, p.Valor, p.DataPagamento, p.FormaPagamento)).ToList());

    private static decimal Saldo(Contrato c) => c.ValorContratado - c.TotalPago;

    private static ContratoResponse ToResponse(Contrato c) => new(
        c.Id, c.ObraId, c.Numero, c.ValorContratado, c.DataAssinatura, c.TotalPago, Saldo(c), c.CreatedAt, c.UpdatedAt);

    private static PagamentoResponse ToResponse(Pagamento p) => new(
        p.Id, p.ContratoId, p.ReferenteMedicaoId, p.ReferenteMedicaoNumero, p.Valor, p.DataPagamento,
        p.FormaPagamento, p.CreatedAt);
}
