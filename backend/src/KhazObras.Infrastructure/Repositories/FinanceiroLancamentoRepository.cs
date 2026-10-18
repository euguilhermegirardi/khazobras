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
            INSERT INTO financeiro_lancamentos (id, obra_id, categoria, descricao, valor, data_lancamento, mes_competencia, created_by_user_id, visivel_cliente, created_at)
            VALUES (@Id, @ObraId, @Categoria::item_tipo, @Descricao, @Valor, @DataLancamento, @MesCompetencia, @CreatedByUserId, @VisivelCliente, @CreatedAt)";

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
            lancamento.VisivelCliente,
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
                   created_by_user_id AS CreatedByUserId, visivel_cliente AS VisivelCliente, created_at AS CreatedAt
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

    public async Task<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)> GetPagedByObraIdAsync(Guid obraId, int pageIndex, int pageSize, bool somenteVisiveisCliente = false)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string countSql = @"
            SELECT COUNT(*) FROM financeiro_lancamentos
            WHERE obra_id = @ObraId AND (@SomenteVisiveisCliente = FALSE OR visivel_cliente = TRUE)";
        var totalItems = await connection.ExecuteScalarAsync<int>(countSql, new { ObraId = obraId, SomenteVisiveisCliente = somenteVisiveisCliente });

        const string pagedSql = @"
            SELECT id, obra_id AS ObraId, categoria, descricao, valor,
                   data_lancamento AS DataLancamento, mes_competencia AS MesCompetencia,
                   created_by_user_id AS CreatedByUserId, visivel_cliente AS VisivelCliente, created_at AS CreatedAt
            FROM financeiro_lancamentos
            WHERE obra_id = @ObraId AND (@SomenteVisiveisCliente = FALSE OR visivel_cliente = TRUE)
            ORDER BY data_lancamento DESC
            OFFSET @Offset LIMIT @PageSize";

        var rows = await connection.QueryAsync<LancamentoRow>(pagedSql, new
        {
            ObraId = obraId,
            SomenteVisiveisCliente = somenteVisiveisCliente,
            Offset = (long)pageIndex * pageSize,
            PageSize = pageSize
        });

        var lancamentos = rows.Select(r => r.ToEntity()).ToList();

        // Anexos da pagina inteira numa consulta so (sem N+1).
        if (lancamentos.Count > 0)
        {
            const string anexosSql = @"
                SELECT id, lancamento_id AS LancamentoId, nome_arquivo AS NomeArquivo,
                       storage_key AS StorageKey, content_type AS ContentType,
                       tamanho_bytes AS TamanhoBytes, uploaded_at AS UploadedAt
                FROM financeiro_lancamento_anexos
                WHERE lancamento_id = ANY(@Ids)";

            var anexos = await connection.QueryAsync<FinanceiroLancamentoAnexo>(anexosSql, new { Ids = lancamentos.Select(l => l.Id).ToArray() });
            var porLancamento = anexos.ToLookup(a => a.LancamentoId);
            foreach (var lancamento in lancamentos)
            {
                lancamento.Anexos = porLancamento[lancamento.Id].ToList();
            }
        }

        return (lancamentos, totalItems);
    }

    public async Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT obra_id FROM financeiro_lancamentos WHERE id = @Id";
        return await connection.QuerySingleOrDefaultAsync<Guid?>(sql, new { Id = id });
    }

    public async Task<FinanceiroLancamento?> GetByIdAndObraAsync(Guid id, Guid obraId, bool somenteVisiveisCliente)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, categoria, descricao, valor,
                   data_lancamento AS DataLancamento, mes_competencia AS MesCompetencia,
                   created_by_user_id AS CreatedByUserId, visivel_cliente AS VisivelCliente, created_at AS CreatedAt
            FROM financeiro_lancamentos
            WHERE id = @Id AND obra_id = @ObraId
              AND (@SomenteVisiveisCliente = FALSE OR visivel_cliente = TRUE)";

        var row = await connection.QuerySingleOrDefaultAsync<LancamentoRow>(sql, new
        {
            Id = id,
            ObraId = obraId,
            SomenteVisiveisCliente = somenteVisiveisCliente
        });
        if (row is null)
        {
            return null;
        }

        var lancamento = row.ToEntity();
        lancamento.Anexos = (await GetAnexosAsync(connection, id)).ToList();
        return lancamento;
    }

    public async Task<bool> SetVisibilidadeClienteAsync(Guid id, Guid obraId, bool visivelCliente)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "UPDATE financeiro_lancamentos SET visivel_cliente = @VisivelCliente WHERE id = @Id AND obra_id = @ObraId";
        var afetadas = await connection.ExecuteAsync(sql, new { Id = id, ObraId = obraId, VisivelCliente = visivelCliente });
        return afetadas > 0;
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

    public async Task<Guid?> GetObraIdByAnexoIdAsync(Guid anexoId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT l.obra_id
            FROM financeiro_lancamento_anexos a
            JOIN financeiro_lancamentos l ON l.id = a.lancamento_id
            WHERE a.id = @AnexoId";

        return await connection.QuerySingleOrDefaultAsync<Guid?>(sql, new { AnexoId = anexoId });
    }

    public async Task<FinanceiroLancamentoAnexo?> GetAnexoByIdAndObraAsync(Guid anexoId, Guid obraId, bool somenteVisiveisCliente)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT a.id, a.lancamento_id AS LancamentoId, a.nome_arquivo AS NomeArquivo,
                   a.storage_key AS StorageKey, a.content_type AS ContentType,
                   a.tamanho_bytes AS TamanhoBytes, a.uploaded_at AS UploadedAt
            FROM financeiro_lancamento_anexos a
            JOIN financeiro_lancamentos l ON l.id = a.lancamento_id
            WHERE a.id = @AnexoId AND l.obra_id = @ObraId
              AND (@SomenteVisiveisCliente = FALSE OR l.visivel_cliente = TRUE)";

        return await connection.QuerySingleOrDefaultAsync<FinanceiroLancamentoAnexo>(sql, new
        {
            AnexoId = anexoId,
            ObraId = obraId,
            SomenteVisiveisCliente = somenteVisiveisCliente
        });
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
        public bool VisivelCliente { get; set; }
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
            VisivelCliente = VisivelCliente,
            CreatedAt = CreatedAt
        };
    }
}