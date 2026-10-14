using FluentValidation;
using KhazObras.Application.Dtos.Medicoes;

namespace KhazObras.Application.Validators;

public sealed class CreateMedicaoRequestValidator : AbstractValidator<CreateMedicaoRequest>
{
    public CreateMedicaoRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.Numero).GreaterThan(0);
        RuleFor(x => x.Itens).NotEmpty().WithMessage("A medicao precisa de pelo menos um item.");

        RuleForEach(x => x.Itens).ChildRules(item =>
        {
            item.RuleFor(i => i.Tipo).Must(t =>
                string.Equals(t, "mao_de_obra", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(t, "material", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(t, "equipamento", StringComparison.OrdinalIgnoreCase))
                .WithMessage("Tipo deve ser mao_de_obra, material ou equipamento.");
            item.RuleFor(i => i.Descricao).NotEmpty();
            item.RuleFor(i => i.Quantidade).GreaterThan(0);
            item.RuleFor(i => i.ValorUnitario).GreaterThan(0);
        });
    }
}