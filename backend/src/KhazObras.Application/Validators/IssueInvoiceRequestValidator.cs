using FluentValidation;
using KhazObras.Application.Dtos.Medicoes;

namespace KhazObras.Application.Validators;

public sealed class IssueInvoiceRequestValidator : AbstractValidator<IssueInvoiceRequest>
{
    // medicoes.nf_number VARCHAR(50)
    private const int TamanhoMaximo = 50;

    public IssueInvoiceRequestValidator()
    {
        RuleFor(x => x.NfNumber)
            .NotEmpty().WithMessage("Informe o numero da nota fiscal.")
            .MaximumLength(TamanhoMaximo).WithMessage($"O numero da nota fiscal aceita no maximo {TamanhoMaximo} caracteres.")
            .Must(n => n is null || !n.Any(char.IsControl)).WithMessage("O numero da nota fiscal contem caracteres invalidos.");
    }
}
