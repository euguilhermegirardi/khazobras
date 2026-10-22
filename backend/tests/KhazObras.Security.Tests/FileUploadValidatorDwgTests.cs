using System.Text;
using KhazObras.Api.Validation;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace KhazObras.Security.Tests;

/// <summary>
/// DWG (AutoCAD) so e aceito por <see cref="FileUploadValidator.IsValidProjeto"/>; o <see cref="FileUploadValidator.IsValid"/>
/// (financeiro, fotos e demais modulos) continua recusando.
/// </summary>
public sealed class FileUploadValidatorDwgTests
{
    private static FormFile CriarArquivo(byte[] conteudo, string nome, string contentType)
    {
        var stream = new MemoryStream(conteudo);
        return new FormFile(stream, 0, stream.Length, "file", nome)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private static byte[] Dwg(string versao, int tamanhoTotal = 64)
    {
        var bytes = new byte[tamanhoTotal];
        Encoding.ASCII.GetBytes(versao).CopyTo(bytes, 0);
        return bytes;
    }

    [Theory]
    [InlineData("AC1012")]
    [InlineData("AC1014")]
    [InlineData("AC1015")]
    [InlineData("AC1018")]
    [InlineData("AC1021")]
    [InlineData("AC1024")]
    [InlineData("AC1027")]
    [InlineData("AC1032")]
    public void Projeto_aceita_dwg_das_versoes_modernas(string versao)
    {
        var arquivo = CriarArquivo(Dwg(versao), "Eletrico.dwg", "application/octet-stream");

        Assert.True(FileUploadValidator.IsValidProjeto(arquivo, out var erro));
        Assert.Null(erro);
    }

    [Theory]
    [InlineData("application/octet-stream")]
    [InlineData("application/acad")]
    [InlineData("application/x-acad")]
    [InlineData("application/autocad_dwg")]
    [InlineData("application/dwg")]
    [InlineData("image/vnd.dwg")]
    [InlineData("drawing/dwg")]
    [InlineData("")]
    public void Projeto_aceita_os_mime_de_autocad_e_octet_stream_para_dwg(string mime)
    {
        var arquivo = CriarArquivo(Dwg("AC1032"), "planta.dwg", mime);

        Assert.True(FileUploadValidator.IsValidProjeto(arquivo, out _));
    }

    [Theory]
    [InlineData("planta.dwg")]
    [InlineData("PLANTA.DWG")]
    [InlineData("Planta.Dwg")]
    public void Projeto_aceita_extensao_dwg_em_qualquer_caixa(string nome)
    {
        var arquivo = CriarArquivo(Dwg("AC1015"), nome, "application/octet-stream");

        Assert.True(FileUploadValidator.IsValidProjeto(arquivo, out _));
    }

    [Theory]
    [InlineData("text/plain")]
    [InlineData("application/pdf")]
    [InlineData("image/png")]
    [InlineData("application/zip")]
    [InlineData("text/html")]
    public void Projeto_recusa_dwg_com_mime_fora_da_lista(string mime)
    {
        var arquivo = CriarArquivo(Dwg("AC1032"), "planta.dwg", mime);

        Assert.False(FileUploadValidator.IsValidProjeto(arquivo, out var erro));
        Assert.NotNull(erro);
    }

    public static TheoryData<string, byte[]> ConteudosQueNaoSaoDwg => new()
    {
        { "texto", "isto nao e um desenho"u8.ToArray() },
        { "pdf", "%PDF-1.7 conteudo"u8.ToArray() },
        { "zip", new byte[] { 0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00 } },
        { "exe", new byte[] { 0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00 } },
        { "dwg-r12", Dwg("AC1009") },
        { "dwg-r2.5", Dwg("AC1.50") },
        { "mc0.0", Dwg("MC0.0") },
        { "versao-inexistente", Dwg("AC1099") },
        { "prefixo-com-minusculas", Dwg("ac1032") },
        { "cabecalho-no-meio", [0x00, 0x41, 0x43, 0x31, 0x30, 0x33, 0x32, 0x00, 0x00, 0x00] }
    };

    [Theory]
    [MemberData(nameof(ConteudosQueNaoSaoDwg))]
    public void Projeto_recusa_arquivo_renomeado_para_dwg(string descricao, byte[] conteudo)
    {
        var arquivo = CriarArquivo(conteudo, "planta.dwg", "application/octet-stream");

        Assert.False(FileUploadValidator.IsValidProjeto(arquivo, out var erro), descricao);
        Assert.Equal("Conteudo do arquivo nao corresponde ao tipo informado.", erro);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    public void Projeto_recusa_dwg_com_menos_de_6_bytes(int tamanho)
    {
        var arquivo = CriarArquivo(Encoding.ASCII.GetBytes("AC1032")[..tamanho], "planta.dwg", "application/octet-stream");

        Assert.False(FileUploadValidator.IsValidProjeto(arquivo, out var erro));
        Assert.NotNull(erro);
    }

    [Fact]
    public void Projeto_aceita_dwg_com_exatamente_6_bytes()
    {
        var arquivo = CriarArquivo("AC1032"u8.ToArray(), "planta.dwg", "application/octet-stream");

        Assert.True(FileUploadValidator.IsValidProjeto(arquivo, out _));
    }

    [Fact]
    public void Projeto_recusa_dwg_vazio()
    {
        var arquivo = CriarArquivo([], "planta.dwg", "application/octet-stream");

        Assert.False(FileUploadValidator.IsValidProjeto(arquivo, out var erro));
        Assert.Equal("Arquivo vazio.", erro);
    }

    [Fact]
    public void Projeto_continua_recusando_dwg_acima_de_10_MB()
    {
        var arquivo = CriarArquivo(Dwg("AC1032", 10 * 1024 * 1024 + 1), "grande.dwg", "application/octet-stream");

        Assert.False(FileUploadValidator.IsValidProjeto(arquivo, out var erro));
        Assert.Contains("10MB", erro);
    }

    [Fact]
    public void Projeto_aceita_dwg_de_exatamente_10_MB()
    {
        var arquivo = CriarArquivo(Dwg("AC1032", 10 * 1024 * 1024), "grande.dwg", "application/octet-stream");

        Assert.True(FileUploadValidator.IsValidProjeto(arquivo, out _));
    }

    [Theory]
    [InlineData("application/octet-stream")]
    [InlineData("application/acad")]
    [InlineData("image/vnd.dwg")]
    [InlineData("")]
    public void Validador_generico_dos_outros_modulos_recusa_dwg(string mime)
    {
        var arquivo = CriarArquivo(Dwg("AC1032"), "planta.dwg", mime);

        Assert.False(FileUploadValidator.IsValid(arquivo, out var erro));
        Assert.NotNull(erro);
    }

    [Theory]
    [InlineData("application/octet-stream", "foto.png")]
    [InlineData("application/acad", "nota.pdf")]
    [InlineData("image/vnd.dwg", "planilha.xlsx")]
    [InlineData("", "foto.jpg")]
    public void Mime_de_dwg_nao_vale_para_outras_extensoes_nem_em_projeto(string mime, string nome)
    {
        var arquivo = CriarArquivo(Dwg("AC1032"), nome, mime);
        var arquivoProjeto = CriarArquivo(Dwg("AC1032"), nome, mime);

        Assert.False(FileUploadValidator.IsValid(arquivo, out _));
        Assert.False(FileUploadValidator.IsValidProjeto(arquivoProjeto, out _));
    }

    [Fact]
    public void Projeto_continua_aceitando_pdf_e_recusando_exe_e_zip()
    {
        var pdf = CriarArquivo("%PDF-1.4 conteudo"u8.ToArray(), "a.pdf", "application/pdf");
        var exe = CriarArquivo(Dwg("AC1032"), "a.exe", "application/octet-stream");
        var zip = CriarArquivo(Dwg("AC1032"), "a.zip", "application/zip");

        Assert.True(FileUploadValidator.IsValidProjeto(pdf, out _));
        Assert.False(FileUploadValidator.IsValidProjeto(exe, out _));
        Assert.False(FileUploadValidator.IsValidProjeto(zip, out _));
    }
}
