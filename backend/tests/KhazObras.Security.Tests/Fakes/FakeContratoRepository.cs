using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Security.Tests.Fakes;

/// <summary>
/// Repositorio de contratos em memoria. Espelha o SQL real: tudo preso a obra, TotalPago = soma dos pagamentos,
/// UNIQUE (obra_id, numero) e o INSERT condicional do pagamento (contrato da obra + medicao da mesma obra com NF).
/// </summary>
public sealed class FakeContratoRepository : IContratoRepository
{
    private readonly FakeMedicaoRepository _medicoes;
    private readonly List<Contrato> _contratos = [];
    private readonly List<Pagamento> _pagamentos = [];

    public FakeContratoRepository(FakeMedicaoRepository medicoes) => _medicoes = medicoes;

    public IReadOnlyList<Pagamento> Pagamentos => _pagamentos;

    public IReadOnlyList<Contrato> Contratos => _contratos;

    /// <summary>Atalho dos testes: grava um pagamento direto (sem as regras do INSERT condicional).</summary>
    public void SemearPagamento(Pagamento pagamento) => _pagamentos.Add(pagamento);

    public Task<Contrato> CreateAsync(Contrato contrato)
    {
        // Espelha o UNIQUE (obra_id, numero) do banco.
        if (_contratos.Any(c => c.ObraId == contrato.ObraId && c.Numero == contrato.Numero))
        {
            throw new ContratoNumeroDuplicadoException();
        }

        _contratos.Add(contrato);
        return Task.FromResult(contrato);
    }

    /// <summary>Faz a checagem previa de numero dizer "livre", para provar que a UNIQUE do banco tambem vira 409 (corrida).</summary>
    public bool SimularCorridaNoNumero { get; set; }

    public Task<bool> ExistsNumeroAsync(Guid obraId, string numero) =>
        Task.FromResult(!SimularCorridaNoNumero && _contratos.Any(c => c.ObraId == obraId && c.Numero == numero));

    public Task<Guid?> GetObraIdByIdAsync(Guid id) =>
        Task.FromResult<Guid?>(_contratos.FirstOrDefault(c => c.Id == id)?.ObraId);

    // Espelha o SQL: WHERE c.id = @Id AND c.obra_id = @ObraId, com SUM(pagamentos).
    public Task<Contrato?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var contrato = _contratos.FirstOrDefault(c => c.Id == id && c.ObraId == obraId);
        return Task.FromResult(contrato is null ? null : ComTotal(contrato));
    }

    public Task<IReadOnlyList<Contrato>> GetByObraIdAsync(Guid obraId)
    {
        var lista = _contratos
            .Where(c => c.ObraId == obraId)
            .OrderBy(c => c.CreatedAt)
            .ThenBy(c => c.Numero)
            .Select(ComTotal)
            .ToList();

        return Task.FromResult<IReadOnlyList<Contrato>>(lista);
    }

    public async Task<IReadOnlyList<Pagamento>> GetPagamentosAsync(Guid contratoId, Guid obraId)
    {
        if (!_contratos.Any(c => c.Id == contratoId && c.ObraId == obraId))
        {
            return [];
        }

        var lista = new List<Pagamento>();
        foreach (var p in _pagamentos
                     .Where(p => p.ContratoId == contratoId)
                     .OrderByDescending(p => p.DataPagamento)
                     .ThenByDescending(p => p.CreatedAt))
        {
            int? numero = null;
            if (p.ReferenteMedicaoId is { } medicaoId)
            {
                numero = (await _medicoes.GetByIdAndObraAsync(medicaoId, obraId))?.Numero;
            }

            lista.Add(new Pagamento
            {
                Id = p.Id,
                ContratoId = p.ContratoId,
                ReferenteMedicaoId = p.ReferenteMedicaoId,
                ReferenteMedicaoNumero = numero,
                Valor = p.Valor,
                DataPagamento = p.DataPagamento,
                FormaPagamento = p.FormaPagamento,
                CreatedAt = p.CreatedAt
            });
        }

        return lista;
    }

    public async Task<bool> MedicaoComNfNaObraAsync(Guid medicaoId, Guid obraId)
    {
        var medicao = await _medicoes.GetByIdAndObraAsync(medicaoId, obraId);
        return medicao is not null && medicao.Status == MedicaoStatus.InvoiceIssued;
    }

    public async Task<bool> CreatePagamentoAsync(Pagamento pagamento, Guid obraId)
    {
        if (!_contratos.Any(c => c.Id == pagamento.ContratoId && c.ObraId == obraId))
        {
            return false;
        }

        if (pagamento.ReferenteMedicaoId is { } medicaoId && !await MedicaoComNfNaObraAsync(medicaoId, obraId))
        {
            return false;
        }

        _pagamentos.Add(pagamento);
        return true;
    }

    private Contrato ComTotal(Contrato c) => new()
    {
        Id = c.Id,
        ObraId = c.ObraId,
        Numero = c.Numero,
        ValorContratado = c.ValorContratado,
        DataAssinatura = c.DataAssinatura,
        StorageKey = c.StorageKey,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt,
        TotalPago = _pagamentos.Where(p => p.ContratoId == c.Id).Sum(p => p.Valor)
    };
}
