using FluentValidation;
using KhazObras.Application.Dtos.Financeiro;

namespace KhazObras.Application.Validators;

public sealed class CreateFinanceiroLancamentoRequestValidator : AbstractValidator<CreateFinanceiroLancamentoRequest>
{
    public CreateFinanceiroLancamentoRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.Categoria).Must(c =>
            c.Equals("mao_de_obra", StringComparison.OrdinalIgnoreCase) ||
            c.Equals("material", StringComparison.OrdinalIgnoreCase) ||
            c.Equals("equipamento", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Categoria deve ser mao_de_obra, material ou equipamento.");
        RuleFor(x => x.Descricao).NotEmpty().MaximumLength(255);
        RuleFor(x => x.Valor).GreaterThan(0);
    }
}