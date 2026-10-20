using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Dashboard;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class DashboardClienteService
{
    // America/Sao_Paulo sem horario de verao desde 2019: o "hoje" do cliente e a data UTC menos 3h.
    private static readonly TimeSpan OffsetSaoPaulo = TimeSpan.FromHours(-3);

    private readonly IDashboardClienteRepository _repository;
    private readonly TimeProvider _timeProvider;

    public DashboardClienteService(IDashboardClienteRepository repository, TimeProvider timeProvider)
    {
        _repository = repository;
        _timeProvider = timeProvider;
    }

    /// <summary>Null se a obra nao existir. O endpoint ja validou o acesso a ela (EnsureAccessAsync).</summary>
    public async Task<DashboardClienteResponse?> GetAsync(Guid obraId, CancellationToken cancellationToken = default)
    {
        var dados = await _repository.GetDadosAsync(obraId, cancellationToken);
        if (dados is null)
        {
            return null;
        }

        var obra = dados.Obra;
        var hoje = Hoje();

        var etapas = dados.Etapas
            .OrderBy(e => e.Ordem)
            .ThenBy(e => e.DataInicioPrevista ?? DateOnly.MaxValue)
            .ToList();

        var medidoPorMes = new List<DashboardMedidoMesResponse>();
        var acumulado = 0m;
        foreach (var mes in dados.MedidoPorMes.OrderBy(m => m.Competencia))
        {
            acumulado += mes.Valor;
            medidoPorMes.Add(new DashboardMedidoMesResponse(mes.Competencia, mes.Valor, acumulado));
        }

        return new DashboardClienteResponse(
            new DashboardObraResponse(obra.Id, obra.Nome, obra.DataInicio, obra.DataPrevisaoTermino, obra.Status.ToString()),
            CalcularAvancoFisico(etapas),
            new DashboardPrazoResponse(
                obra.DataPrevisaoTermino is { } previsao ? (int?)(previsao.DayNumber - hoje.DayNumber) : null,
                obra.DataPrevisaoTermino),
            new DashboardValoresResponse(obra.ValorContratado, acumulado, obra.ValorContratado - acumulado, dados.TotalPago),
            etapas.Select(e => new DashboardEtapaResponse(
                e.Id, e.Nome, e.Ordem, e.PercentualConcluido, e.Status, e.DataInicioPrevista, e.DataFimPrevista)).ToList(),
            medidoPorMes);
    }

    /// <summary>
    /// Media do % concluido ponderada pelo peso (soma(pct x peso) / soma(peso)). Se a soma dos pesos for zero
    /// (todos 0/ausentes) cai na media simples; sem etapas = 0. Uma casa decimal.
    /// </summary>
    public static decimal CalcularAvancoFisico(IReadOnlyCollection<Etapa> etapas)
    {
        if (etapas.Count == 0)
        {
            return 0m;
        }

        var somaPesos = etapas.Sum(e => Math.Max(e.PercentualPeso, 0m));
        var media = somaPesos > 0m
            ? etapas.Sum(e => e.PercentualConcluido * Math.Max(e.PercentualPeso, 0m)) / somaPesos
            : etapas.Sum(e => e.PercentualConcluido) / etapas.Count;

        return Math.Round(media, 1, MidpointRounding.AwayFromZero);
    }

    private DateOnly Hoje() =>
        DateOnly.FromDateTime(_timeProvider.GetUtcNow().UtcDateTime.Add(OffsetSaoPaulo));
}
