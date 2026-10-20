using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Domain.Enums;

namespace KhazObras.Application.Services;

/// <summary>
/// Categorias aceitas num lancamento: hoje sao o enum <c>item_tipo</c> do Postgres (a tabela <c>categorias</c> do
/// schema ainda nao e usada pelo financeiro; <c>categoria_id</c> fica nulo). O POST/PUT aceitam o valor em snake_case
/// (ou o PascalCase que a API devolve, sem diferenciar maiusculas); as respostas trazem o PascalCase do enum.
/// </summary>
public static class FinanceiroCategorias
{
    public static IReadOnlyList<FinanceiroCategoriaResponse> Todas { get; } =
    [
        new("mao_de_obra", "Mão de obra"),
        new("material", "Material"),
        new("equipamento", "Equipamento")
    ];

    public static bool TryParse(string? valor, out ItemTipo categoria)
    {
        switch (valor?.Trim().ToLowerInvariant())
        {
            case "mao_de_obra" or "maodeobra":
                categoria = ItemTipo.MaoDeObra;
                return true;
            case "material":
                categoria = ItemTipo.Material;
                return true;
            case "equipamento":
                categoria = ItemTipo.Equipamento;
                return true;
            default:
                categoria = default;
                return false;
        }
    }
}
