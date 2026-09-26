using Dapper;
using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;
using KhazObras.Infrastructure.Persistence;

namespace KhazObras.Infrastructure.Repositories;

public sealed class RelatorioFotograficoRepository : IRelatorioFotograficoRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public RelatorioFotograficoRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<RelatorioFotografico> CreateAsync(RelatorioFotografico relatorio)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO relatorios_fotograficos (id, obra_id, tipo, etapa_id, titulo, competencia, created_at)
            VALUES (@Id, @ObraId, @Tipo::relatorio_fotografico_tipo, @EtapaId, @Titulo, @Competencia, @CreatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            relatorio.Id,
            relatorio.ObraId,
            relatorio.Tipo,
            relatorio.EtapaId,
            relatorio.Titulo,
            Competencia = relatorio.Competencia?.ToDateTime(TimeOnly.MinValue),
            relatorio.CreatedAt
        });

        return relatorio;
    }

    public async Task<RelatorioFotografico?> GetByIdAsync(Guid id)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, tipo, etapa_id AS EtapaId, titulo, competencia, created_at AS CreatedAt
            FROM relatorios_fotograficos
            WHERE id = @Id";

        var row = await connection.QuerySingleOrDefaultAsync<RelatorioRow>(sql, new { Id = id });
        if (row is null)
        {
            return null;
        }

        var relatorio = row.ToEntity();
        relatorio.Fotos = (await GetFotosAsync(connection, id)).ToList();
        return relatorio;
    }

    public async Task<IReadOnlyList<RelatorioFotografico>> GetByObraIdAsync(Guid obraId)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            SELECT id, obra_id AS ObraId, tipo, etapa_id AS EtapaId, titulo, competencia, created_at AS CreatedAt
            FROM relatorios_fotograficos
            WHERE obra_id = @ObraId
            ORDER BY created_at DESC";

        var rows = await connection.QueryAsync<RelatorioRow>(sql, new { ObraId = obraId });
        var relatorios = new List<RelatorioFotografico>();

        foreach (var row in rows)
        {
            var relatorio = row.ToEntity();
            relatorio.Fotos = (await GetFotosAsync(connection, relatorio.Id)).ToList();
            relatorios.Add(relatorio);
        }

        return relatorios;
    }

    public async Task<Foto> AddFotoAsync(Foto foto)
    {
        using var connection = _connectionFactory.CreateConnection();

        const string sql = @"
            INSERT INTO fotos (id, relatorio_fotografico_id, storage_key, data_foto, descricao, ordem, created_at)
            VALUES (@Id, @RelatorioFotograficoId, @StorageKey, @DataFoto, @Descricao, @Ordem, @CreatedAt)";

        await connection.ExecuteAsync(sql, new
        {
            foto.Id,
            foto.RelatorioFotograficoId,
            foto.StorageKey,
            DataFoto = foto.DataFoto?.ToDateTime(TimeOnly.MinValue),
            foto.Descricao,
            foto.Ordem,
            foto.CreatedAt
        });

        return foto;
    }

    private static async Task<IEnumerable<Foto>> GetFotosAsync(System.Data.IDbConnection connection, Guid relatorioId)
    {
        const string sql = @"
            SELECT id, relatorio_fotografico_id AS RelatorioFotograficoId, storage_key AS StorageKey,
                   data_foto AS DataFoto, descricao, ordem, created_at AS CreatedAt
            FROM fotos
            WHERE relatorio_fotografico_id = @RelatorioId
            ORDER BY ordem ASC";

        var rows = await connection.QueryAsync<FotoRow>(sql, new { RelatorioId = relatorioId });
        return rows.Select(r => r.ToEntity());
    }

    private sealed class RelatorioRow
    {
        public Guid Id { get; set; }
        public Guid ObraId { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public Guid? EtapaId { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public DateTime? Competencia { get; set; }
        public DateTime CreatedAt { get; set; }

        public RelatorioFotografico ToEntity() => new()
        {
            Id = Id,
            ObraId = ObraId,
            Tipo = Tipo,
            EtapaId = EtapaId,
            Titulo = Titulo,
            Competencia = Competencia.HasValue ? DateOnly.FromDateTime(Competencia.Value) : null,
            CreatedAt = CreatedAt
        };
    }

    private sealed class FotoRow
    {
        public Guid Id { get; set; }
        public Guid RelatorioFotograficoId { get; set; }
        public string StorageKey { get; set; } = string.Empty;
        public DateTime? DataFoto { get; set; }
        public string? Descricao { get; set; }
        public int Ordem { get; set; }
        public DateTime CreatedAt { get; set; }

        public Foto ToEntity() => new()
        {
            Id = Id,
            RelatorioFotograficoId = RelatorioFotograficoId,
            StorageKey = StorageKey,
            DataFoto = DataFoto.HasValue ? DateOnly.FromDateTime(DataFoto.Value) : null,
            Descricao = Descricao,
            Ordem = Ordem,
            CreatedAt = CreatedAt
        };
    }
}