using FluentValidation;
using KhazObras.Application.Dtos.Obras;

namespace KhazObras.Application.Validators;

public sealed class CreateObraRequestValidator : AbstractValidator<CreateObraRequest>
{
    public CreateObraRequestValidator()
    {
        RuleFor(x => x.Nome).NotEmpty().MaximumLength(150);
        RuleFor(x => x.ValorContratado).GreaterThan(0);
    }
}