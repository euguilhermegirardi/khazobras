using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;

namespace KhazObras.Security.Tests.Fakes;

/// <summary>
/// Dashboard do cliente em memoria. Espelha o SQL real: tudo preso a obra, medicoes so approved/invoice_issued
/// agrupadas pelo mes da competencia, TotalPago = soma dos pagamentos dos contratos da obra. Nao le o financeiro
/// (lancamentos) de proposito: o repositorio real tambem nao.
/// </summary>
public sealed class FakeDashboardClienteRepository : IDashboardClienteRepository
{
    private readonly FakeObraRepository _obras;
    private readonly FakeEtapaRepository _etapas;
    private readonly FakeMedicaoRepository _medicoes;
    private readonly FakeContratoRepository _contratos;

    public FakeDashboardClienteRepository(
        FakeObraRepository obras, FakeEtapaRepository etapas, FakeMedicaoRepository medicoes, FakeContratoRepository contratos)
    {
        _obras = obras;
        _etapas = etapas;
        _medicoes = medicoes;
        _contratos = contratos;
    }

    /// <summary>Quantas vezes o repositorio foi chamado (um round-trip por requisicao).</summary>
    public int Chamadas { get; private set; }

    public async Task<DashboardClienteDados?> GetDadosAsync(Guid obraId, CancellationToken cancellationToken = default)
    {
        Chamadas++;

        var obra = await _obras.GetByIdAsync(obraId);
        if (obra is null)
        {
            return null;
        }

        var etapas = await _etapas.GetByObraIdAsync(obraId);
        var medicoes = await _medicoes.GetByObraIdAsync(obraId);
        var contratos = await _contratos.GetByObraIdAsync(obraId);

        var meses = medicoes
            .Where(m => m.Status is MedicaoStatus.Approved or MedicaoStatus.InvoiceIssued)
            .GroupBy(m => new DateOnly(m.Competencia.Year, m.Competencia.Month, 1))
            .OrderBy(g => g.Key)
            .Select(g => new MedidoMes { Competencia = g.Key, Valor = g.Sum(m => m.ValorTotal) })
            .ToList();

        return new DashboardClienteDados
        {
            Obra = obra,
            Etapas = etapas,
            MedidoPorMes = meses,
            TotalPago = contratos.Sum(c => c.TotalPago)
        };
    }
}
