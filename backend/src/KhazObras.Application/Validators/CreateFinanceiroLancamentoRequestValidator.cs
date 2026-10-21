using FluentValidation;
using KhazObras.Application.Dtos.Financeiro;

namespace KhazObras.Application.Validators;

public sealed class CreateFinanceiroLancamentoRequestValidator : AbstractValidator<CreateFinanceiroLancamentoRequest>
{
    public CreateFinanceiroLancamentoRequestValidator()
    {
        RuleFor(x => x.ObraId).NotEmpty();
        RuleFor(x => x.Categoria).CategoriaValida();
        RuleFor(x => x.Descricao).DescricaoValida();
        RuleFor(x => x.Valor).ValorValido();
        RuleFor(x => x.DataLancamento).DataValida();
        RuleFor(x => x.MesCompetencia).DataValida();
    }
}
