using FluentValidation;
using KhazObras.Application.Dtos.Etapas;

namespace KhazObras.Application.Validators;

public sealed class CreateEtapaRequestValidator : AbstractValidator<CreateEtapaRequest>
{
    public CreateEtapaRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.Nome).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Ordem).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PercentualPeso).InclusiveBetween(0, 100);
    }
}