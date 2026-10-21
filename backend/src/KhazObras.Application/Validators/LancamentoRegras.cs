using FluentValidation;
using KhazObras.Application.Services;

namespace KhazObras.Application.Validators;

/// <summary>Regras compartilhadas entre criar e editar lancamento (limites das colunas de financeiro_lancamentos).</summary>
internal static class LancamentoRegras
{
    // valor NUMERIC(14,2); descricao VARCHAR(255)
    public const decimal ValorMaximo = 999_999_999_999.99m;

    public static IRuleBuilderOptions<T, string> CategoriaValida<T>(this IRuleBuilder<T, string> rule) =>
        rule.Must(c => FinanceiroCategorias.TryParse(c, out _))
            .WithMessage("Categoria deve ser mao_de_obra, material ou equipamento.");

    public static IRuleBuilderOptions<T, string> DescricaoValida<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().MaximumLength(255);

    public static IRuleBuilderOptions<T, decimal> ValorValido<T>(this IRuleBuilder<T, decimal> rule) =>
        rule.GreaterThan(0)
            .LessThanOrEqualTo(ValorMaximo).WithMessage("O valor excede o limite permitido.")
            .Must(v => decimal.Round(v, 2) == v).WithMessage("O valor aceita no maximo 2 casas decimais.");

    public static IRuleBuilderOptions<T, DateOnly> DataValida<T>(this IRuleBuilder<T, DateOnly> rule) =>
        rule.Must(d => d.Year is >= 2000 and <= 2100)
            .WithMessage("A data deve estar entre os anos 2000 e 2100.");
}
