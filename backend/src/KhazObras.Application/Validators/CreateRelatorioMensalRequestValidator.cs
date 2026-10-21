using FluentValidation;
using KhazObras.Application.Dtos.RelatoriosMensais;
using KhazObras.Application.Services;

namespace KhazObras.Application.Validators;

public sealed class CreateRelatorioMensalRequestValidator : AbstractValidator<CreateRelatorioMensalRequest>
{
    public CreateRelatorioMensalRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.Competencia).CompetenciaDoRelatorio();
        RuleFor(x => x.Conteudo).ConteudoDoRelatorio();
    }
}

public sealed class UpdateRelatorioMensalRequestValidator : AbstractValidator<UpdateRelatorioMensalRequest>
{
    public UpdateRelatorioMensalRequestValidator()
    {
        RuleFor(x => x.Competencia).CompetenciaDoRelatorio();
        RuleFor(x => x.Conteudo).ConteudoDoRelatorio();
    }
}

/// <summary>Regras compartilhadas entre criar e editar o relatorio mensal.</summary>
internal static class RelatorioMensalRegrasDeCampo
{
    public static IRuleBuilderOptions<T, DateOnly> CompetenciaDoRelatorio<T>(this IRuleBuilder<T, DateOnly> rule) =>
        rule.Must(competencia => RelatorioMensalRegras.CompetenciaValida(competencia))
            .WithMessage("A competencia deve estar entre os anos 2000 e 2100.");

    // Recebe o IRuleBuilderInitial (retorno de RuleFor) porque so ele tem Cascade.
    public static IRuleBuilderOptions<T, string> ConteudoDoRelatorio<T>(this IRuleBuilderInitial<T, string> rule) =>
        rule.Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Informe o conteudo do relatorio.")
            .MaximumLength(RelatorioMensalRegras.MaxConteudo)
            .WithMessage($"O conteudo deve ter no maximo {RelatorioMensalRegras.MaxConteudo} caracteres.")
            .Must(conteudo => RelatorioMensalRegras.ConteudoSemCaracteresInvalidos(conteudo))
            .WithMessage("O conteudo nao pode conter caracteres de controle nem de direcao do texto.");
}
