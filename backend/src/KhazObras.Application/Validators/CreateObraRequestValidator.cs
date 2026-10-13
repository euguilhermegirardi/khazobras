using FluentValidation;
using KhazObras.Application.Dtos.Obras;

namespace KhazObras.Application.Validators;

public sealed class CreateObraRequestValidator : AbstractValidator<CreateObraRequest>
{
    public CreateObraRequestValidator()
    {
        RuleFor(x => x.Nome).NotEmpty().MaximumLength(150);
        RuleFor(x => x.ValorContratado).GreaterThan(0);
        RuleFor(x => x.DataPrevisaoTermino)
            .GreaterThanOrEqualTo(x => x.DataInicio!.Value)
            .When(x => x.DataInicio.HasValue && x.DataPrevisaoTermino.HasValue)
            .WithMessage("DataPrevisaoTermino nao pode ser anterior a DataInicio.");
    }
}