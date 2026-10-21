using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface IFinanceiroLancamentoRepository
{
    Task<FinanceiroLancamento> CreateAsync(FinanceiroLancamento lancamento);

    /// <summary>
    /// Lista de uma obra, mais recente primeiro. <paramref name="somenteVisiveisCliente"/> (visao do cliente) e
    /// <paramref name="filtro"/> (filtros da tela admin) sao aplicados no SQL, na contagem e nos itens.
    /// </summary>
    Task<(IReadOnlyList<FinanceiroLancamento> Items, int TotalItems)> GetPagedByObraIdAsync(
        Guid obraId, int pageIndex, int pageSize, bool somenteVisiveisCliente = false, FinanceiroFiltro? filtro = null);

    /// <summary>Agregado SQL da obra (WHERE obra_id). Custo real: so para Admin/Master.</summary>
    Task<FinanceiroResumo> GetResumoByObraIdAsync(Guid obraId);

    Task<Guid?> GetObraIdByIdAsync(Guid id);
    Task<FinanceiroLancamento?> GetByIdAndObraAsync(Guid id, Guid obraId, bool somenteVisiveisCliente);

    /// <summary>UPDATE ... WHERE id AND obra_id (nao altera obra, autor nem data de criacao); false se nenhum lancamento dessa obra tem o id.</summary>
    Task<bool> UpdateAsync(FinanceiroLancamento lancamento);

    /// <summary>
    /// DELETE ... WHERE id AND obra_id (anexos saem por ON DELETE CASCADE). Devolve as chaves de storage dos anexos
    /// removidos, ou null se nenhum lancamento dessa obra tem o id.
    /// </summary>
    Task<IReadOnlyList<string>?> DeleteAsync(Guid id, Guid obraId);

    /// <summary>UPDATE preso a obra; devolve false se nenhum lancamento dessa obra tem o id.</summary>
    Task<bool> SetVisibilidadeClienteAsync(Guid id, Guid obraId, bool visivelCliente);

    /// <summary>
    /// Tudo-ou-nada: so altera se TODOS os ids (distintos) pertencem a obra; senao devolve null sem alterar nada.
    /// Devolve, por id, o valor de visibilidade que havia ANTES.
    /// </summary>
    Task<IReadOnlyList<(Guid Id, bool VisivelAnterior)>?> SetVisibilidadeLoteAsync(Guid obraId, IReadOnlyList<Guid> ids, bool visivelCliente);

    /// <summary>INSERT preso a obra e ao limite de anexos por lancamento; false se o lancamento nao e da obra ou o limite foi atingido.</summary>
    Task<bool> TryAddAnexoAsync(FinanceiroLancamentoAnexo anexo, Guid obraId, int maxAnexos);

    Task<Guid?> GetObraIdByAnexoIdAsync(Guid anexoId);
    Task<FinanceiroLancamentoAnexo?> GetAnexoByIdAndObraAsync(Guid anexoId, Guid obraId, bool somenteVisiveisCliente);

    /// <summary>DELETE preso a obra; devolve o anexo removido (com a chave do storage) ou null se nao e dessa obra.</summary>
    Task<FinanceiroLancamentoAnexo?> DeleteAnexoAsync(Guid anexoId, Guid obraId);
}
