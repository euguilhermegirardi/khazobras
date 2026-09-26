using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Auditoria;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class LogAuditoriaService
{
    private readonly ILogAuditoriaRepository _repository;

    public LogAuditoriaService(ILogAuditoriaRepository repository) => _repository = repository;

    public async Task RegistrarAsync(Guid? userId, string acao, string entidade, Guid? entidadeId, string? detalhes = null)
    {
        await _repository.CreateAsync(new LogAuditoria
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Acao = acao,
            Entidade = entidade,
            EntidadeId = entidadeId,
            Detalhes = detalhes,
            CreatedAt = DateTime.UtcNow
        });
    }

    public async Task<IReadOnlyList<LogAuditoriaResponse>> GetByEntidadeAsync(string entidade, Guid entidadeId)
    {
        var logs = await _repository.GetByEntidadeAsync(entidade, entidadeId);
        return logs.Select(l => new LogAuditoriaResponse(l.Id, l.UserId, l.Acao, l.Entidade, l.EntidadeId, l.Detalhes, l.CreatedAt)).ToList();
    }
}