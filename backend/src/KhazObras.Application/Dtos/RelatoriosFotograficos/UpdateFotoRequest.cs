namespace KhazObras.Application.Dtos.RelatoriosFotograficos;

/// <summary>
/// PATCH parcial de uma foto. Cada campo so e alterado se foi enviado no JSON (<c>*Informada</c>); enviar
/// <c>descricao</c>/<c>dataFoto</c> como null limpa o valor. Montado por <see cref="UpdateFotoRequestParser"/>.
/// </summary>
public sealed record UpdateFotoRequest(
    bool DescricaoInformada,
    string? Descricao,
    bool DataFotoInformada,
    DateOnly? DataFoto,
    bool OrdemInformada,
    int Ordem);
