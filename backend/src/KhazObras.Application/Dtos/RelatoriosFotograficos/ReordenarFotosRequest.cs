namespace KhazObras.Application.Dtos.RelatoriosFotograficos;

public sealed record FotoOrdemItem(Guid Id, int Ordem);

/// <summary>Reordenacao em lote: nova <c>ordem</c> de cada foto citada (as nao citadas ficam como estao).</summary>
public sealed record ReordenarFotosRequest(List<FotoOrdemItem> Fotos);
