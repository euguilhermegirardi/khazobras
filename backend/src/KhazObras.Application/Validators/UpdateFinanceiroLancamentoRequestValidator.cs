using FluentValidation;
using KhazObras.Application.Dtos.Financeiro;

namespace KhazObras.Application.Validators;

public sealed class UpdateFinanceiroLancamentoRequestValidator : AbstractValidator<UpdateFinanceiroLancamentoRequest>
{
    public UpdateFinanceiroLancamentoRequestValidator()
    {
        RuleFor(x => x.Categoria).CategoriaValida();
        RuleFor(x => x.Descricao).DescricaoValida();
        RuleFor(x => x.Valor).ValorValido();
        RuleFor(x => x.DataLancamento).DataValida();
        RuleFor(x => x.MesCompetencia).DataValida();
    }
}
