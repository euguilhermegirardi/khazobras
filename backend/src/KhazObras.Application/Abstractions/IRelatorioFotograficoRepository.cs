using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public enum FotoInsertResult
{
    Added,
    RelatorioNaoEncontrado,
    LimiteExcedido
}

public interface IRelatorioFotograficoRepository
{
    Task<RelatorioFotografico> CreateAsync(RelatorioFotografico relatorio);

    /// <summary>Query enxuta: so a obra do relatorio (o endpoint valida o acesso a ela antes de ler/gravar).</summary>
    Task<Guid?> GetObraIdByIdAsync(Guid id);

    /// <summary>Relatorio (com fotos em ordem estavel) preso a obra: <c>WHERE id AND obra_id</c>.</summary>
    Task<RelatorioFotografico?> GetByIdAndObraAsync(Guid id, Guid obraId);

    Task<IReadOnlyList<RelatorioFotografico>> GetByObraIdAsync(Guid obraId);

    /// <summary>Atualiza tipo/etapa/titulo/competencia presos a obra. Devolve false se nenhuma linha foi afetada.</summary>
    Task<bool> UpdateAsync(RelatorioFotografico relatorio);

    /// <summary>Apaga o relatorio (fotos saem por CASCADE) preso a obra. Devolve as chaves do storage, ou null se nao existir nessa obra.</summary>
    Task<IReadOnlyList<string>?> DeleteAsync(Guid id, Guid obraId);

    /// <summary>Quantidade de fotos do relatorio dessa obra, ou null se o relatorio nao existir nela.</summary>
    Task<int?> CountFotosAsync(Guid relatorioId, Guid obraId);

    /// <summary>
    /// Insere a foto numa transacao que trava a linha do relatorio (<c>FOR UPDATE</c>): uploads simultaneos se enfileiram e o
    /// limite nao estoura. Com <paramref name="ordemNoFim"/>, a ordem vira (maior ordem + 1) e e gravada em <c>foto.Ordem</c>.
    /// </summary>
    Task<FotoInsertResult> TryAddFotoAsync(Foto foto, Guid obraId, int maxFotos, bool ordemNoFim);

    Task<Guid?> GetObraIdByFotoIdAsync(Guid fotoId);
    Task<Foto?> GetFotoByIdAndObraAsync(Guid fotoId, Guid obraId);

    /// <summary>Altera so os campos informados, preso a obra. Devolve a foto atualizada ou null se nao existir nessa obra.</summary>
    Task<Foto?> UpdateFotoAsync(Guid fotoId, Guid obraId, UpdateFotoRequest patch);

    /// <summary>Apaga a foto presa a obra e devolve a linha apagada (para limpar o storage), ou null se nao existir nessa obra.</summary>
    Task<Foto?> DeleteFotoAsync(Guid fotoId, Guid obraId);

    /// <summary>
    /// Tudo-ou-nada, numa transacao com o relatorio travado: todas as fotos precisam ser desse relatorio (e dessa obra);
    /// senao nada muda e devolve false.
    /// </summary>
    Task<bool> ReordenarFotosAsync(Guid relatorioId, Guid obraId, IReadOnlyList<(Guid Id, int Ordem)> itens);
}
