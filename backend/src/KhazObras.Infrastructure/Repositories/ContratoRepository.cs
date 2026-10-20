using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;
using Npgsql;

namespace KhazObras.Infrastructure.Repositories;

public sealed class ContratoRepository : IContratoRepository
{
    // TotalPago: SUM dos pagamentos no proprio SQL (LEFT JOIN + GROUP BY na PK; sem N+1).
    // Nenhuma coluna de custo entra aqui: so valor contratado e valor recebido.
    private const string ContratoComTotaisSelect = @"
            SELECT c.id, c.obra_id AS ObraId, c.numero, c.valor_contratado AS ValorContratado,
                   c.data_assinatura AS DataAssinatura, c.created_at AS CreatedAt, c.updated_at AS UpdatedAt,
                   COALESCE(SUM(p.valor), 0) AS TotalPago
            FROM contratos c
            LEFT JOIN pagamentos p ON p.contrato_id = c.id";

    private readonly IDbConnectionFactory _connectionFactory;

    public ContratoRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<Contrato> CreateAsync(Contrato contrato)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO contratos (id, obra_id, numero, valor_contratado, data_assinatura, created_at, updated_at)
            VALUES (@Id, @ObraId, @Numero, @ValorContratado, @DataAssinatura, @CreatedAt, @UpdatedAt)";

        try
        {
            await connection.ExecuteAsync(sql, new
            {
                contrato.Id,
                contrato.ObraId,
                contrato.Numero,
                contrato.ValorContratado,
                DataAssinatura = contrato.DataAssinatura?.ToDateTime(TimeOnly.MinValue),
                contrato.CreatedAt,
                contrato.UpdatedAt
            });
        }
        catch (PostgresException ex) when (ex.SqlState == "23505")
        {
            // UNIQUE (obra_id, numero): corrida entre dois pedidos com o mesmo numero.
            throw new ContratoNumeroDuplicadoException();
        }

        return contrato;
    }

    public async Task<bool> ExistsNumeroAsync(Guid obraId, string numero)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT EXISTS (SELECT 1 FROM contratos WHERE obra_id = @ObraId AND numero = @Numero)";

        return await connection.ExecuteScalarAsync<bool>(sql, new { ObraId = obraId, Numero = numero });
    }

    public async Task<Guid?> GetObraIdByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = "SELECT obra_id FROM contratos WHERE id = @Id";
        return await connection.ExecuteScalarAsync<Guid?>(sql, new { Id = id });
    }

    public async Task<Contrato?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        var sql = $@"
            {ContratoComTotaisSelect}
            WHERE c.id = @Id AND c.obra_id = @ObraId
            GROUP BY c.id";

        var row = await connection.QuerySingleOrDefaultAsync<ContratoRow>(sql, new { Id = id, ObraId = obraId });
        return row?.ToEntity();
    }

    public async Task<IReadOnlyList<Contrato>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        var sql = $@"
            {ContratoComTotaisSelect}
            WHERE c.obra_id = @ObraId
            GROUP BY c.id
            ORDER BY c.created_at ASC, c.numero ASC";

        var rows = await connection.QueryAsync<ContratoRow>(sql, new { ObraId = obraId });
        return rows.Select(r => r.ToEntity()).ToList();
    }

    public async Task<IReadOnlyList<Pagamento>> GetPagamentosAsync(Guid contratoId, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        // Contrato preso a obra (JOIN + c.obra_id); a medicao so entra no JOIN se for da mesma obra.
        const string sql = @"
            SELECT p.id, p.contrato_id AS ContratoId, p.referente_medicao_id AS ReferenteMedicaoId,
                   m.numero AS ReferenteMedicaoNumero, p.valor, p.data_pagamento AS DataPagamento,
                   p.forma_pagamento AS FormaPagamento, p.created_at AS CreatedAt
            FROM pagamentos p
            JOIN contratos c ON c.id = p.contrato_id
            LEFT JOIN medicoes m ON m.id = p.referente_medicao_id AND m.obra_id = c.obra_id
            WHERE p.contrato_id = @ContratoId AND c.obra_id = @ObraId
            ORDER BY p.data_pagamento DESC, p.created_at DESC, p.id ASC";

        var rows = await connection.QueryAsync<PagamentoRow>(sql, new { ContratoId = contratoId, ObraId = obraId });
        return rows.Select(r => r.ToEntity()).ToList();
    }

    public async Task<bool> MedicaoComNfNaObraAsync(Guid medicaoId, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT EXISTS (
                SELECT 1 FROM medicoes
                WHERE id = @MedicaoId AND obra_id = @ObraId AND status = 'invoice_issued'::medicao_status)";

        return await connection.ExecuteScalarAsync<bool>(sql, new { MedicaoId = medicaoId, ObraId = obraId });
    }

    public async Task<bool> CreatePagamentoAsync(Pagamento pagamento, Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        // INSERT ... SELECT: so grava se o contrato for da obra e, havendo medicao, ela for da mesma obra e estiver com NF.
        const string sql = @"
            INSERT INTO pagamentos (id, contrato_id, referente_medicao_id, valor, data_pagamento, forma_pagamento, created_at)
            SELECT @Id, c.id, @ReferenteMedicaoId::uuid, @Valor, @DataPagamento::date, @FormaPagamento, @CreatedAt
            FROM contratos c
            WHERE c.id = @ContratoId AND c.obra_id = @ObraId
              AND (@ReferenteMedicaoId::uuid IS NULL OR EXISTS (
                    SELECT 1 FROM medicoes m
                    WHERE m.id = @ReferenteMedicaoId::uuid AND m.obra_id = c.obra_id
                      AND m.status = 'invoice_issued'::medicao_status))";

        var affected = await connection.ExecuteAsync(sql, new
        {
            pagamento.Id,
            ContratoId = pagamento.ContratoId,
            ObraId = obraId,
            pagamento.ReferenteMedicaoId,
            pagamento.Valor,
            DataPagamento = pagamento.DataPagamento.ToDateTime(TimeOnly.MinValue),
            pagamento.FormaPagamento,
            pagamento.CreatedAt
        });

        return affected == 1;
    }

    private sealed class ContratoRow
    {
        public Guid Id { get; set; }
        public Guid ObraId { get; set; }
        public string Numero { get; set; } = string.Empty;
        public decimal ValorContratado { get; set; }
        public DateTime? DataAssinatura { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public decimal TotalPago { get; set; }

        public Contrato ToEntity() => new()
        {
            Id = Id,
            ObraId = ObraId,
            Numero = Numero,
            ValorContratado = ValorContratado,
            DataAssinatura = DataAssinatura is { } d ? DateOnly.FromDateTime(d) : null,
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt,
            TotalPago = TotalPago
        };
    }

    private sealed class PagamentoRow
    {
        public Guid Id { get; set; }
        public Guid ContratoId { get; set; }
        public Guid? ReferenteMedicaoId { get; set; }
        public int? ReferenteMedicaoNumero { get; set; }
        public decimal Valor { get; set; }
        public DateTime DataPagamento { get; set; }
        public string? FormaPagamento { get; set; }
        public DateTime CreatedAt { get; set; }

        public Pagamento ToEntity() => new()
        {
            Id = Id,
            ContratoId = ContratoId,
            ReferenteMedicaoId = ReferenteMedicaoId,
            ReferenteMedicaoNumero = ReferenteMedicaoNumero,
            Valor = Valor,
            DataPagamento = DateOnly.FromDateTime(DataPagamento),
            FormaPagamento = FormaPagamento,
            CreatedAt = CreatedAt
        };
    }
}
