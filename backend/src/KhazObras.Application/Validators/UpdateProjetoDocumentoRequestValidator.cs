using FluentValidation;
using KhazObras.Application.Dtos.ProjetosDocumentos;
using KhazObras.Application.Services;

namespace KhazObras.Application.Validators;

public sealed class UpdateProjetoDocumentoRequestValidator : AbstractValidator<UpdateProjetoDocumentoRequest>
{
    public UpdateProjetoDocumentoRequestValidator()
    {
        RuleFor(x => x.Nome)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Informe o nome do documento.")
            .MaximumLength(ProjetoRegras.MaxNomeArquivo)
            .Must(nome => ProjetoRegras.NomeSemCaracteresInvalidos(nome))
            .WithMessage("O nome nao pode conter barras nem caracteres de controle.");

        RuleFor(x => x.TipoDocumento)
            .Must(tipo => ProjetoRegras.TipoDocumentoValido(tipo))
            .WithMessage($"O tipo do documento deve ter no maximo {ProjetoRegras.MaxTipoDocumento} caracteres, sem caracteres de controle.");
    }
}
