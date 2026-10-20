using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Infrastructure.Persistence;
using Npgsql;

namespace KhazObras.Infrastructure.Repositories;

public sealed class MedicaoRepository : IMedicaoRepository
{
    private const string MedicaoColumns = @"
                   id, obra_id AS ObraId, etapa_id AS EtapaId, numero, competencia,
                   valor_total AS ValorTotal, status::text AS Status, approved_at AS ApprovedAt,
                   approved_by_user_id AS ApprovedByUserId, nf_number AS NfNumber,
                   nf_issued_at AS NfIssuedAt, created_at AS CreatedAt, updated_at AS UpdatedAt";

    private readonly IDbConnectionFactory _connectionFactory;

    public MedicaoRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Medicao> CreateAsync(Medicao medicao)
    {
        using var connection = _connectionFactory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        try
        {
            const string medicaoSql = @"
                INSERT INTO medicoes (id, obra_id, etapa_id, numero, competencia, valor_total, status, created_at, updated_at)
                VALUES (@Id, @ObraId, @EtapaId, @Numero, @Competencia, @ValorTotal, @Status::medicao_status, @CreatedAt, @UpdatedAt)";

            await connection.ExecuteAsync(medicaoSql, new
            {
                medicao.Id,
                medicao.ObraId,
                medicao.EtapaId,
                medicao.Numero,
                Competencia = medicao.Competencia.ToDateTime(TimeOnly.MinValue),
                medicao.ValorTotal,
                Status = ToDbStatus(medicao.Status),
                medicao.CreatedAt,
                medicao.UpdatedAt
            }, transaction);

            const string itemSql = @"
                INSERT INTO medicao_itens (id, medicao_id, tipo, descricao, quantidade, valor_unitario, valor_total, created_at)
                VALUES (@Id, @MedicaoId, @Tipo::item_tipo, @Descricao, @Quantidade, @ValorUnitario, @ValorTotal, @CreatedAt)";

            foreach (var item in medicao.Itens)
            {
                await connection.ExecuteAsync(itemSql, new
                {
                    item.Id,
                    MedicaoId = medicao.Id,
                    Tipo = ToDbTipo(item.Tipo),
                    item.Descricao,
                    item.Quantidade,
                    item.ValorUnitario,
                    item.ValorTotal,
                    CreatedAt = DateTime.UtcNow
                }, transaction);
            }

            transaction.Commit();
            return medicao;
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            // UNIQUE (obra_id, numero): corrida entre dois pedidos com o mesmo numero.
            transaction.Rollback();
            throw new MedicaoNumeroDuplicadoException();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<bool> ExistsNumeroAsync(Guid obraId, int numero)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT EXISTS (SELECT 1 FROM medicoes WHERE obra_id = @ObraId AND numero = @Numero)";

        return await connection.ExecuteScalarAsync<bool>(sql, new { ObraId = obraId, Numero = numero });
    }

    public async Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT obra_id FROM medicoes WHERE id = @Id";
        return await connection.ExecuteScalarAsync<Guid?>(sql, new { Id = id });
    }

    public async Task<Medicao?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        var medicaoSql = $@"
            SELECT {MedicaoColumns}
            FROM medicoes
            WHERE id = @Id AND obra_id = @ObraId";

        var row = await connection.QuerySingleOrDefaultAsync<MedicaoRow>(medicaoSql, new { Id = id, ObraId = obraId });
        if (row is null)
        {
            return null;
        }

