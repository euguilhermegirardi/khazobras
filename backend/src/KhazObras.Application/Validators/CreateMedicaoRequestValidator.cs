using FluentValidation;
using KhazObras.Application.Dtos.Medicoes;

namespace KhazObras.Application.Validators;

public sealed class CreateMedicaoRequestValidator : AbstractValidator<CreateMedicaoRequest>
{
    // Limites das colunas: quantidade NUMERIC(12,2), valor_unitario e valor_total NUMERIC(14,2).
    private const decimal QuantidadeMaxima = 9_999_999_999.99m;
    private const decimal ValorMaximo = 999_999_999_999.99m;
    private const int MaximoItens = 200;

    public CreateMedicaoRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.EtapaId)
            .Must(id => id != Guid.Empty)
            .When(x => x.EtapaId.HasValue)
            .WithMessage("EtapaId invalido.");
        RuleFor(x => x.Numero).GreaterThan(0).LessThanOrEqualTo(100_000);
        RuleFor(x => x.Competencia)
            .Must(c => c.Year is >= 2000 and <= 2100)
            .WithMessage("Competencia deve ser uma data entre 2000 e 2100.");
        RuleFor(x => x.Itens)
            .NotEmpty().WithMessage("A medicao precisa de pelo menos um item.")
            .Must(itens => itens is null || itens.Count <= MaximoItens)
            .WithMessage($"A medicao aceita no maximo {MaximoItens} itens.");

        RuleForEach(x => x.Itens).NotNull().WithMessage("Item da medicao nao pode ser nulo.");
        RuleForEach(x => x.Itens).ChildRules(item =>
        {
            item.RuleFor(i => i.Tipo).Must(t =>
                string.Equals(t, "mao_de_obra", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(t, "material", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(t, "equipamento", StringComparison.OrdinalIgnoreCase))
                .WithMessage("Tipo deve ser mao_de_obra, material ou equipamento.");
            item.RuleFor(i => i.Descricao).NotEmpty().MaximumLength(255);
            item.RuleFor(i => i.Quantidade)
                .GreaterThan(0)
                .LessThanOrEqualTo(QuantidadeMaxima)
                .Must(TemNoMaximoDuasCasas).WithMessage("Quantidade aceita no maximo 2 casas decimais.");
            item.RuleFor(i => i.ValorUnitario)
                .GreaterThanOrEqualTo(0)
                .LessThanOrEqualTo(ValorMaximo)
                .Must(TemNoMaximoDuasCasas).WithMessage("Valor unitario aceita no maximo 2 casas decimais.");
        });

        // O total de cada item (quantidade x valor unitario) e da medicao e calculado no servidor; aqui so
        // garante que a soma cabe na coluna valor_total (senao o INSERT estouraria com 500).
        RuleFor(x => x.Itens)
            .Must(itens => SomaDosTotais(itens) <= ValorMaximo)
            .WithMessage("O valor total da medicao excede o limite permitido.")
            .When(x => x.Itens is { Count: > 0 and <= MaximoItens });
    }

    private static bool TemNoMaximoDuasCasas(decimal valor) => decimal.Round(valor, 2) == valor;

    private static decimal SomaDosTotais(List<CreateMedicaoItemRequest> itens) =>
        itens.Where(i => i is not null && i.Quantidade > 0 && i.Quantidade <= QuantidadeMaxima
                         && i.ValorUnitario >= 0 && i.ValorUnitario <= ValorMaximo)
            .Sum(i => Math.Round(i.Quantidade * i.ValorUnitario, 2, MidpointRounding.AwayFromZero));
}
