using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Application.Services;
using KhazObras.Application.Validators;
using KhazObras.Domain.Enums;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>Validators e parsers do financeiro admin (edicao, lote, categorias e filtros da lista).</summary>
public sealed class FinanceiroValidatorTests
{
    private static readonly DateOnly Hoje = DateOnly.FromDateTime(DateTime.UtcNow);

    private static UpdateFinanceiroLancamentoRequest Edicao(
        string categoria = "material", string descricao = "Cimento", decimal valor = 100m, DateOnly? data = null, DateOnly? mes = null) =>
        new(categoria, descricao, valor, data ?? Hoje, mes ?? Hoje);

    [Fact]
    public void Edicao_valida_passa()
    {
        Assert.True(new UpdateFinanceiroLancamentoRequestValidator().Validate(Edicao()).IsValid);
    }

    [Theory]
    [InlineData("mao_de_obra")]
    [InlineData("MaoDeObra")]
    [InlineData("EQUIPAMENTO")]
    public void Edicao_aceita_categoria_em_snake_ou_pascal_case(string categoria)
    {
        Assert.True(new UpdateFinanceiroLancamentoRequestValidator().Validate(Edicao(categoria: categoria)).IsValid);
    }

    [Fact]
    public void Edicao_sem_campos_de_texto_e_invalida_sem_lancar_excecao()
    {
        var request = new UpdateFinanceiroLancamentoRequest(null!, null!, 10m, Hoje, Hoje);

        var result = new UpdateFinanceiroLancamentoRequestValidator().Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Categoria");
        Assert.Contains(result.Errors, e => e.PropertyName == "Descricao");
    }

    [Theory]
    [InlineData("servico", "Cimento", 10, 2026)]
    [InlineData("material", "", 10, 2026)]
    [InlineData("material", "Cimento", 0, 2026)]
    [InlineData("material", "Cimento", -1, 2026)]
    [InlineData("material", "Cimento", 10, 1999)]
    [InlineData("material", "Cimento", 10, 2101)]
    public void Edicao_invalida_falha(string categoria, string descricao, int valor, int ano)
    {
        var data = new DateOnly(ano, 6, 1);

        var result = new UpdateFinanceiroLancamentoRequestValidator().Validate(Edicao(categoria, descricao, valor, data, data));

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("10.001")]
    [InlineData("1000000000000")]
    public void Valor_deve_caber_em_numeric_14_2(string valor)
    {
        var edicao = new UpdateFinanceiroLancamentoRequestValidator().Validate(Edicao(valor: decimal.Parse(valor, System.Globalization.CultureInfo.InvariantCulture)));
        var criacao = new CreateFinanceiroLancamentoRequestValidator().Validate(new CreateFinanceiroLancamentoRequest(
            Guid.NewGuid(), "material", "Cimento", decimal.Parse(valor, System.Globalization.CultureInfo.InvariantCulture), Hoje, Hoje));

        Assert.False(edicao.IsValid);
        Assert.False(criacao.IsValid);
    }

    [Fact]
    public void Valor_maximo_da_coluna_e_aceito()
    {
        Assert.True(new UpdateFinanceiroLancamentoRequestValidator().Validate(Edicao(valor: 999_999_999_999.99m)).IsValid);
    }

    [Fact]
    public void Lote_aceita_de_1_a_200_ids_e_recusa_vazio_nulo_201_e_guid_vazio()
    {
        var validator = new UpdateVisibilidadeLoteRequestValidator();

        Assert.True(validator.Validate(new UpdateVisibilidadeLoteRequest([Guid.NewGuid()], true)).IsValid);
        Assert.True(validator.Validate(new UpdateVisibilidadeLoteRequest(Enumerable.Range(0, 200).Select(_ => Guid.NewGuid()).ToList(), false)).IsValid);
        Assert.False(validator.Validate(new UpdateVisibilidadeLoteRequest([], true)).IsValid);
        Assert.False(validator.Validate(new UpdateVisibilidadeLoteRequest(null!, true)).IsValid);
        Assert.False(validator.Validate(new UpdateVisibilidadeLoteRequest(Enumerable.Range(0, 201).Select(_ => Guid.NewGuid()).ToList(), true)).IsValid);
        Assert.False(validator.Validate(new UpdateVisibilidadeLoteRequest([Guid.Empty], true)).IsValid);
    }

    [Theory]
    [InlineData("mao_de_obra", ItemTipo.MaoDeObra)]
    [InlineData("MaoDeObra", ItemTipo.MaoDeObra)]
    [InlineData(" material ", ItemTipo.Material)]
    [InlineData("Equipamento", ItemTipo.Equipamento)]
    public void Categoria_valida_e_interpretada(string valor, ItemTipo esperado)
    {
        Assert.True(FinanceiroCategorias.TryParse(valor, out var tipo));
        Assert.Equal(esperado, tipo);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("servico")]
    [InlineData("mao de obra")]
    public void Categoria_invalida_e_recusada(string? valor)
    {
        Assert.False(FinanceiroCategorias.TryParse(valor, out _));
    }

    [Fact]
    public void Todas_as_categorias_listadas_sao_aceitas_pelo_parser()
    {
        Assert.Equal(3, FinanceiroCategorias.Todas.Count);
        Assert.All(FinanceiroCategorias.Todas, c => Assert.True(FinanceiroCategorias.TryParse(c.Valor, out _)));
    }

    [Fact]
    public void Filtro_sem_parametros_nao_filtra()
    {
        Assert.True(FinanceiroService.TryParseFiltro(null, null, null, out var filtro, out var erro));

        Assert.Null(erro);
        Assert.Null(filtro.VisivelCliente);
        Assert.Null(filtro.Categoria);
        Assert.Null(filtro.Competencia);
    }

    [Fact]
    public void Filtro_valido_e_interpretado()
    {
        Assert.True(FinanceiroService.TryParseFiltro("false", "mao_de_obra", "2026-10", out var filtro, out _));

        Assert.False(filtro.VisivelCliente);
        Assert.Equal(ItemTipo.MaoDeObra, filtro.Categoria);
        Assert.Equal(new DateOnly(2026, 10, 1), filtro.Competencia);
    }

    [Theory]
    [InlineData("sim", null, null)]
    [InlineData(null, "servico", null)]
    [InlineData(null, null, "2026-13")]
    [InlineData(null, null, "26-10")]
    [InlineData(null, null, "2026-10-15")]
    public void Filtro_invalido_devolve_mensagem(string? visivel, string? categoria, string? competencia)
    {
        Assert.False(FinanceiroService.TryParseFiltro(visivel, categoria, competencia, out _, out var erro));
        Assert.False(string.IsNullOrWhiteSpace(erro));
    }
}
