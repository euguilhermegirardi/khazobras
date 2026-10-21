using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public enum RelatorioMensalWriteStatus
{
    Ok,
    NaoEncontrado,

    /// <summary>O relatorio existe, mas nao esta em rascunho (editar, excluir) ou ja foi publicado (publicar).</summary>
    Conflito,

    /// <summary>Ja existe relatorio da obra para a competencia (UNIQUE obra_id + competencia).</summary>
    CompetenciaDuplicada,

    ObraNaoEncontrada
}

public sealed record RelatorioMensalWriteResult(RelatorioMensalWriteStatus Status, RelatorioMensal? Relatorio);

/// <summary>
/// Todo acesso por id e preso a obra no SQL (<c>WHERE id = @Id AND obra_id = @ObraId</c>). Escritas sao um unico comando
/// condicionado a <c>status = 'draft'</c>, entao editar, publicar e excluir nao correm entre si.
/// </summary>
public interface IRelatorioMensalRepository
{
    /// <summary>Insere em rascunho. <c>ObraNaoEncontrada</c> se a obra nao existir; <c>CompetenciaDuplicada</c> se o mes ja tem relatorio.</summary>
    Task<RelatorioMensalWriteResult> TryCreateAsync(RelatorioMensal relatorio);

    /// <summary>Resolve so a obra do relatorio (query enxuta); o endpoint valida o acesso a ela antes de qualquer outra coisa.</summary>
    Task<Guid?> GetObraIdByIdAsync(Guid id);

    Task<RelatorioMensal?> GetByIdAndObraAsync(Guid id, Guid obraId);

    /// <summary>Visao cliente: filtra status published no SQL (defense in depth).</summary>
    Task<RelatorioMensal?> GetPublishedByIdAndObraAsync(Guid id, Guid obraId);

    Task<IReadOnlyList<RelatorioMensal>> GetByObraIdAsync(Guid obraId);

    /// <summary>Visao cliente: so publicados da obra, filtrados no SQL.</summary>
    Task<IReadOnlyList<RelatorioMensal>> GetPublishedByObraIdAsync(Guid obraId);

    /// <summary>UPDATE condicionado a rascunho. Ok (com o registro), NaoEncontrado, Conflito (publicado) ou CompetenciaDuplicada.</summary>
    Task<RelatorioMensalWriteResult> UpdateDraftAsync(Guid id, Guid obraId, DateOnly competencia, string conteudo, DateTime updatedAt);

    /// <summary>UPDATE condicionado a rascunho (draft para published). Ok (com o registro), NaoEncontrado ou Conflito (ja publicado).</summary>
    Task<RelatorioMensalWriteResult> PublishAsync(Guid id, Guid obraId, DateTime publishedAt);

    /// <summary>DELETE condicionado a rascunho. Ok, NaoEncontrado ou Conflito (publicado).</summary>
    Task<RelatorioMensalWriteStatus> DeleteDraftAsync(Guid id, Guid obraId);
}
