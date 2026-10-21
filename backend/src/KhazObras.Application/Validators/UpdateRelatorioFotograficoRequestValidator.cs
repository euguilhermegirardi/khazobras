using FluentValidation;
using KhazObras.Application.Dtos.RelatoriosFotograficos;

namespace KhazObras.Application.Validators;

public sealed class UpdateRelatorioFotograficoRequestValidator : AbstractValidator<UpdateRelatorioFotograficoRequest>
{
    public UpdateRelatorioFotograficoRequestValidator()
    {
        RuleFor(x => x.Tipo).TipoValido();
        RuleFor(x => x.Titulo).TituloValido();
        RuleFor(x => x.Competencia).CompetenciaValida();
    }
}
