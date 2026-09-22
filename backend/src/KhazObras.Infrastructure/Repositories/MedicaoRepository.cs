using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Domain.Enums;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class MedicaoRepository : IMedicaoRepository
{
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
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<Medicao?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string medicaoSql = @"
            SELECT id, obra_id AS ObraId, etapa_id AS EtapaId, numero, competencia,
                   valor_total AS ValorTotal, status, approved_at AS ApprovedAt,
                   approved_by_user_id AS ApprovedByUserId, nf_number AS NfNumber,
                   nf_issued_at AS NfIssuedAt, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM medicoes
            WHERE id = @Id";

        var row = await connection.QuerySingleOrDefaultAsync<MedicaoRow>(medicaoSql, new { Id = id });
        if (row is null)
        {
            return null;
        }

        var medicao = row.ToEntity();
        medicao.Itens = (await GetItensAsync(connection, id)).ToList();
        return medicao;
    }

    public async Task<IReadOnlyList<Medicao>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string medicaoSql = @"
            SELECT id, obra_id AS ObraId, etapa_id AS EtapaId, numero, competencia,
                   valor_total AS ValorTotal, status, approved_at AS ApprovedAt,
                   approved_by_user_id AS ApprovedByUserId, nf_number AS NfNumber,
                   nf_issued_at AS NfIssuedAt, created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM medicoes
            WHERE obra_id = @ObraId
            ORDER BY numero ASC";

        var rows = await connection.QueryAsync<MedicaoRow>(medicaoSql, new { ObraId = obraId });
        var medicoes = new List<Medicao>();

        foreach (var row in rows)
        {
            var medicao = row.ToEntity();
            medicao.Itens = (await GetItensAsync(connection, medicao.Id)).ToList();
            medicoes.Add(medicao);
        }

        return medicoes;
    }

    public async Task ApproveAsync(Guid id, Guid approvedByUserId, DateTime approvedAt)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE medicoes
            SET status = 'approved'::medicao_status, approved_at = @ApprovedAt,
                approved_by_user_id = @ApprovedByUserId, updated_at = @UpdatedAt
            WHERE id = @Id";

        await connection.ExecuteAsync(sql, new
        {
            Id = id,
            ApprovedAt = approvedAt,
            ApprovedByUserId = approvedByUserId,
            UpdatedAt = DateTime.UtcNow
        });
    }

    public async Task IssueInvoiceAsync(Guid id, string nfNumber, DateTime nfIssuedAt)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            UPDATE medicoes
            SET status = 'invoice_issued'::medicao_status, nf_number = @NfNumber,
                nf_issued_at = @NfIssuedAt, updated_at = @UpdatedAt
            WHERE id = @Id";

        await connection.ExecuteAsync(sql, new
        {
            Id = id,
            NfNumber = nfNumber,
            NfIssuedAt = nfIssuedAt,
            UpdatedAt = DateTime.UtcNow
        });
    }

    private static async Task<IEnumerable<MedicaoItem>> GetItensAsync(System.Data.IDbConnection connection, Guid medicaoId)
    {
        const string sql = @"
            SELECT id, tipo, descricao, quantidade, valor_unitario AS ValorUnitario, valor_total AS ValorTotal
            FROM medicao_itens
            WHERE medicao_id = @MedicaoId";

        var rows = await connection.QueryAsync<MedicaoItemRow>(sql, new { MedicaoId = medicaoId });
        return rows.Select(r => r.ToEntity());
    }

    private static string ToDbStatus(MedicaoStatus status) => status switch
    {
        MedicaoStatus.PendingApproval => "pending_approval",
        MedicaoStatus.Approved => "approved",
        MedicaoStatus.InvoiceIssued => "invoice_issued",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
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
            Status = Status switch
            {
                "pending_approval" => MedicaoStatus.PendingApproval,
                "approved" => MedicaoStatus.Approved,
                "invoice_issued" => MedicaoStatus.InvoiceIssued,
                _ => throw new InvalidOperationException($"Status desconhecido: {Status}")
            },
            ApprovedAt = ApprovedAt,
            ApprovedByUserId = ApprovedByUserId,
            NfNumber = NfNumber,
            NfIssuedAt = NfIssuedAt,
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt
        };
    }

    private sealed class MedicaoItemRow
    {
        public Guid Id { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public string Descricao { get; set; } = string.Empty;
        public decimal Quantidade { get; set; }
        public decimal ValorUnitario { get; set; }
        public decimal ValorTotal { get; set; }

        public MedicaoItem ToEntity() => new()
        {
            Id = Id,
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