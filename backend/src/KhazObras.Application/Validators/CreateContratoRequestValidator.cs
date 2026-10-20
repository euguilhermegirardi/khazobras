using FluentValidation;
using KhazObras.Application.Dtos.Contratos;

namespace KhazObras.Application.Validators;

public sealed class CreateContratoRequestValidator : AbstractValidator<CreateContratoRequest>
{
    // contratos.numero VARCHAR(50); contratos.valor_contratado NUMERIC(14,2)
    private const int NumeroMaximo = 50;
    private const decimal ValorMaximo = 999_999_999_999.99m;

    public CreateContratoRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();

        RuleFor(x => x.Numero)
            .NotEmpty().WithMessage("Informe o numero do contrato.")
            .MaximumLength(NumeroMaximo).WithMessage($"O numero do contrato aceita no maximo {NumeroMaximo} caracteres.")
            .Must(n => n is null || !n.Any(char.IsControl)).WithMessage("O numero do contrato contem caracteres invalidos.");

        RuleFor(x => x.ValorContratado)
            .GreaterThan(0).WithMessage("O valor contratado deve ser maior que zero.")
            .LessThanOrEqualTo(ValorMaximo).WithMessage("O valor contratado excede o limite permitido.")
            .Must(v => decimal.Round(v, 2) == v).WithMessage("O valor contratado aceita no maximo 2 casas decimais.");

        RuleFor(x => x.DataAssinatura)
            .Must(d => d!.Value.Year is >= 2000 and <= 2100)
            .When(x => x.DataAssinatura.HasValue)
            .WithMessage("A data de assinatura deve estar entre 2000 e 2100.");
    }
}
