using KhazObras.Application.Dtos.ProjetosDocumentos;
using KhazObras.Application.Services;
using KhazObras.Application.Validators;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>Regras de entrada dos documentos de projeto: validator da edicao e <see cref="ProjetoRegras"/>.</summary>
public sealed class ProjetoValidatorTests
{
    private static readonly UpdateProjetoDocumentoRequestValidator Validator = new();

    [Fact]
    public async Task Update_valido_passa_com_tipo_e_etapa_nulos()
    {
        var result = await Validator.ValidateAsync(new UpdateProjetoDocumentoRequest("planta.pdf", null, null));

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Update_sem_nome_e_invalido_sem_lancar_excecao()
    {
        var result = await Validator.ValidateAsync(new UpdateProjetoDocumentoRequest(null!, null, null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Nome");
    }

    [Theory]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData("planta.pdf", true)]
    [InlineData("a/b.pdf", false)]
    [InlineData("a\\b.pdf", false)]
    [InlineData("a\tb.pdf", false)]
    [InlineData("a\0b.pdf", false)]
    public async Task Update_valida_o_nome(string nome, bool valido)
    {
        var result = await Validator.ValidateAsync(new UpdateProjetoDocumentoRequest(nome, null, null));

        Assert.Equal(valido, result.IsValid);
    }

    [Fact]
    public async Task Update_recusa_nome_com_mais_de_255_caracteres()
    {
        var noLimite = await Validator.ValidateAsync(new UpdateProjetoDocumentoRequest(new string('x', 255), null, null));
        var estourou = await Validator.ValidateAsync(new UpdateProjetoDocumentoRequest(new string('x', 256), null, null));

        Assert.True(noLimite.IsValid);
        Assert.False(estourou.IsValid);
    }

    [Fact]
    public async Task Update_recusa_tipo_com_mais_de_50_caracteres_ou_controle_e_aceita_vazio()
    {
        var noLimite = await Validator.ValidateAsync(new UpdateProjetoDocumentoRequest("a.pdf", new string('t', 50), null));
        var estourou = await Validator.ValidateAsync(new UpdateProjetoDocumentoRequest("a.pdf", new string('t', 51), null));
        var controle = await Validator.ValidateAsync(new UpdateProjetoDocumentoRequest("a.pdf", "a\nb", null));
        var vazio = await Validator.ValidateAsync(new UpdateProjetoDocumentoRequest("a.pdf", "   ", null));

        Assert.True(noLimite.IsValid);
        Assert.False(estourou.IsValid);
        Assert.False(controle.IsValid);
        Assert.True(vazio.IsValid);
        Assert.Contains(estourou.Errors, e => e.PropertyName == "TipoDocumento");
    }

    [Theory]
    [InlineData(".pdf", true)]
    [InlineData(".PDF", true)]
    [InlineData(".jpg", true)]
    [InlineData(".jpeg", true)]
    [InlineData(".png", true)]
    [InlineData(".webp", true)]
    [InlineData(".gif", true)]
    [InlineData(".doc", true)]
    [InlineData(".docx", true)]
    [InlineData(".xls", true)]
    [InlineData(".xlsx", true)]
    [InlineData(".txt", false)]
    [InlineData(".exe", false)]
    [InlineData(".html", false)]
    [InlineData(".svg", false)]
    [InlineData(".dwg", true)]
    [InlineData(".DWG", true)]
    [InlineData(".dxf", false)]
    [InlineData(".zip", false)]
    [InlineData("", false)]
    public void Extensoes_permitidas_para_projeto(string extensao, bool permitida)
    {
        Assert.Equal(permitida, ProjetoRegras.ExtensaoPermitida(extensao));
    }

    [Theory]
    [InlineData("Planta.PDF", ".pdf")]
    [InlineData("Eletrico.DWG", ".dwg")]
    [InlineData("obras/x/projetos/abc.docx", ".docx")]
    [InlineData("sem-extensao", "")]
    [InlineData("a.extensaomuitolonga", "")]
    [InlineData("a.p$f", "")]
    public void Extensao_segura_normaliza_ou_devolve_vazio(string nome, string esperado)
    {
        Assert.Equal(esperado, ProjetoRegras.ExtensaoSegura(nome));
    }

    [Fact]
    public void Normalizar_tipo_apara_e_vazio_vira_nulo()
    {
        Assert.Null(ProjetoRegras.NormalizarTipoDocumento(null));
        Assert.Null(ProjetoRegras.NormalizarTipoDocumento("   "));
        Assert.Equal("Planta baixa", ProjetoRegras.NormalizarTipoDocumento("  Planta baixa "));
    }

    [Fact]
    public void Limites_seguem_as_colunas_e_a_regra_de_produto()
    {
        Assert.Equal(200, ProjetoRegras.MaxDocumentosPorObra);
        Assert.Equal(255, ProjetoRegras.MaxNomeArquivo);
        Assert.Equal(50, ProjetoRegras.MaxTipoDocumento);
    }
}
