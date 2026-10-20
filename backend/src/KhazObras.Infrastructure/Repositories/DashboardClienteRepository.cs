using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class DashboardClienteRepository : IDashboardClienteRepository
{
    // 4 consultas agregadas numa unica ida ao banco (QueryMultiple), todas presas a obra (WHERE obra_id / c.obra_id).
    // So entram obras, etapas, medicoes aprovadas (approved/invoice_issued) e pagamentos de contrato.
    // Lancamentos do financeiro (custo real) NAO sao consultados aqui: regra 7 do CLAUDE.md.
    private const string Sql = @"
        SELECT id, nome, valor_contratado AS ValorContratado, data_inicio AS DataInicio,
               data_previsao_termino AS DataPrevisaoTermino, status::text AS Status
        FROM obras
        WHERE id = @ObraId;

        SELECT id, nome, ordem, percentual_peso AS PercentualPeso, percentual_concluido AS PercentualConcluido,
               status, data_inicio_prevista AS DataInicioPrevista, data_fim_prevista AS DataFimPrevista
        FROM etapas
        WHERE obra_id = @ObraId
        ORDER BY ordem ASC, data_inicio_prevista ASC NULLS LAST, id ASC;

        SELECT date_trunc('month', competencia)::date AS Competencia, SUM(valor_total) AS Valor
        FROM medicoes
        WHERE obra_id = @ObraId
          AND status IN ('approved'::medicao_status, 'invoice_issued'::medicao_status)
        GROUP BY 1
        ORDER BY 1 ASC;

        SELECT COALESCE(SUM(p.valor), 0)
        FROM pagamentos p
        JOIN contratos c ON c.id = p.contrato_id
        WHERE c.obra_id = @ObraId;";

    private readonly IDbConnectionFactory _connectionFactory;

    public DashboardClienteRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<DashboardClienteDados?> GetDadosAsync(Guid obraId, CancellationToken cancellationToken = default)
    {
        using var connection = _connectionFactory.CreateConnection();

        var command = new CommandDefinition(Sql, new { ObraId = obraId }, cancellationToken: cancellationToken);
        using var grid = await connection.QueryMultipleAsync(command);

        var obra = await grid.ReadSingleOrDefaultAsync<ObraRow>();
        if (obra is null)
        {
            return null;
        }

        var etapas = (await grid.ReadAsync<EtapaRow>()).Select(r => r.ToEntity()).ToList();
        var meses = (await grid.ReadAsync<MesRow>())
            .Select(r => new MedidoMes { Competencia = DateOnly.FromDateTime(r.Competencia), Valor = r.Valor })
            .ToList();
        var totalPago = await grid.ReadSingleAsync<decimal>();

        return new DashboardClienteDados
        {
            Obra = obra.ToEntity(),
            Etapas = etapas,
            MedidoPorMes = meses,
            TotalPago = totalPago
        };
    }

    private sealed class ObraRow
    {
        public Guid Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public decimal ValorContratado { get; set; }
        public DateTime? DataInicio { get; set; }
        public DateTime? DataPrevisaoTermino { get; set; }
        public string Status { get; set; } = string.Empty;

        public Obra ToEntity() => new()
        {
            Id = Id,
            Nome = Nome,
            ValorContratado = ValorContratado,
            DataInicio = DataInicio.HasValue ? DateOnly.FromDateTime(DataInicio.Value) : null,
            DataPrevisaoTermino = DataPrevisaoTermino.HasValue ? DateOnly.FromDateTime(DataPrevisaoTermino.Value) : null,
            Status = Status switch
            {
                "em_andamento" => ObraStatus.EmAndamento,
                "concluida" => ObraStatus.Concluida,
                "pausada" => ObraStatus.Pausada,
                _ => throw new InvalidOperationException($"Status desconhecido: {Status}")
            }
        };
    }

    private sealed class EtapaRow
    {
        public Guid Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public int Ordem { get; set; }
        public decimal PercentualPeso { get; set; }
        public decimal PercentualConcluido { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? DataInicioPrevista { get; set; }
        public DateTime? DataFimPrevista { get; set; }

        public Etapa ToEntity() => new()
        {
            Id = Id,
            Nome = Nome,
            Ordem = Ordem,
            PercentualPeso = PercentualPeso,
            PercentualConcluido = PercentualConcluido,
            Status = Status,
            DataInicioPrevista = DataInicioPrevista.HasValue ? DateOnly.FromDateTime(DataInicioPrevista.Value) : null,
            DataFimPrevista = DataFimPrevista.HasValue ? DateOnly.FromDateTime(DataFimPrevista.Value) : null
        };
    }

    private sealed class MesRow
    {
        public DateTime Competencia { get; set; }
        public decimal Valor { get; set; }
    }
}
