using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class EtapaRepository : IEtapaRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public EtapaRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Etapa> CreateAsync(Etapa etapa)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO etapas (id, obra_id, nome, ordem, percentual_peso, data_inicio_prevista, data_fim_prevista, status, created_at, updated_at)
            VALUES (@Id, @ObraId, @Nome, @Ordem, @PercentualPeso, @DataInicioPrevista, @DataFimPrevista, @Status, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            etapa.Id,
            etapa.ObraId,
            etapa.Nome,
            etapa.Ordem,
            etapa.PercentualPeso,
            DataInicioPrevista = etapa.DataInicioPrevista?.ToDateTime(TimeOnly.MinValue),
            DataFimPrevista = etapa.DataFimPrevista?.ToDateTime(TimeOnly.MinValue),
            etapa.Status,
            etapa.CreatedAt,
            etapa.UpdatedAt
        });

        return etapa;
    }

    public async Task<Etapa?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, nome, ordem, percentual_peso AS PercentualPeso,
                   data_inicio_prevista AS DataInicioPrevista, data_inicio_real AS DataInicioReal,
                   data_fim_prevista AS DataFimPrevista, data_fim_real AS DataFimReal,
                   status, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM etapas
            WHERE id = @Id";

        var row = await connection.QuerySingleOrDefaultAsync<EtapaRow>(sql, new { Id = id });
        return row?.ToEntity();
    }

    public async Task<IReadOnlyList<Etapa>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, nome, ordem, percentual_peso AS PercentualPeso,
                   data_inicio_prevista AS DataInicioPrevista, data_inicio_real AS DataInicioReal,
                   data_fim_prevista AS DataFimPrevista, data_fim_real AS DataFimReal,
                   status, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM etapas
            WHERE obra_id = @ObraId
            ORDER BY ordem ASC";

        var rows = await connection.QueryAsync<EtapaRow>(sql, new { ObraId = obraId });
        return rows.Select(r => r.ToEntity()).ToList();
    }

    private sealed class EtapaRow
    {
        public Guid Id { get; set; }
        public Guid ObraId { get; set; }
        public string Nome { get; set; } = string.Empty;
        public int Ordem { get; set; }
        public decimal PercentualPeso { get; set; }
        public DateTime? DataInicioPrevista { get; set; }
        public DateTime? DataInicioReal { get; set; }
        public DateTime? DataFimPrevista { get; set; }
        public DateTime? DataFimReal { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public Etapa ToEntity() => new()
        {
            Id = Id,
            ObraId = ObraId,
            Nome = Nome,
            Ordem = Ordem,
            PercentualPeso = PercentualPeso,
            DataInicioPrevista = DataInicioPrevista.HasValue ? DateOnly.FromDateTime(DataInicioPrevista.Value) : null,
            DataInicioReal = DataInicioReal.HasValue ? DateOnly.FromDateTime(DataInicioReal.Value) : null,
            DataFimPrevista = DataFimPrevista.HasValue ? DateOnly.FromDateTime(DataFimPrevista.Value) : null,
            DataFimReal = DataFimReal.HasValue ? DateOnly.FromDateTime(DataFimReal.Value) : null,
            Status = Status,
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt
        };
    }
}