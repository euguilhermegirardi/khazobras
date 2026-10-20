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

    // Obra + visibilidade do cliente + filtros opcionais da tela admin; tudo parametrizado (nada interpolado).
    // Competencia = mes inteiro: [dia 1 do mes, dia 1 do mes seguinte).
    private const string ListaWhere = @"
            obra_id = @ObraId
            AND (@SomenteVisiveisCliente = FALSE OR visivel_cliente = TRUE)
            AND (@FiltroVisivelCliente::boolean IS NULL OR visivel_cliente = @FiltroVisivelCliente::boolean)
            AND (@FiltroCategoria::item_tipo IS NULL OR categoria = @FiltroCategoria::item_tipo)
            AND (@FiltroCompetenciaInicio::date IS NULL
                 OR (mes_competencia >= @FiltroCompetenciaInicio::date AND mes_competencia < @FiltroCompetenciaFim::date))";

    public async Task<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)> GetPagedByObraIdAsync(
        Guid obraId, int pageIndex, int pageSize, bool somenteVisiveisCliente = false, FinanceiroFiltro? filtro = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var competenciaInicio = filtro?.Competencia?.ToDateTime(TimeOnly.MinValue);
        var parametros = new
        {
            ObraId = obraId,
            SomenteVisiveisCliente = somenteVisiveisCliente,
            FiltroVisivelCliente = filtro?.VisivelCliente,
            FiltroCategoria = filtro?.Categoria is { } categoria ? ToDbCategoria(categoria) : null,
            FiltroCompetenciaInicio = competenciaInicio,
            FiltroCompetenciaFim = competenciaInicio?.AddMonths(1),
            Offset = (long)pageIndex * pageSize,
            PageSize = pageSize
        };

        const string countSql = "SELECT COUNT(*) FROM financeiro_lancamentos WHERE " + ListaWhere;
        var totalItems = await connection.ExecuteScalarAsync<int>(countSql, parametros);

        const string pagedSql = @"
            SELECT id, obra_id AS ObraId, categoria, descricao, valor,
                   data_lancamento AS DataLancamento, mes_competencia AS MesCompetencia,
                   created_by_user_id AS CreatedByUserId, visivel_cliente AS VisivelCliente, created_at AS CreatedAt
            FROM financeiro_lancamentos
            WHERE " + ListaWhere + @"
            ORDER BY data_lancamento DESC, created_at DESC, id
            OFFSET @Offset LIMIT @PageSize";

        var rows = await connection.QueryAsync<LancamentoRow>(pagedSql, parametros);

        var lancamentos = rows.Select(r => r.ToEntity()).ToList();

        // Anexos da pagina inteira numa consulta so (sem N+1).
        if (lancamentos.Count > 0)
        {
            const string anexosSql = @"
                SELECT id, lancamento_id AS LancamentoId, nome_arquivo AS NomeArquivo,
                       storage_key AS StorageKey, content_type AS ContentType,
                       tamanho_bytes AS TamanhoBytes, uploaded_at AS UploadedAt
                FROM financeiro_lancamento_anexos
                WHERE lancamento_id = ANY(@Ids)
                ORDER BY uploaded_at, id";

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

    public async Task<IReadOnlyList<(Guid Id, bool VisivelAnterior)>?> SetVisibilidadeLoteAsync(Guid obraId, IReadOnlyList<Guid> ids, bool visivelCliente)
    {
        using var connection = _connectionFactory.CreateConnection();

        // Um unico UPDATE atomico: so grava se a quantidade de linhas dessa obra com esses ids for exatamente a esperada
        // (algum id de outra obra ou inexistente => nenhuma linha alterada). RETURNING traz o valor de antes para a auditoria.
        const string sql = @"
            WITH antes AS (
                SELECT id, visivel_cliente
                FROM financeiro_lancamentos
                WHERE id = ANY(@Ids) AND obra_id = @ObraId
            )
            UPDATE financeiro_lancamentos f
            SET visivel_cliente = @VisivelCliente
            FROM antes
            WHERE f.id = antes.id AND f.obra_id = @ObraId
              AND (SELECT COUNT(*) FROM antes) = @Esperado
            RETURNING f.id AS Id, antes.visivel_cliente AS VisivelAnterior";

        var rows = (await connection.QueryAsync<VisibilidadeAnteriorRow>(sql, new
        {
            Ids = ids.ToArray(),
            ObraId = obraId,
            VisivelCliente = visivelCliente,
            Esperado = (long)ids.Count
        })).ToList();

        if (rows.Count != ids.Count)
        {
            return null;
        }

        return rows.Select(r => (r.Id, r.VisivelAnterior)).ToList();
    }

    public async Task<bool> UpdateAsync(FinanceiroLancamento lancamento)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE financeiro_lancamentos
            SET categoria = @Categoria::item_tipo, descricao = @Descricao, valor = @Valor,
                data_lancamento = @DataLancamento, mes_competencia = @MesCompetencia, visivel_cliente = @VisivelCliente
            WHERE id = @Id AND obra_id = @ObraId";

        var afetadas = await connection.ExecuteAsync(sql, new
        {
            lancamento.Id,
            lancamento.ObraId,
            Categoria = ToDbCategoria(lancamento.Categoria),
            lancamento.Descricao,
            lancamento.Valor,
            DataLancamento = lancamento.DataLancamento.ToDateTime(TimeOnly.MinValue),
            MesCompetencia = lancamento.MesCompetencia.ToDateTime(TimeOnly.MinValue),
            lancamento.VisivelCliente
        });
        return afetadas > 0;
    }

    public async Task<IReadOnlyList<string>?> DeleteAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        try
        {
            const string chavesSql = @"
                SELECT a.storage_key
                FROM financeiro_lancamento_anexos a
                JOIN financeiro_lancamentos l ON l.id = a.lancamento_id
                WHERE l.id = @Id AND l.obra_id = @ObraId";
            var chaves = (await connection.QueryAsync<string>(chavesSql, new { Id = id, ObraId = obraId }, transaction)).ToList();

            // Anexos saem junto por ON DELETE CASCADE (schema 003).
            const string deleteSql = "DELETE FROM financeiro_lancamentos WHERE id = @Id AND obra_id = @ObraId";
            var afetadas = await connection.ExecuteAsync(deleteSql, new { Id = id, ObraId = obraId }, transaction);

            if (afetadas == 0)
            {
                transaction.Rollback();
                return null;
            }

            transaction.Commit();
            return chaves;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<FinanceiroResumo> GetResumoByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT COALESCE(SUM(valor), 0) AS TotalLancado,
                   COALESCE(SUM(valor) FILTER (WHERE visivel_cliente), 0) AS TotalLiberadoCliente,
                   COALESCE(SUM(valor) FILTER (WHERE NOT visivel_cliente), 0) AS TotalNaoLiberado,
                   COUNT(*)::int AS QuantidadeLancamentos,
                   (COUNT(*) FILTER (WHERE visivel_cliente))::int AS QuantidadeLiberada,
                   (COUNT(*) FILTER (WHERE NOT visivel_cliente))::int AS QuantidadeNaoLiberada
            FROM financeiro_lancamentos
            WHERE obra_id = @ObraId";

        var row = await connection.QuerySingleAsync<ResumoRow>(sql, new { ObraId = obraId });
        return new FinanceiroResumo(
            row.TotalLancado, row.TotalLiberadoCliente, row.TotalNaoLiberado,
            row.QuantidadeLancamentos, row.QuantidadeLiberada, row.QuantidadeNaoLiberada);
    }

    public async Task<bool> TryAddAnexoAsync(FinanceiroLancamentoAnexo anexo, Guid obraId, int maxAnexos)
    {
        using var connection = _connectionFactory.CreateConnection();

        // Preso a obra e ao limite no proprio INSERT (nenhuma linha se o lancamento nao e da obra ou ja tem o maximo).
        const string sql = @"
            INSERT INTO financeiro_lancamento_anexos (id, lancamento_id, nome_arquivo, storage_key, content_type, tamanho_bytes, uploaded_at)
            SELECT @Id, l.id, @NomeArquivo, @StorageKey, @ContentType, @TamanhoBytes, @UploadedAt
            FROM financeiro_lancamentos l
            WHERE l.id = @LancamentoId AND l.obra_id = @ObraId
              AND (SELECT COUNT(*) FROM financeiro_lancamento_anexos x WHERE x.lancamento_id = l.id) < @MaxAnexos";

        var afetadas = await connection.ExecuteAsync(sql, new
        {
            anexo.Id,
            anexo.LancamentoId,
            ObraId = obraId,
            anexo.NomeArquivo,
            anexo.StorageKey,
            anexo.ContentType,
            anexo.TamanhoBytes,
            anexo.UploadedAt,
            MaxAnexos = (long)maxAnexos
        });
        return afetadas > 0;
    }

    public async Task<FinanceiroLancamentoAnexo?> DeleteAnexoAsync(Guid anexoId, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            DELETE FROM financeiro_lancamento_anexos a
            USING financeiro_lancamentos l
            WHERE a.id = @AnexoId AND l.id = a.lancamento_id AND l.obra_id = @ObraId
            RETURNING a.id, a.lancamento_id AS LancamentoId, a.nome_arquivo AS NomeArquivo,
                      a.storage_key AS StorageKey, a.content_type AS ContentType,
                      a.tamanho_bytes AS TamanhoBytes, a.uploaded_at AS UploadedAt";

        return await connection.QuerySingleOrDefaultAsync<FinanceiroLancamentoAnexo>(sql, new { AnexoId = anexoId, ObraId = obraId });
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
            WHERE lancamento_id = @LancamentoId
            ORDER BY uploaded_at, id";

        return await connection.QueryAsync<FinanceiroLancamentoAnexo>(sql, new { LancamentoId = lancamentoId });
    }

    private static string ToDbCategoria(ItemTipo categoria) => categoria switch
    {
        ItemTipo.MaoDeObra => "mao_de_obra",
        ItemTipo.Material => "material",
        ItemTipo.Equipamento => "equipamento",
        _ => throw new ArgumentOutOfRangeException(nameof(categoria))
    };

    private sealed class VisibilidadeAnteriorRow
    {
        public Guid Id { get; set; }
        public bool VisivelAnterior { get; set; }
    }

    private sealed class ResumoRow
    {
        public decimal TotalLancado { get; set; }
        public decimal TotalLiberadoCliente { get; set; }
        public decimal TotalNaoLiberado { get; set; }
        public int QuantidadeLancamentos { get; set; }
        public int QuantidadeLiberada { get; set; }
        public int QuantidadeNaoLiberada { get; set; }
    }

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