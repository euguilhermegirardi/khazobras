using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class ObraRepository : IObraRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public ObraRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Obra> CreateAsync(Obra obra)
    {
        using var connection = _connectionFactory.CreateConnection();

            const string sql = @"
                INSERT INTO obras (id, nome, endereco, valor_contratado, data_inicio, data_previsao_termino, status, created_at, updated_at)
                VALUES (@Id, @Nome, @Endereco, @ValorContratado, @DataInicio, @DataPrevisaoTermino, @Status::obra_status, @CreatedAt, @UpdatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            obra.Id,
            obra.Nome,
            obra.Endereco,
            obra.ValorContratado,
            DataInicio = obra.DataInicio?.ToDateTime(TimeOnly.MinValue),
            DataPrevisaoTermino = obra.DataPrevisaoTermino?.ToDateTime(TimeOnly.MinValue),
            Status = ToDbStatus(obra.Status),
            obra.CreatedAt,
            obra.UpdatedAt
        });

        return obra;
    }

    public async Task<Obra?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, nome, endereco, valor_contratado AS ValorContratado,
                   data_inicio AS DataInicio, data_previsao_termino AS DataPrevisaoTermino,
                   status, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM obras
            WHERE id = @Id";

        var row = await connection.QuerySingleOrDefaultAsync<ObraRow>(sql, new { Id = id });
        return row?.ToEntity();
    }

    public async Task<(IReadOnlyList<Obra> Items, int TotalItems)> GetPagedAsync(int pageIndex, int pageSize)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string countSql = "SELECT COUNT(*) FROM obras";
        var totalItems = await connection.ExecuteScalarAsync<int>(countSql);

        const string pagedSql = @"
            SELECT id, nome, endereco, valor_contratado AS ValorContratado,
                   data_inicio AS DataInicio, data_previsao_termino AS DataPrevisaoTermino,
                   status, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM obras
            ORDER BY created_at DESC
            OFFSET @Offset LIMIT @PageSize";

        var rows = await connection.QueryAsync<ObraRow>(pagedSql, new
        {
            Offset = pageIndex * pageSize,
            PageSize = pageSize
        });

        return (rows.Select(r => r.ToEntity()).ToList(), totalItems);
    }

    private static string ToDbStatus(ObraStatus status) => status switch
    {
        ObraStatus.EmAndamento => "em_andamento",
        ObraStatus.Concluida => "concluida",
        ObraStatus.Pausada => "pausada",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    private sealed class ObraRow
    {
        public Guid Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string? Endereco { get; set; }
        public decimal ValorContratado { get; set; }
        public DateTime? DataInicio { get; set; }
        public DateTime? DataPrevisaoTermino { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public Obra ToEntity() => new()
        {
            Id = Id,
            Nome = Nome,
            Endereco = Endereco,
            ValorContratado = ValorContratado,
            DataInicio = DataInicio.HasValue ? DateOnly.FromDateTime(DataInicio.Value) : null,
            DataPrevisaoTermino = DataPrevisaoTermino.HasValue ? DateOnly.FromDateTime(DataPrevisaoTermino.Value) : null,
            Status = Status switch
            {
                "em_andamento" => ObraStatus.EmAndamento,
                "concluida" => ObraStatus.Concluida,
                "pausada" => ObraStatus.Pausada,
                _ => throw new InvalidOperationException($"Status desconhecido: {Status}")
            },
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt
        };
    }
}