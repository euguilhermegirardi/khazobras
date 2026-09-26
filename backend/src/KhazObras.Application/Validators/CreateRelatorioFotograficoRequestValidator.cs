using FluentValidation;
using KhazObras.Application.Dtos.RelatoriosFotograficos;

namespace KhazObras.Application.Validators;

public sealed class CreateRelatorioFotograficoRequestValidator : AbstractValidator<CreateRelatorioFotograficoRequest>
{
    public CreateRelatorioFotograficoRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.Tipo).Must(t =>
            t.Equals("mensal", StringComparison.OrdinalIgnoreCase) ||
            t.Equals("etapa", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Tipo deve ser mensal ou etapa.");
        RuleFor(x => x.Titulo).NotEmpty().MaximumLength(150);
    }
}