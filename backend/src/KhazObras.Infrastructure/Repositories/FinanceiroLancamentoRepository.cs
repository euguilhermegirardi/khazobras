using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class FinanceiroLancamentoRepository : IFinanceiroLancamentoRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public FinanceiroLancamentoRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<FinanceiroLancamento> CreateAsync(FinanceiroLancamento lancamento)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO financeiro_lancamentos (id, obra_id, categoria, descricao, valor, data_lancamento, mes_competencia, created_by_user_id, created_at)
            VALUES (@Id, @ObraId, @Categoria::item_tipo, @Descricao, @Valor, @DataLancamento, @MesCompetencia, @CreatedByUserId, @CreatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            lancamento.Id,
            lancamento.ObraId,
            Categoria = ToDbCategoria(lancamento.Categoria),
            lancamento.Descricao,
            lancamento.Valor,
            DataLancamento = lancamento.DataLancamento.ToDateTime(TimeOnly.MinValue),
            MesCompetencia = lancamento.MesCompetencia.ToDateTime(TimeOnly.MinValue),
            lancamento.CreatedByUserId,
            lancamento.CreatedAt
        });

        return lancamento;
    }

    public async Task<FinanceiroLancamento?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, categoria, descricao, valor,
                   data_lancamento AS DataLancamento, mes_competencia AS MesCompetencia,
                   created_by_user_id AS CreatedByUserId, created_at AS CreatedAt
            FROM financeiro_lancamentos
            WHERE id = @Id";

        var row = await connection.QuerySingleOrDefaultAsync<LancamentoRow>(sql, new { Id = id });
        if (row is null)
        {
            return null;
        }

        var lancamento = row.ToEntity();
        lancamento.Anexos = (await GetAnexosAsync(connection, id)).ToList();
        return lancamento;
    }

    public async Task<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)> GetPagedByObraIdAsync(Guid obraId, int pageIndex, int pageSize)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string countSql = "SELECT COUNT(*) FROM financeiro_lancamentos WHERE obra_id = @ObraId";
        var totalItems = await connection.ExecuteScalarAsync<int>(countSql, new { ObraId = obraId });

        const string pagedSql = @"
            SELECT id, obra_id AS ObraId, categoria, descricao, valor,
                   data_lancamento AS DataLancamento, mes_competencia AS MesCompetencia,
                   created_by_user_id AS CreatedByUserId, created_at AS CreatedAt
            FROM financeiro_lancamentos
            WHERE obra_id = @ObraId
            ORDER BY data_lancamento DESC
            OFFSET @Offset LIMIT @PageSize";

        var rows = await connection.QueryAsync<LancamentoRow>(pagedSql, new
        {
            ObraId = obraId,
            Offset = pageIndex * pageSize,
            PageSize = pageSize
        });

        var lancamentos = new List<FinanceiroLancamento>();
        foreach (var row in rows)
        {
            var lancamento = row.ToEntity();
            lancamento.Anexos = (await GetAnexosAsync(connection, lancamento.Id)).ToList();
            lancamentos.Add(lancamento);
        }

        return (lancamentos, totalItems);
    }

    public async Task<FinanceiroLancamentoAnexo> AddAnexoAsync(FinanceiroLancamentoAnexo anexo)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO financeiro_lancamento_anexos (id, lancamento_id, nome_arquivo, storage_key, content_type, tamanho_bytes, uploaded_at)
            VALUES (@Id, @LancamentoId, @NomeArquivo, @StorageKey, @ContentType, @TamanhoBytes, @UploadedAt)";

        await connection.ExecuteAsync(sql, anexo);
        return anexo;
    }

    public async Task<FinanceiroLancamentoAnexo?> GetAnexoByIdAsync(Guid anexoId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, lancamento_id AS LancamentoId, nome_arquivo AS NomeArquivo,
                   storage_key AS StorageKey, content_type AS ContentType,
                   tamanho_bytes AS TamanhoBytes, uploaded_at AS UploadedAt
            FROM financeiro_lancamento_anexos
            WHERE id = @AnexoId";

        return await connection.QuerySingleOrDefaultAsync<FinanceiroLancamentoAnexo>(sql, new { AnexoId = anexoId });
    }

    private static async Task<IEnumerable<FinanceiroLancamentoAnexo>> GetAnexosAsync(System.Data.IDbConnection connection, Guid lancamentoId)
    {
        const string sql = @"
            SELECT id, lancamento_id AS LancamentoId, nome_arquivo AS NomeArquivo,
                   storage_key AS StorageKey, content_type AS ContentType,
                   tamanho_bytes AS TamanhoBytes, uploaded_at AS UploadedAt
            FROM financeiro_lancamento_anexos
            WHERE lancamento_id = @LancamentoId";

        return await connection.QueryAsync<FinanceiroLancamentoAnexo>(sql, new { LancamentoId = lancamentoId });
    }

    private static string ToDbCategoria(ItemTipo categoria) => categoria switch
    {
        ItemTipo.MaoDeObra => "mao_de_obra",
        ItemTipo.Material => "material",
        ItemTipo.Equipamento => "equipamento",
        _ => throw new ArgumentOutOfRangeException(nameof(categoria))
    };

    private sealed class LancamentoRow
    {
        public Guid Id { get; set; }
        public Guid ObraId { get; set; }
        public string Categoria { get; set; } = string.Empty;
        public string Descricao { get; set; } = string.Empty;
        public decimal Valor { get; set; }
        public DateTime DataLancamento { get; set; }
        public DateTime MesCompetencia { get; set; }
        public Guid CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }

        public FinanceiroLancamento ToEntity() => new()
        {
            Id = Id,
            ObraId = ObraId,
            Categoria = Categoria switch
            {
                "mao_de_obra" => ItemTipo.MaoDeObra,
                "material" => ItemTipo.Material,
                "equipamento" => ItemTipo.Equipamento,
                _ => throw new InvalidOperationException($"Categoria desconhecida: {Categoria}")
            },
            Descricao = Descricao,
            Valor = Valor,
            DataLancamento = DateOnly.FromDateTime(DataLancamento),
            MesCompetencia = DateOnly.FromDateTime(MesCompetencia),
            CreatedByUserId = CreatedByUserId,
            CreatedAt = CreatedAt
        };
    }
}