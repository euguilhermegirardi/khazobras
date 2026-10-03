using KhazObras.Domain.Entities;

namespace KhazObras.Application.Abstractions;

public interface INotificacaoRepository
{
    Task<Notificacao> CreateAsync(Notificacao notificacao);
    Task<IReadOnlyList<Notificacao>> GetByUserIdAsync(Guid userId);
    Task MarkAsReadAsync(Guid id, DateTime lidaAt);
    Task<Notificacao?> GetByIdAsync(Guid id);
}