        var medicao = row.ToEntity();
        var itens = await GetItensPorMedicaoAsync(connection, [medicao.Id]);
        medicao.Itens = itens.TryGetValue(medicao.Id, out var lista) ? lista : [];
        return medicao;
    }

    public async Task<IReadOnlyList<Medicao>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        var medicaoSql = $@"
            SELECT {MedicaoColumns}
            FROM medicoes
            WHERE obra_id = @ObraId
            ORDER BY numero ASC";

        var rows = await connection.QueryAsync<MedicaoRow>(medicaoSql, new { ObraId = obraId });
        var medicoes = rows.Select(r => r.ToEntity()).ToList();

        // Itens de todas as medicoes numa consulta so (sem N+1).
        if (medicoes.Count > 0)
        {
            var itens = await GetItensPorMedicaoAsync(connection, medicoes.Select(m => m.Id).ToArray());
            foreach (var medicao in medicoes)
            {
                medicao.Itens = itens.TryGetValue(medicao.Id, out var lista) ? lista : [];
            }
        }

        return medicoes;
    }

    public async Task<(IReadOnlyList<MedicaoResumo> Items, int TotalItems)> GetResumoPagedByObraIdAsync(
        Guid obraId, int pageIndex, int pageSize, MedicaoStatus? status)
    {
        using var connection = _connectionFactory.CreateConnection();

        string? statusDb = status is null ? null : ToDbStatus(status.Value);

        const string countSql = @"
            SELECT COUNT(*) FROM medicoes
            WHERE obra_id = @ObraId AND (@Status::text IS NULL OR status::text = @Status::text)";
        var totalItems = await connection.ExecuteScalarAsync<int>(countSql, new { ObraId = obraId, Status = statusDb });

        // A etapa so entra no JOIN se for da mesma obra (defense in depth); o nome nunca vem de outra obra.
        const string pagedSql = @"
            SELECT m.id, m.obra_id AS ObraId, m.etapa_id AS EtapaId, e.nome AS EtapaNome, m.numero, m.competencia,
                   m.valor_total AS ValorTotal, m.status::text AS Status,
                   (SELECT COUNT(*) FROM medicao_itens i WHERE i.medicao_id = m.id)::int AS QuantidadeItens,
                   m.created_at AS CreatedAt, m.approved_at AS ApprovedAt,
                   m.nf_issued_at AS NfIssuedAt, m.nf_number AS NfNumber
            FROM medicoes m
            LEFT JOIN etapas e ON e.id = m.etapa_id AND e.obra_id = m.obra_id
            WHERE m.obra_id = @ObraId AND (@Status::text IS NULL OR m.status::text = @Status::text)
            ORDER BY m.numero DESC
            OFFSET @Offset LIMIT @PageSize";

        var rows = await connection.QueryAsync<MedicaoResumoRow>(pagedSql, new
        {
            ObraId = obraId,
            Status = statusDb,
            Offset = (long)pageIndex * pageSize,
            PageSize = pageSize
        });

        return (rows.Select(r => r.ToEntity()).ToList(), totalItems);
    }

    public async Task<bool> ApproveAsync(Guid id, Guid obraId, Guid approvedByUserId, DateTime approvedAt)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE medicoes
            SET status = 'approved'::medicao_status, approved_at = @ApprovedAt,
                approved_by_user_id = @ApprovedByUserId, updated_at = @UpdatedAt
            WHERE id = @Id AND obra_id = @ObraId AND status = 'pending_approval'::medicao_status";

        var affected = await connection.ExecuteAsync(sql, new
        {
            Id = id,
            ObraId = obraId,
            ApprovedAt = approvedAt,
            ApprovedByUserId = approvedByUserId,
            UpdatedAt = DateTime.UtcNow
        });

        return affected == 1;
    }

    public async Task<bool> IssueInvoiceAsync(Guid id, Guid obraId, string nfNumber, DateTime nfIssuedAt)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE medicoes
            SET status = 'invoice_issued'::medicao_status, nf_number = @NfNumber,
                nf_issued_at = @NfIssuedAt, updated_at = @UpdatedAt
            WHERE id = @Id AND obra_id = @ObraId AND status = 'approved'::medicao_status";

        var affected = await connection.ExecuteAsync(sql, new
        {
            Id = id,
            ObraId = obraId,
            NfNumber = nfNumber,
            NfIssuedAt = nfIssuedAt,
            UpdatedAt = DateTime.UtcNow
        });

        return affected == 1;
    }

    private static async Task<Dictionary<Guid, List<MedicaoItem>>> GetItensPorMedicaoAsync(
        System.Data.IDbConnection connection, Guid[] medicaoIds)
    {
        const string sql = @"
            SELECT id, medicao_id AS MedicaoId, tipo::text AS Tipo, descricao, quantidade,
                   valor_unitario AS ValorUnitario, valor_total AS ValorTotal
            FROM medicao_itens
            WHERE medicao_id = ANY(@Ids)
            ORDER BY created_at ASC, id ASC";

        var rows = await connection.QueryAsync<MedicaoItemRow>(sql, new { Ids = medicaoIds });
        return rows
            .GroupBy(r => r.MedicaoId)
            .ToDictionary(g => g.Key, g => g.Select(r => r.ToEntity()).ToList());
    }

    private static string ToDbStatus(MedicaoStatus status) => status switch
    {
        MedicaoStatus.PendingApproval => "pending_approval",
        MedicaoStatus.Approved => "approved",
        MedicaoStatus.InvoiceIssued => "invoice_issued",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    private static MedicaoStatus FromDbStatus(string status) => status switch
    {
        "pending_approval" => MedicaoStatus.PendingApproval,
        "approved" => MedicaoStatus.Approved,
        "invoice_issued" => MedicaoStatus.InvoiceIssued,
        _ => throw new InvalidOperationException($"Status desconhecido: {status}")
    };

    private static string ToDbTipo(ItemTipo tipo) => tipo switch
    {
        ItemTipo.MaoDeObra => "mao_de_obra",
        ItemTipo.Material => "material",
        ItemTipo.Equipamento => "equipamento",
        _ => throw new ArgumentOutOfRangeException(nameof(tipo))
    };

    private sealed class MedicaoRow
    {
        public Guid Id { get; set; }
        public Guid ObraId { get; set; }
        public Guid? EtapaId { get; set; }
        public int Numero { get; set; }
        public DateTime Competencia { get; set; }
        public decimal ValorTotal { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? ApprovedAt { get; set; }
        public Guid? ApprovedByUserId { get; set; }
        public string? NfNumber { get; set; }
        public DateTime? NfIssuedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public Medicao ToEntity() => new()
        {
            Id = Id,
            ObraId = ObraId,
            EtapaId = EtapaId,
            Numero = Numero,
            Competencia = DateOnly.FromDateTime(Competencia),
            ValorTotal = ValorTotal,
            Status = FromDbStatus(Status),
            ApprovedAt = ApprovedAt,
            ApprovedByUserId = ApprovedByUserId,
            NfNumber = NfNumber,
            NfIssuedAt = NfIssuedAt,
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt
        };
    }

    private sealed class MedicaoResumoRow
    {
        public Guid Id { get; set; }
        public Guid ObraId { get; set; }
        public Guid? EtapaId { get; set; }
        public string? EtapaNome { get; set; }
        public int Numero { get; set; }
        public DateTime Competencia { get; set; }
        public decimal ValorTotal { get; set; }
        public string Status { get; set; } = string.Empty;
        public int QuantidadeItens { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? NfIssuedAt { get; set; }
        public string? NfNumber { get; set; }

        public MedicaoResumo ToEntity() => new()
        {
            Id = Id,
            ObraId = ObraId,
            EtapaId = EtapaId,
            EtapaNome = EtapaNome,
            Numero = Numero,
            Competencia = DateOnly.FromDateTime(Competencia),
            ValorTotal = ValorTotal,
            Status = FromDbStatus(Status),
            QuantidadeItens = QuantidadeItens,
            CreatedAt = CreatedAt,
            ApprovedAt = ApprovedAt,
            NfIssuedAt = NfIssuedAt,
            NfNumber = NfNumber
        };
    }

    private sealed class MedicaoItemRow
    {
        public Guid Id { get; set; }
        public Guid MedicaoId { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public string Descricao { get; set; } = string.Empty;
        public decimal Quantidade { get; set; }
        public decimal ValorUnitario { get; set; }
        public decimal ValorTotal { get; set; }

        public MedicaoItem ToEntity() => new()
        {
            Id = Id,
            MedicaoId = MedicaoId,
            Tipo = Tipo switch
            {
                "mao_de_obra" => ItemTipo.MaoDeObra,
                "material" => ItemTipo.Material,
                "equipamento" => ItemTipo.Equipamento,
                _ => throw new InvalidOperationException($"Tipo desconhecido: {Tipo}")
            },
            Descricao = Descricao,
            Quantidade = Quantidade,
            ValorUnitario = ValorUnitario,
            ValorTotal = ValorTotal
        };
    }
}
