using FluentValidation;
using KhazObras.Application.Dtos.Financeiro;

namespace KhazObras.Application.Validators;

public sealed class UpdateVisibilidadeLoteRequestValidator : AbstractValidator<UpdateVisibilidadeLoteRequest>
{
    public const int MaximoIds = 200;

    public UpdateVisibilidadeLoteRequestValidator()
    {
        RuleFor(x => x.Ids)
            .NotEmpty().WithMessage("Informe ao menos um lancamento.")
            .Must(ids => ids is null || ids.Count <= MaximoIds)
            .WithMessage($"Informe no maximo {MaximoIds} lancamentos por vez.")
            .Must(ids => ids is null || ids.All(id => id != Guid.Empty))
            .WithMessage("Ha ids invalidos na lista.");
    }
}
