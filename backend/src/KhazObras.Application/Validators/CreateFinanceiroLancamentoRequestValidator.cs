using FluentValidation;
using KhazObras.Application.Dtos.Financeiro;

namespace KhazObras.Application.Validators;

public sealed class CreateFinanceiroLancamentoRequestValidator : AbstractValidator<CreateFinanceiroLancamentoRequest>
{
    public CreateFinanceiroLancamentoRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.Categoria).Must(c =>
            string.Equals(c, "mao_de_obra", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(c, "material", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(c, "equipamento", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Categoria deve ser mao_de_obra, material ou equipamento.");
        RuleFor(x => x.Descricao).NotEmpty().MaximumLength(255);
        RuleFor(x => x.Valor).GreaterThan(0);
    }
}