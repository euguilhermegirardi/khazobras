using FluentValidation;
using KhazObras.Application.Dtos.Users;

namespace KhazObras.Application.Validators;

public sealed class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress().WithMessage("E-mail invalido.")
            .MaximumLength(255);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8).WithMessage("Senha deve ter no minimo 8 caracteres.")
            .Matches("[A-Z]").WithMessage("Senha deve conter ao menos uma letra maiuscula.")
            .Matches("[a-z]").WithMessage("Senha deve conter ao menos uma letra minuscula.")
            .Matches("[0-9]").WithMessage("Senha deve conter ao menos um numero.");

        RuleFor(x => x.Role)
            .Must(r =>
                r.Equals("master", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("admin", StringComparison.OrdinalIgnoreCase) ||
                r.Equals("client", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Role deve ser master, admin ou client.");
    }
}