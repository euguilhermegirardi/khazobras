using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface ILogAuditoriaRepository
{
    Task<LogAuditoria> CreateAsync(LogAuditoria log);
    Task<IReadOnlyList<LogAuditoria>> GetByEntidadeAsync(string entidade, Guid entidadeId);
}