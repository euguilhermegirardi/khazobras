using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public enum ProjetoInsertResult
{
    Added,
    ObraNaoEncontrada,
    LimiteExcedido
}

public interface IProjetoDocumentoRepository
{
    /// <summary>
    /// Quantidade de documentos da obra, ou null se a obra nao existir. Pre-checagem barata antes do R2; o limite de verdade
    /// e conferido em <see cref="TryAddAsync"/>.
    /// </summary>
    Task<int?> CountByObraAsync(Guid obraId);

    /// <summary>
    /// Insere o documento numa transacao que trava a linha da obra, conta e so entao grava (uploads simultaneos da mesma
    /// obra se enfileiram, entao o limite nao estoura).
    /// </summary>
    Task<ProjetoInsertResult> TryAddAsync(ProjetoDocumento documento, int maxDocumentos);

    /// <summary>Resolve so o obra_id do documento (query enxuta) para o endpoint validar o acesso antes de ler/gravar.</summary>
    Task<Guid?> GetObraIdByIdAsync(Guid id);

    Task<ProjetoDocumento?> GetByIdAndObraAsync(Guid id, Guid obraId);
    Task<IReadOnlyList<ProjetoDocumento>> GetByObraIdAsync(Guid obraId);

    /// <summary>Atualiza nome, tipo e etapa presos a obra (WHERE id AND obra_id). Devolve o documento atualizado ou null.</summary>
    Task<ProjetoDocumento?> UpdateAsync(Guid id, Guid obraId, string nome, string? tipoDocumento, Guid? etapaId);

    /// <summary>
    /// Apaga o documento preso a obra (WHERE id AND obra_id) e devolve a linha apagada (com a chave do R2) ou null.
    /// A chave nunca muda depois do upload, entao o DELETE ... RETURNING e atomico; se um dia houver substituicao de
    /// arquivo, travar a linha (FOR UPDATE) antes de ler a chave.
    /// </summary>
    Task<ProjetoDocumento?> DeleteAsync(Guid id, Guid obraId);
}
