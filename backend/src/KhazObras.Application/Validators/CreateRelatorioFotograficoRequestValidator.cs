using FluentValidation;
using KhazObras.Application.Dtos.RelatoriosFotograficos;

namespace KhazObras.Application.Validators;

public sealed class CreateRelatorioFotograficoRequestValidator : AbstractValidator<CreateRelatorioFotograficoRequest>
{
    public CreateRelatorioFotograficoRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.Tipo).TipoValido();
        RuleFor(x => x.Titulo).TituloValido();
        RuleFor(x => x.Competencia).CompetenciaValida();
    }
}
