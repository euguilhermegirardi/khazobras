using FluentValidation;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Application.Services;

namespace KhazObras.Application.Validators;

public sealed class ReordenarFotosRequestValidator : AbstractValidator<ReordenarFotosRequest>
{
    public ReordenarFotosRequestValidator()
    {
        RuleFor(x => x.Fotos)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Informe ao menos uma foto.")
            .Must(fotos => fotos.Count <= FotoRegras.MaxFotosNoLote)
            .WithMessage($"Informe no maximo {FotoRegras.MaxFotosNoLote} fotos por vez.")
            .Must(fotos => fotos.All(f => f is not null && f.Id != Guid.Empty))
            .WithMessage("Ha ids invalidos na lista.")
            .Must(fotos => fotos.Select(f => f.Id).Distinct().Count() == fotos.Count)
            .WithMessage("Ha fotos repetidas na lista.")
            .Must(fotos => fotos.All(f => f.Ordem >= 0 && f.Ordem <= FotoRegras.OrdemMaxima))
            .WithMessage($"A ordem deve estar entre 0 e {FotoRegras.OrdemMaxima}.");
    }
}
