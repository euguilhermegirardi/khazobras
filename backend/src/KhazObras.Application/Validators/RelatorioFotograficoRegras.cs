using FluentValidation;

namespace KhazObras.Application.Validators;

/// <summary>Regras compartilhadas entre criar e editar relatorio fotografico (colunas de relatorios_fotograficos).</summary>
internal static class RelatorioFotograficoRegras
{
    public static IRuleBuilderOptions<T, string> TipoValido<T>(this IRuleBuilder<T, string> rule) =>
        rule.Must(t =>
                string.Equals(t, "mensal", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(t, "etapa", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Tipo deve ser mensal ou etapa.");

    // titulo VARCHAR(150)
    public static IRuleBuilderOptions<T, string> TituloValido<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty().MaximumLength(150);

    // competencia DATE: evita ano absurdo (2000-2100, como Medicoes/Contratos/Financeiro).
    public static IRuleBuilderOptions<T, DateOnly?> CompetenciaValida<T>(this IRuleBuilder<T, DateOnly?> rule) =>
        rule.Must(c => c is null || c.Value.Year is >= 2000 and <= 2100)
            .WithMessage("A competencia deve estar entre os anos 2000 e 2100.");
}
