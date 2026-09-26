using FluentValidation;
using KhazObras.Application.Dtos.RelatoriosMensais;

namespace KhazObras.Application.Validators;

public sealed class CreateRelatorioMensalRequestValidator : AbstractValidator<CreateRelatorioMensalRequest>
{
    public CreateRelatorioMensalRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.Conteudo).NotEmpty();
    }
}