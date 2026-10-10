using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Notificacoes;
using KhazObras.Domain.Entities;

namespace KhazObras.Application.Services;

public sealed class NotificacaoService
{
    private readonly INotificacaoRepository _repository;

    public NotificacaoService(INotificacaoRepository repository) => _repository = repository;

    public async Task<NotificacaoResponse> CreateAsync(CreateNotificacaoRequest request)
    {
        var notificacao = new Notificacao
        {
            Id = Guid.NewGuid(),
            ObraId = request.ObraId,
            UserId = request.UserId,
            Modulos = request.Modulos,
            Canal = request.Canal,
            EnviadoAt = DateTime.UtcNow
        };

        var created = await _repository.CreateAsync(notificacao);
        return ToResponse(created);
    }

    public async Task<IReadOnlyList<NotificacaoResponse>> GetByUserIdAsync(Guid userId)
    {
        var notificacoes = await _repository.GetByUserIdAsync(userId);
        return notificacoes.Select(ToResponse).ToList();
    }

    public async Task MarkAsReadAsync(Guid id, Guid userId)
    {
        var notificacao = await _repository.GetByIdAsync(id)
            ?? throw new InvalidOperationException("Notificacao nao encontrada.");

        if (notificacao.UserId != userId)
        {
            throw new UnauthorizedAccessException("Notificacao nao pertence a este usuario.");
        }

        await _repository.MarkAsReadAsync(id, userId, DateTime.UtcNow);
    }

    private static NotificacaoResponse ToResponse(Notificacao n) => new(
        n.Id, n.ObraId, n.UserId, n.Modulos, n.Canal, n.EnviadoAt, n.LidaAt);
}