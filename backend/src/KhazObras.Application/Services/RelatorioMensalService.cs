using System.Text.Json;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.RelatoriosMensais;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed record RelatorioMensalResult(RelatorioMensalWriteStatus Status, RelatorioMensalResponse? Relatorio);

public sealed class RelatorioMensalService
{
    private const string EntidadeAuditoria = "relatorio_mensal";
    private const string AcaoCriado = "relatorio_mensal_criado";
    private const string AcaoEditado = "relatorio_mensal_editado";
    private const string AcaoExcluido = "relatorio_mensal_excluido";
    private const string AcaoPublicado = "relatorio_mensal_publicado";

    private readonly IRelatorioMensalRepository _repository;
    private readonly IObraRepository _obraRepository;
    private readonly IUserRepository _userRepository;
    private readonly LogAuditoriaService _auditoria;

    public RelatorioMensalService(
        IRelatorioMensalRepository repository,
        IObraRepository obraRepository,
        IUserRepository userRepository,
        LogAuditoriaService auditoria)
    {
        _repository = repository;
        _obraRepository = obraRepository;
        _userRepository = userRepository;
        _auditoria = auditoria;
    }

    /// <summary>
    /// Cria o relatorio em rascunho. O endpoint ja validou o acesso a obra e o corpo; aqui: obra inexistente (ObraNaoEncontrada)
    /// e mes repetido (CompetenciaDuplicada; a competencia vira o dia 1 do mes). Auditoria <c>relatorio_mensal_criado</c> so com ids.
    /// </summary>
    public async Task<RelatorioMensalResult> CreateAsync(CreateRelatorioMensalRequest request, Guid actorUserId)
    {
        if (await _obraRepository.GetByIdAsync(request.ObraId) is null)
        {
            return new RelatorioMensalResult(RelatorioMensalWriteStatus.ObraNaoEncontrada, null);
        }

        var agora = DateTime.UtcNow;
        var relatorio = new RelatorioMensal
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            Competencia = RelatorioMensalRegras.NormalizarCompetencia(request.Competencia),
            Conteudo = request.Conteudo.Trim(),
            Status = "draft",
            CreatedByUserId = actorUserId,
            CreatedAt = agora,
            UpdatedAt = agora
        };

        var resultado = await _repository.TryCreateAsync(relatorio);
        if (resultado.Status == RelatorioMensalWriteStatus.Ok)
        {
            await RegistrarAsync(actorUserId, AcaoCriado, relatorio.Id, new { obraId = relatorio.ObraId });
        }

