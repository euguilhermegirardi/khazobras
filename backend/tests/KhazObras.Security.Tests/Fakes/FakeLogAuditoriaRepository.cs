using KhazObras.Application.Abstractions;
using KhazObras.Domain.Entities;

namespace KhazObras.Security.Tests.Fakes;

/// <summary>Guarda em memoria os registros de auditoria gravados pela API (sem banco).</summary>
public sealed class FakeLogAuditoriaRepository : ILogAuditoriaRepository
{
    private readonly List<LogAuditoria> _logs = [];

    public IReadOnlyList<LogAuditoria> Logs => _logs;

    public Task<LogAuditoria> CreateAsync(LogAuditoria log)
    {
        _logs.Add(log);
        return Task.FromResult(log);
    }

    public Task<IReadOnlyList<LogAuditoria>> GetByEntidadeAsync(string entidade, Guid entidadeId)
    {
        var logs = _logs
            .Where(l => l.Entidade == entidade && l.EntidadeId == entidadeId)
            .OrderByDescending(l => l.CreatedAt)
            .ToList()
            .AsReadOnly();

        return Task.FromResult<IReadOnlyList<LogAuditoria>>(logs);
    }
}
