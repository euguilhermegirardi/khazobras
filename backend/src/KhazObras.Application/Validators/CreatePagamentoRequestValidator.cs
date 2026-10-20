using FluentValidation;
using KhazObras.Application.Dtos.Contratos;

namespace KhazObras.Application.Validators;

public sealed class CreatePagamentoRequestValidator : AbstractValidator<CreatePagamentoRequest>
{
    // pagamentos.valor NUMERIC(14,2); pagamentos.forma_pagamento VARCHAR(50)
    private const decimal ValorMaximo = 999_999_999_999.99m;
    private const int FormaMaxima = 50;

    // Pagamento ja recebido: aceita ate hoje + 1 dia (folga para fuso/relogio; o servidor usa UTC).
    // Data futura alem disso e erro de digitacao. Piso: 2000 (mesmo intervalo das demais datas do sistema).
    private const int DiasDeFolgaNoFuturo = 1;

    public CreatePagamentoRequestValidator()
    {
        RuleFor(x => x.Valor)
            .GreaterThan(0).WithMessage("O valor do pagamento deve ser maior que zero.")
            .LessThanOrEqualTo(ValorMaximo).WithMessage("O valor do pagamento excede o limite permitido.")
            .Must(v => decimal.Round(v, 2) == v).WithMessage("O valor do pagamento aceita no maximo 2 casas decimais.");

        RuleFor(x => x.DataPagamento)
            .Must(d => d.Year >= 2000).WithMessage("Informe a data do pagamento (a partir do ano 2000).")
            .Must(d => d <= DateOnly.FromDateTime(DateTime.UtcNow).AddDays(DiasDeFolgaNoFuturo))
            .WithMessage("A data do pagamento nao pode ser futura.");

        RuleFor(x => x.FormaPagamento)
            .MaximumLength(FormaMaxima).WithMessage($"A forma de pagamento aceita no maximo {FormaMaxima} caracteres.")
            .Must(f => f is null || !f.Any(char.IsControl)).WithMessage("A forma de pagamento contem caracteres invalidos.");

        RuleFor(x => x.ReferenteMedicaoId)
            .Must(id => id != Guid.Empty)
            .When(x => x.ReferenteMedicaoId.HasValue)
            .WithMessage("ReferenteMedicaoId invalido.");
    }
}