        return ToResult(resultado);
    }

    /// <summary>Resolve so a obra do relatorio (query enxuta); o endpoint valida o acesso a ela antes de ler ou alterar.</summary>
    public Task<Guid?> ResolveAsync(Guid id) => _repository.GetObraIdByIdAsync(id);

    /// <summary>Visao Admin/Master: devolve null se o relatorio nao existir OU nao for da obra autorizada.</summary>
    public async Task<RelatorioMensalResponse?> GetByIdAndObraAsync(Guid id, Guid obraId)
    {
        var relatorio = await _repository.GetByIdAndObraAsync(id, obraId);
        return relatorio is null ? null : ToResponse(relatorio);
    }

    public async Task<IReadOnlyList<RelatorioMensalResponse>> GetByObraIdAsync(Guid obraId, bool onlyPublished)
    {
        // O filtro de status vai no SQL (nao busca tudo para filtrar em memoria).
        var relatorios = onlyPublished
            ? await _repository.GetPublishedByObraIdAsync(obraId)
            : await _repository.GetByObraIdAsync(obraId);
        return relatorios.Select(ToResponse).ToList();
    }

    /// <summary>Visao cliente por id: rascunho e tratado como inexistente (null). Preso a obra autorizada no SQL.</summary>
    public async Task<RelatorioMensalClienteResponse?> GetPublishedByIdForClientAsync(Guid id, Guid obraId)
    {
        var relatorio = await _repository.GetPublishedByIdAndObraAsync(id, obraId);
        return relatorio is null ? null : ToClienteResponse(relatorio);
    }

    /// <summary>Visao cliente da lista: sempre so publicados, independentemente de parametros.</summary>
    public async Task<IReadOnlyList<RelatorioMensalClienteResponse>> GetPublishedByObraIdForClientAsync(Guid obraId)
    {
        var relatorios = await _repository.GetPublishedByObraIdAsync(obraId);
        return relatorios.Select(ToClienteResponse).ToList();
    }

    /// <summary>
    /// Edita competencia e conteudo de um rascunho (preso a obra e a <c>status = 'draft'</c> no SQL, sem corrida com a publicacao).
    /// Publicado = Conflito; mes ja usado por outro relatorio = CompetenciaDuplicada. Auditoria <c>relatorio_mensal_editado</c> so
    /// com ids e NOMES dos campos alterados (sem o texto); nada alterado = sem registro.
    /// </summary>
    public async Task<RelatorioMensalResult> UpdateAsync(Guid id, Guid obraId, UpdateRelatorioMensalRequest request, Guid actorUserId)
    {
        var atual = await _repository.GetByIdAndObraAsync(id, obraId);
        if (atual is null)
        {
            return new RelatorioMensalResult(RelatorioMensalWriteStatus.NaoEncontrado, null);
        }

        if (atual.Status != "draft")
        {
            return new RelatorioMensalResult(RelatorioMensalWriteStatus.Conflito, null);
        }

        var competencia = RelatorioMensalRegras.NormalizarCompetencia(request.Competencia);
        var conteudo = request.Conteudo.Trim();

        var campos = new List<string>();
        if (competencia != atual.Competencia) campos.Add("competencia");
        if (!string.Equals(conteudo, atual.Conteudo, StringComparison.Ordinal)) campos.Add("conteudo");

        var resultado = await _repository.UpdateDraftAsync(id, obraId, competencia, conteudo, DateTime.UtcNow);
        if (resultado.Status == RelatorioMensalWriteStatus.Ok && campos.Count > 0)
        {
            await RegistrarAsync(actorUserId, AcaoEditado, id, new { obraId, campos });
        }

        return ToResult(resultado);
    }

    /// <summary>
    /// Publica um rascunho (draft para published, preso a obra e ao status no SQL: duas publicacoes simultaneas, so uma vence e a
    /// outra recebe Conflito). Auditoria <c>relatorio_mensal_publicado</c> so com ids.
    /// </summary>
    public async Task<RelatorioMensalResult> PublishAsync(Guid id, Guid obraId, Guid actorUserId)
    {
        var resultado = await _repository.PublishAsync(id, obraId, DateTime.UtcNow);
        if (resultado.Status == RelatorioMensalWriteStatus.Ok)
        {
            await RegistrarAsync(actorUserId, AcaoPublicado, id, new { obraId });
        }

        return ToResult(resultado);
    }

    /// <summary>
    /// Exclui um rascunho (definitivo, sem lixeira; publicado = Conflito). Auditoria <c>relatorio_mensal_excluido</c> so com ids.
    /// </summary>
    public async Task<RelatorioMensalWriteStatus> DeleteAsync(Guid id, Guid obraId, Guid actorUserId)
    {
        var status = await _repository.DeleteDraftAsync(id, obraId);
        if (status == RelatorioMensalWriteStatus.Ok)
        {
            await RegistrarAsync(actorUserId, AcaoExcluido, id, new { obraId });
        }

        return status;
    }

    /// <summary>
    /// Historico do relatorio (so Admin/Master): registros de auditoria criado/editado/publicado, do mais novo para o mais antigo
    /// (ate <see cref="RelatorioMensalRegras.MaxItensHistorico"/>), com o nome de quem agiu. Null se o relatorio nao existir
    /// nesta obra. Excluido nao aparece: o relatorio deixa de existir.
    /// </summary>
    public async Task<IReadOnlyList<RelatorioMensalHistoricoResponse>?> GetHistoricoAsync(Guid id, Guid obraId)
    {
        if (await _repository.GetByIdAndObraAsync(id, obraId) is null)
        {
            return null;
        }

        var logs = await _auditoria.GetByEntidadeAsync(EntidadeAuditoria, id);
        var itens = logs
            .Where(l => l.Acao is AcaoCriado or AcaoEditado or AcaoPublicado)
            .OrderByDescending(l => l.CreatedAt)
            .Take(RelatorioMensalRegras.MaxItensHistorico)
            .ToList();

        var nomes = new Dictionary<Guid, string?>();
        foreach (var userId in itens.Where(l => l.UserId is not null).Select(l => l.UserId!.Value).Distinct())
        {
            nomes[userId] = (await _userRepository.GetByIdAsync(userId))?.Name;
        }

        return itens
            .Select(l => new RelatorioMensalHistoricoResponse(
                l.Acao,
                l.UserId,
                l.UserId is not null && nomes.TryGetValue(l.UserId.Value, out var nome) ? nome : null,
                l.CreatedAt,
                LerCampos(l.Detalhes)))
            .ToList();
    }

    // Payload da auditoria: so ids e nomes de campos, nunca o texto do relatorio.
    private Task RegistrarAsync(Guid actorUserId, string acao, Guid relatorioId, object detalhes) =>
        _auditoria.RegistrarAsync(actorUserId, acao, EntidadeAuditoria, relatorioId, JsonSerializer.Serialize(detalhes));

    private static IReadOnlyList<string> LerCampos(string? detalhes)
    {
        if (string.IsNullOrWhiteSpace(detalhes))
        {
            return [];
        }

        try
        {
            using var documento = JsonDocument.Parse(detalhes);
            if (documento.RootElement.ValueKind == JsonValueKind.Object
                && documento.RootElement.TryGetProperty("campos", out var campos)
                && campos.ValueKind == JsonValueKind.Array)
            {
                return campos.EnumerateArray()
                    .Where(c => c.ValueKind == JsonValueKind.String)
                    .Select(c => c.GetString()!)
                    .ToList();
            }
        }
        catch (JsonException)
        {
            // Detalhes fora do formato esperado (registro antigo): historico sem a lista de campos.
        }

        return [];
    }

    private static RelatorioMensalResult ToResult(RelatorioMensalWriteResult resultado) =>
        new(resultado.Status, resultado.Relatorio is null ? null : ToResponse(resultado.Relatorio));

    private static RelatorioMensalClienteResponse ToClienteResponse(RelatorioMensal r) => new(
        r.Id, r.ObraId, r.Competencia, r.Conteudo, r.Status, r.PublishedAt, r.CreatedAt);

    private static RelatorioMensalResponse ToResponse(RelatorioMensal r) => new(
        r.Id, r.ObraId, r.Competencia, r.Conteudo, r.Status, r.PublishedAt, r.CreatedByUserId, r.CreatedAt, r.UpdatedAt);
}
