using FluentValidation;
using KhazObras.Application.Dtos.Etapas;

namespace KhazObras.Application.Validators;

/// <summary>
/// Coerencia status x avanco x datas reais:
/// nao_iniciada = 0% e sem datas reais; em_andamento = 0..99,99% com inicio real e sem fim real;
/// concluida = 100% com inicio e fim reais. 100% so com concluida.
/// </summary>
public sealed class UpdateEtapaRequestValidator : AbstractValidator<UpdateEtapaRequest>
{
    private const string NaoIniciada = "nao_iniciada";
    private const string EmAndamento = "em_andamento";
    private const string Concluida = "concluida";

    public UpdateEtapaRequestValidator()
    {
        RuleFor(x => x.Nome).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Ordem).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PercentualPeso).InclusiveBetween(0, 100);
        RuleFor(x => x.PercentualConcluido).InclusiveBetween(0, 100);

        RuleFor(x => x.Status)
            .Must(s => s == NaoIniciada || s == EmAndamento || s == Concluida)
            .WithMessage("Status deve ser nao_iniciada, em_andamento ou concluida.");

        RuleFor(x => x.DataFimPrevista)
            .GreaterThanOrEqualTo(x => x.DataInicioPrevista!.Value)
            .When(x => x.DataInicioPrevista.HasValue && x.DataFimPrevista.HasValue)
            .WithMessage("DataFimPrevista nao pode ser anterior a DataInicioPrevista.");

        RuleFor(x => x.DataFimReal)
            .GreaterThanOrEqualTo(x => x.DataInicioReal!.Value)
            .When(x => x.DataInicioReal.HasValue && x.DataFimReal.HasValue)
            .WithMessage("DataFimReal nao pode ser anterior a DataInicioReal.");

        // nao_iniciada
        RuleFor(x => x.PercentualConcluido)
            .Equal(0)
            .When(x => x.Status == NaoIniciada)
            .WithMessage("Etapa nao_iniciada deve ter PercentualConcluido = 0.");
        RuleFor(x => x.DataInicioReal)
            .Must(d => !d.HasValue)
            .When(x => x.Status == NaoIniciada)
            .WithMessage("Etapa nao_iniciada nao pode ter DataInicioReal.");
        RuleFor(x => x.DataFimReal)
            .Must(d => !d.HasValue)
            .When(x => x.Status == NaoIniciada)
            .WithMessage("Etapa nao_iniciada nao pode ter DataFimReal.");

        // em_andamento
        RuleFor(x => x.PercentualConcluido)
            .LessThan(100)
            .When(x => x.Status == EmAndamento)
            .WithMessage("PercentualConcluido = 100 exige status concluida.");
        RuleFor(x => x.DataInicioReal)
            .Must(d => d.HasValue)
            .When(x => x.Status == EmAndamento)
            .WithMessage("Etapa em_andamento exige DataInicioReal.");
        RuleFor(x => x.DataFimReal)
            .Must(d => !d.HasValue)
            .When(x => x.Status == EmAndamento)
            .WithMessage("Etapa em_andamento nao pode ter DataFimReal.");

        // concluida
        RuleFor(x => x.PercentualConcluido)
            .Equal(100)
            .When(x => x.Status == Concluida)
            .WithMessage("Etapa concluida deve ter PercentualConcluido = 100.");
        RuleFor(x => x.DataInicioReal)
            .Must(d => d.HasValue)
            .When(x => x.Status == Concluida)
            .WithMessage("Etapa concluida exige DataInicioReal.");
        RuleFor(x => x.DataFimReal)
            .Must(d => d.HasValue)
            .When(x => x.Status == Concluida)
            .WithMessage("Etapa concluida exige DataFimReal.");
    }
}
