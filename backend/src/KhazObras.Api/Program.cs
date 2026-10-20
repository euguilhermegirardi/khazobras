using KhazObras.Application.Dtos.Notificacoes;
using KhazObras.Application.Dtos.Auditoria;
using KhazObras.Application.Dtos.Fornecedores;
using KhazObras.Application.Dtos.Prestadores;
using KhazObras.Application.Dtos.Estoque;
using KhazObras.Application.Dtos.Pipelines;
using KhazObras.Application.Dtos.RelatoriosFotograficos;
using KhazObras.Application.Dtos.RelatoriosMensais;
using KhazObras.Application.Dtos.Financeiro;
using KhazObras.Application.Dtos.Medicoes;
using KhazObras.Application.Dtos.Contratos;
using KhazObras.Application.Dtos.Etapas;
using KhazObras.Infrastructure.Storage;
using FluentValidation;
using KhazObras.Application.Dtos.Obras;
using KhazObras.Infrastructure.Repositories;
using KhazObras.Application.Validators;
using System.Security.Claims;
using System.Text;
using Dapper;
using KhazObras.Api.Middlewares;
using KhazObras.Application.Abstractions;
using KhazObras.Application.Dtos.Auth;
using KhazObras.Application.Dtos.Users;
using KhazObras.Application.Services;
using KhazObras.Infrastructure.Persistence;
using KhazObras.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

// Persistencia
builder.Services.AddSingleton<IDbConnectionFactory, NpgsqlConnectionFactory>();
builder.Services.AddScoped<IUserRepository, UserRepository>();

// Seguranca
builder.Services.AddScoped<IPasswordHasher, PasswordHasherAdapter>();
builder.Services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
builder.Services.AddSingleton<IStorageService, R2StorageService>();

// Application services
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<IObraRepository, ObraRepository>();
builder.Services.AddScoped<ObraService>();
builder.Services.AddScoped<IEtapaRepository, EtapaRepository>();
builder.Services.AddScoped<EtapaService>();
builder.Services.AddScoped<IMedicaoRepository, MedicaoRepository>();
builder.Services.AddScoped<MedicaoService>();
builder.Services.AddScoped<IContratoRepository, ContratoRepository>();
builder.Services.AddScoped<ContratoService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IDashboardClienteRepository, DashboardClienteRepository>();
builder.Services.AddScoped<DashboardClienteService>();
builder.Services.AddScoped<IFinanceiroLancamentoRepository, FinanceiroLancamentoRepository>();
builder.Services.AddScoped<FinanceiroService>();
builder.Services.AddScoped<IRelatorioFotograficoRepository, RelatorioFotograficoRepository>();
builder.Services.AddScoped<RelatorioFotograficoService>();
builder.Services.AddScoped<IRelatorioMensalRepository, RelatorioMensalRepository>();
builder.Services.AddScoped<RelatorioMensalService>();
builder.Services.AddScoped<IProjetoDocumentoRepository, ProjetoDocumentoRepository>();
builder.Services.AddScoped<ProjetoDocumentoService>();
builder.Services.AddScoped<IFornecedorRepository, FornecedorRepository>();
builder.Services.AddScoped<FornecedorService>();
builder.Services.AddScoped<IPrestadorRepository, PrestadorRepository>();
builder.Services.AddScoped<PrestadorService>();
builder.Services.AddScoped<IEstoqueRepository, EstoqueRepository>();
builder.Services.AddScoped<EstoqueService>();
builder.Services.AddScoped<IPipelineRepository, PipelineRepository>();
builder.Services.AddScoped<PipelineService>();
builder.Services.AddScoped<INotificacaoRepository, NotificacaoRepository>();
builder.Services.AddScoped<NotificacaoService>();
builder.Services.AddScoped<ILogAuditoriaRepository, LogAuditoriaRepository>();
builder.Services.AddScoped<LogAuditoriaService>();
builder.Services.AddScoped<IUserObraRepository, UserObraRepository>();
builder.Services.AddScoped<ObraAccessService>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateObraRequestValidator>();

// Erro global
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Autenticacao JWT
var jwtSecret = builder.Configuration["Jwt:Secret"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;
var jwtAudience = builder.Configuration["Jwt:Audience"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("MasterOnly", policy => policy.RequireRole("Master"));
    options.AddPolicy("AdminOrMaster", policy => policy.RequireRole("Admin", "Master"));
    // Aprovacao de medicao e ato do cliente (SPEC secao 5 item 4 e secao 8). Admin/Master nao aprovam no lugar dele.
    options.AddPolicy("ClientOnly", policy => policy.RequireRole("Client"));
});

// CORS: libera SOMENTE a(s) origem(ns) exata(s) do frontend. Nunca AllowAnyOrigin.
// Producao: Cors__AllowedOrigins__0=https://app.exemplo.com.br (variavel de ambiente).
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (allowedOrigins.Length == 0 && builder.Environment.IsDevelopment())
{
    allowedOrigins = ["http://localhost:5173"];
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(allowedOrigins)
        .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")
        .WithHeaders("Authorization", "Content-Type")
        .WithExposedHeaders("Content-Disposition"));
});

var app = builder.Build();

app.UseExceptionHandler();

app.MapOpenApi();

app.UseHttpsRedirection();

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/healthcheck", async (IDbConnectionFactory dbFactory, ILogger<Program> logger) =>
{
    try
    {
        using var connection = dbFactory.CreateConnection();
        await connection.ExecuteScalarAsync<int>("SELECT 1");
        return Results.Ok(new { status = "healthy", database = "connected" });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Healthcheck falhou - banco de dados indisponivel");
        return Results.Problem(
            detail: "Banco de dados indisponivel.",
            statusCode: 500,
            title: "Servico indisponivel");
    }
})
.WithName("HealthCheck")
.WithDescription("Verifica a saúde da API e conectividade com o banco de dados");

app.MapPost("/auth/login", async (LoginRequest request, AuthService authService) =>
{
    var result = await authService.LoginAsync(request);
    return result is null ? Results.Unauthorized() : Results.Ok(result);
})
.WithName("Login")
.WithDescription("Autentica usuário e retorna JWT token com 8h de expiração");

app.MapPost("/users", async (CreateUserRequest request, IValidator<CreateUserRequest> validator, UserService userService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var createdByUserId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await userService.CreateAsync(request, createdByUserId);
    return Results.Created($"/users/{result.Id}", result);
})
.RequireAuthorization("MasterOnly")
.WithName("CreateUser")
.WithDescription("Cria novo usuário (somente Master). Roles: Master, Admin, Client");

app.MapGet("/users/me", async (ClaimsPrincipal principal, IUserRepository userRepository) =>
{
    var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var user = await userRepository.GetByIdAsync(userId);

    return user is null
        ? Results.NotFound()
        : Results.Ok(new UserResponse(user.Id, user.Name, user.Email, user.Role.ToString(), user.IsActive, user.CreatedAt));
})
.RequireAuthorization()
.WithName("GetMe")
.WithDescription("Retorna dados do usuário autenticado");

app.MapPost("/obras", async (CreateObraRequest request, IValidator<CreateObraRequest> validator, ObraService obraService) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var result = await obraService.CreateAsync(request);
    return Results.Created($"/obras/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateObra")
.WithDescription("Cria nova obra. Cliente vê apenas obras vinculadas ao seu login");

app.MapGet("/obras/{id:guid}", async (Guid id, ObraService obraService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, id);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await obraService.GetByIdAsync(id);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetObraById")
.WithDescription("Retorna detalhes de uma obra específica (acesso restrito por obra)");

app.MapGet("/obras", async (ObraService obraService, ObraAccessService accessService, IUserObraRepository userObraRepository, ClaimsPrincipal principal, int pageIndex = 0, int pageSize = 20) =>
{
    if (!accessService.IsAdminOrMaster(principal))
    {
        var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var obraIds = await userObraRepository.GetObraIdsForUserAsync(userId);
        var obras = new List<KhazObras.Application.Dtos.Obras.ObraResponse>();

        foreach (var id in obraIds)
        {
            var obra = await obraService.GetByIdAsync(id);
            if (obra is not null)
            {
                obras.Add(obra);
            }
        }

        return Results.Ok(new { totalItems = obras.Count, pageIndex = 0, pageSize = obras.Count, items = obras });
    }

    var result = await obraService.GetPagedAsync(pageIndex, pageSize);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetObras")
.WithDescription("Lista todas as obras (paginado). Clientes veem apenas suas obras");

app.MapPost("/etapas", async (CreateEtapaRequest request, IValidator<CreateEtapaRequest> validator, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var result = await etapaService.CreateAsync(request);
    return Results.Created($"/etapas/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateEtapa")
.WithDescription("Cria etapa (fase) em uma obra");

app.MapGet("/etapas/{id:guid}", async (Guid id, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await etapaService.ResolveEtapaAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await etapaService.GetByIdAndObraAsync(id, obraId.Value);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetEtapaById")
.WithDescription("Retorna detalhes de uma etapa específica");

app.MapPut("/etapas/{id:guid}", async (Guid id, UpdateEtapaRequest request, IValidator<UpdateEtapaRequest> validator, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await etapaService.ResolveEtapaAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var result = await etapaService.UpdateAsync(id, obraId.Value, request);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("UpdateEtapa")
.WithDescription("Atualiza etapa (nome, ordem, peso, datas previstas e reais, status e % concluido)");

app.MapGet("/obras/{obraId:guid}/etapas",async (Guid obraId, EtapaService etapaService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await etapaService.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetEtapasByObra")
.WithDescription("Lista todas as etapas de uma obra");

app.MapPost("/medicoes", async (CreateMedicaoRequest request, IValidator<CreateMedicaoRequest> validator, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var created = await medicaoService.CreateAsync(request, userId);

    if (created.Status == MedicaoCreateStatus.ObraNaoEncontrada)
    {
        return Results.NotFound();
    }

    if (created.Status == MedicaoCreateStatus.EtapaInvalida)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["EtapaId"] = ["A etapa informada nao existe nesta obra."]
        });
    }

    if (created.Status == MedicaoCreateStatus.NumeroDuplicado)
    {
        return Results.Conflict(new { message = "Ja existe uma medicao com este numero nesta obra." });
    }

    return Results.Created($"/medicoes/{created.Medicao!.Id}", created.Medicao);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateMedicao")
.WithDescription("Cria medição para uma obra (somente Admin/Master). Estados: pending_approval → approved → invoice_issued. Etapa precisa ser da mesma obra; número único por obra (409)");

app.MapGet("/medicoes/{id:guid}", async (Guid id, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await medicaoService.ResolveMedicaoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await medicaoService.GetByIdAndObraAsync(id, obraId.Value);
    if (result is null)
    {
        return Results.NotFound();
    }

    // Cliente recebe a visão reduzida (sem ApprovedByUserId); Admin/Master, a completa.
    return accessService.IsAdminOrMaster(principal)
        ? Results.Ok(result)
        : Results.Ok(MedicaoService.ToClienteView(result));
})
.RequireAuthorization()
.WithName("GetMedicaoById")
.WithDescription("Retorna detalhes de uma medição (cliente: visão reduzida, sem ids internos de usuário)");

app.MapGet("/obras/{obraId:guid}/medicoes", async (Guid obraId, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await medicaoService.GetByObraIdAsync(obraId);

    // Array puro (contrato do Fechamento). Cliente recebe a visão reduzida; Admin/Master, a completa.
    if (accessService.IsAdminOrMaster(principal))
    {
        return Results.Ok(result);
    }

    return Results.Ok(result.Select(MedicaoService.ToClienteView).ToList());
})
.RequireAuthorization()
.WithName("GetMedicoesByObra")
.WithDescription("Lista todas as medições de uma obra, com itens, sem paginação (cliente: visão reduzida, sem ids internos de usuário)");

app.MapGet("/obras/{obraId:guid}/medicoes/resumo", async (Guid obraId, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal, int pageIndex = 0, int pageSize = 20, string? status = null) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (pageIndex < 0 || pageSize < 1 || pageSize > 100)
    {
        return Results.BadRequest(new { message = "pageIndex deve ser >= 0 e pageSize deve estar entre 1 e 100." });
    }

    if (!MedicaoService.TryParseStatusFiltro(status, out var statusFiltro))
    {
        return Results.BadRequest(new { message = "status deve ser pending_approval, approved ou invoice_issued." });
    }

    var result = await medicaoService.GetResumoPagedByObraIdAsync(obraId, pageIndex, pageSize, statusFiltro);
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetMedicoesResumoByObra")
.WithDescription("Lista de acompanhamento das medições da obra (paginada, mais nova primeiro, sem itens; filtro opcional por status). Somente Admin/Master");

app.MapPost("/medicoes/{id:guid}/approve", async (Guid id, ClaimsPrincipal principal, MedicaoService medicaoService, ObraAccessService accessService) =>
{
    var obraId = await medicaoService.ResolveMedicaoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    try
    {
        var result = await medicaoService.ApproveAsync(id, obraId.Value, userId);
        return result is null
            ? Results.NotFound()
            : Results.Ok(MedicaoService.ToClienteView(result));
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { message = ex.Message });
    }
})
.RequireAuthorization("ClientOnly")
.WithName("ApproveMedicao")
.WithDescription("Aprova medição (transição: pending_approval → approved). Somente o cliente da obra; Admin/Master recebem 403. Resposta na visão do cliente");

app.MapPost("/medicoes/{id:guid}/issue-invoice", async (Guid id, IssueInvoiceRequest request, IValidator<IssueInvoiceRequest> validator, MedicaoService medicaoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await medicaoService.ResolveMedicaoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    try
    {
        var result = await medicaoService.IssueInvoiceAsync(id, obraId.Value, request.NfNumber, userId);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { message = ex.Message });
    }
})
.RequireAuthorization("AdminOrMaster")
.WithName("IssueMedicaoInvoice")
.WithDescription("Emite nota fiscal para medição (transição: approved → invoice_issued; outro status = 409). Somente Admin/Master");

app.MapPost("/contratos", async (CreateContratoRequest request, IValidator<CreateContratoRequest> validator, ContratoService contratoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var created = await contratoService.CreateAsync(request, userId);

    if (created.Status == ContratoCreateStatus.ObraNaoEncontrada)
    {
        return Results.NotFound();
    }

    if (created.Status == ContratoCreateStatus.NumeroDuplicado)
    {
        return Results.Conflict(new { message = "Ja existe um contrato com este numero nesta obra." });
    }

    return Results.Created($"/contratos/{created.Contrato!.Id}", created.Contrato);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateContrato")
.WithDescription("Cria contrato para uma obra (somente Admin/Master). Número único por obra (409); valor > 0 com 2 casas");

app.MapGet("/obras/{obraId:guid}/contratos", async (Guid obraId, ContratoService contratoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await contratoService.GetByObraIdAsync(obraId);

    // Array puro. Cliente recebe a visão reduzida (sem datas internas); Admin/Master, a completa.
    if (accessService.IsAdminOrMaster(principal))
    {
        return Results.Ok(result);
    }

    return Results.Ok(result.Select(c => ContratoService.ToClienteView(c)).ToList());
})
.RequireAuthorization()
.WithName("GetContratosByObra")
.WithDescription("Lista os contratos de uma obra com total pago e saldo a pagar calculados no servidor (cliente: visão reduzida)");

app.MapGet("/obras/{obraId:guid}/dashboard", async (Guid obraId, DashboardClienteService dashboardService, ObraAccessService accessService, ClaimsPrincipal principal, CancellationToken cancellationToken) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    // DTO unico e seguro para qualquer papel: so valores contratados/medidos, nunca custo real nem margem.
    var dashboard = await dashboardService.GetAsync(obraId, cancellationToken);
    return dashboard is null ? Results.NotFound() : Results.Ok(dashboard);
})
.RequireAuthorization()
.WithName("GetDashboardCliente")
.WithDescription("Dashboard da obra para o cliente: avanço físico, prazo, valores contratado/medido, avanço por etapa e medido por mês (DTO único, sem custo real nem margem)");

app.MapGet("/contratos/{id:guid}", async (Guid id, ContratoService contratoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await contratoService.ResolveContratoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await contratoService.GetDetalheByIdAndObraAsync(id, obraId.Value);
    if (result is null)
    {
        return Results.NotFound();
    }

    return accessService.IsAdminOrMaster(principal)
        ? Results.Ok(result)
        : Results.Ok(ContratoService.ToClienteView(result));
})
.RequireAuthorization()
.WithName("GetContratoById")
.WithDescription("Retorna o contrato com seus pagamentos (data mais recente primeiro; cliente: visão reduzida)");

app.MapPost("/contratos/{id:guid}/pagamentos", async (Guid id, CreatePagamentoRequest request, IValidator<CreatePagamentoRequest> validator, ContratoService contratoService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await contratoService.ResolveContratoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var created = await contratoService.CreatePagamentoAsync(id, obraId.Value, request, userId);

    if (created.Status == PagamentoCreateStatus.ContratoNaoEncontrado)
    {
        return Results.NotFound();
    }

    if (created.Status == PagamentoCreateStatus.MedicaoInvalida)
    {
        // Mesma mensagem para medição inexistente, de outra obra ou sem NF emitida (não revela outra obra).
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["ReferenteMedicaoId"] = ["A medicao informada deve ser desta obra e ter nota fiscal emitida."]
        });
    }

    return Results.Created($"/contratos/{id}", created.Pagamento);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreatePagamento")
.WithDescription("Registra pagamento recebido no contrato (Admin/Master). Medição vinculada, se enviada, precisa ser da mesma obra e estar com NF emitida (400). Não limita a soma ao valor contratado");

app.MapPost("/financeiro/lancamentos", async (CreateFinanceiroLancamentoRequest request, IValidator<CreateFinanceiroLancamentoRequest> validator, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    // Acesso a obra ANTES de validar o corpo (padrao: 403 nao depende do conteudo enviado).
    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var created = await financeiroService.CreateAsync(request, userId);
    if (created.Status == FinanceiroCreateStatus.ObraNaoEncontrada)
    {
        return Results.NotFound();
    }

    return Results.Created($"/financeiro/lancamentos/{created.Lancamento!.Id}", created.Lancamento);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateFinanceiroLancamento")
.WithDescription("Cria lançamento financeiro em uma obra (Admin/Master). Nasce oculto para o cliente (visivelCliente=false, salvo se enviado). Obra inexistente = 404");

app.MapGet("/financeiro/categorias", () => Results.Ok(FinanceiroCategorias.Todas))
.RequireAuthorization("AdminOrMaster")
.WithName("GetFinanceiroCategorias")
.WithDescription("Categorias aceitas em um lançamento (valor snake_case para POST/PUT + rótulo para o select). Somente Admin/Master");

app.MapGet("/financeiro/lancamentos/{id:guid}", async (Guid id, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await financeiroService.ResolveLancamentoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (accessService.IsAdminOrMaster(principal))
    {
        var result = await financeiroService.GetByIdAndObraAsync(id, obraId.Value);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    // Cliente: id + obra + visibilidade filtrados no SQL; oculto = 404; DTO sem campos internos.
    var clienteView = await financeiroService.GetParaClienteByIdAndObraAsync(id, obraId.Value);
    return clienteView is null ? Results.NotFound() : Results.Ok(clienteView);
})
.RequireAuthorization()
.WithName("GetFinanceiroLancamentoById")
.WithDescription("Retorna um lançamento financeiro (cliente: somente os liberados, em visão reduzida)");

app.MapGet("/obras/{obraId:guid}/financeiro/lancamentos", async (Guid obraId, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal, int pageIndex = 0, int pageSize = 20, string? visivelCliente = null, string? categoria = null, string? competencia = null) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (pageIndex < 0 || pageSize < 1 || pageSize > 100)
    {
        return Results.BadRequest(new { message = "pageIndex deve ser >= 0 e pageSize deve estar entre 1 e 100." });
    }

    if (accessService.IsAdminOrMaster(principal))
    {
        // Filtros opcionais (so Admin/Master): visivelCliente=true|false, categoria, competencia=yyyy-MM. Todos no SQL.
        if (!FinanceiroService.TryParseFiltro(visivelCliente, categoria, competencia, out var filtro, out var erroFiltro))
        {
            return Results.BadRequest(new { message = erroFiltro });
        }

        var adminResult = await financeiroService.GetPagedByObraIdAsync(obraId, pageIndex, pageSize, filtro);
        return Results.Ok(adminResult);
    }

    // Cliente: filtro por visibilidade aplicado no SQL; DTO sem campos internos; filtros da query sao ignorados.
    var clienteResult = await financeiroService.GetPagedParaClienteByObraIdAsync(obraId, pageIndex, pageSize);
    return Results.Ok(clienteResult);
})
.RequireAuthorization()
.WithName("GetFinanceiroLancamentosByObra")
.WithDescription("Lista lançamentos financeiros de uma obra (paginado, mais recente primeiro). Admin/Master: todos, DTO completo, filtros opcionais visivelCliente/categoria/competencia. Cliente: somente os liberados, em visão reduzida");

app.MapGet("/obras/{obraId:guid}/financeiro/resumo", async (Guid obraId, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    // Custo real da obra: so Admin/Master (a policy barra o cliente antes do handler).
    var result = await financeiroService.GetResumoAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetFinanceiroResumoByObra")
.WithDescription("Resumo do financeiro da obra: total lançado, liberado ao cliente e não liberado, com quantidades (SQL agregado). Contém custo real: somente Admin/Master");

app.MapPut("/financeiro/lancamentos/{id:guid}", async (Guid id, UpdateFinanceiroLancamentoRequest request, IValidator<UpdateFinanceiroLancamentoRequest> validator, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await financeiroService.ResolveLancamentoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await financeiroService.UpdateAsync(id, obraId.Value, request, userId);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("UpdateFinanceiroLancamento")
.WithDescription("Edita um lançamento (categoria, descrição, valor, datas e, opcionalmente, visivelCliente); a obra não muda. Somente Admin/Master; audita lancamento_editado");

app.MapDelete("/financeiro/lancamentos/{id:guid}", async (Guid id, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal, ILogger<Program> logger) =>
{
    var obraId = await financeiroService.ResolveLancamentoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await financeiroService.DeleteAsync(id, obraId.Value, userId);
    if (result is null)
    {
        return Results.NotFound();
    }

    if (result.FalhasNoStorage > 0)
    {
        logger.LogWarning("Lancamento {LancamentoId} excluido, mas {Falhas} arquivo(s) nao foram removidos do storage", id, result.FalhasNoStorage);
    }

    return Results.NoContent();
})
.RequireAuthorization("AdminOrMaster")
.WithName("DeleteFinanceiroLancamento")
.WithDescription("Exclui um lançamento e seus anexos (banco e R2). Exclusão definitiva, sem lixeira. Somente Admin/Master; audita lancamento_excluido");

app.MapPatch("/financeiro/lancamentos/{id:guid}/visibilidade", async (Guid id, UpdateVisibilidadeLancamentoRequest request, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await financeiroService.ResolveLancamentoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await financeiroService.SetVisibilidadeClienteAsync(id, obraId.Value, request.VisivelCliente, userId);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("UpdateFinanceiroLancamentoVisibilidade")
.WithDescription("Libera ou oculta um lançamento financeiro para o cliente da obra (Admin/Master); audita lancamento_visibilidade_alterada");

app.MapPatch("/obras/{obraId:guid}/financeiro/lancamentos/visibilidade", async (Guid obraId, UpdateVisibilidadeLoteRequest request, IValidator<UpdateVisibilidadeLoteRequest> validator, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await financeiroService.SetVisibilidadeLoteAsync(obraId, request.Ids, request.VisivelCliente, userId);
    if (result is null)
    {
        // Mesma resposta para id inexistente e id de outra obra (nao confirma que o registro existe em outro lugar).
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["Ids"] = ["Um ou mais lancamentos informados nao pertencem a esta obra."]
        });
    }

    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("UpdateFinanceiroLancamentosVisibilidadeLote")
.WithDescription("Libera ou oculta vários lançamentos da obra de uma vez (máx. 200 ids; tudo-ou-nada: id de outra obra = 400 sem alterar nada). Somente Admin/Master; audita um registro por lançamento alterado");

app.MapPost("/financeiro/lancamentos/{id:guid}/anexos", async (Guid id, IFormFile file, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await financeiroService.ResolveLancamentoAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!KhazObras.Api.Validation.FileUploadValidator.IsValid(file, out var validationError))
    {
        return Results.BadRequest(new { message = validationError });
    }

    using var stream = file.OpenReadStream();
    var result = await financeiroService.UploadAnexoAsync(id, obraId.Value, stream, file.FileName, file.ContentType, file.Length);

    return result.Status switch
    {
        AnexoUploadStatus.Created => Results.Created($"/financeiro/anexos/{result.Anexo!.Id}", result.Anexo),
        AnexoUploadStatus.LimiteExcedido => Results.BadRequest(new { message = $"Cada lancamento aceita no maximo {FinanceiroService.MaxAnexosPorLancamento} anexos." }),
        AnexoUploadStatus.NomeArquivoInvalido => Results.BadRequest(new { message = $"O nome do arquivo deve ter de 1 a {FinanceiroService.MaxNomeArquivo} caracteres." }),
        _ => Results.NotFound()
    };
})
.DisableAntiforgery()
.RequireAuthorization("AdminOrMaster")
.WithName("UploadFinanceiroAnexo")
.WithDescription("Anexa arquivo a um lançamento financeiro (máx 10MB, validado por magic bytes; no máximo 10 anexos por lançamento, 400 ao exceder). Somente Admin/Master");

app.MapDelete("/financeiro/anexos/{anexoId:guid}", async (Guid anexoId, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal, ILogger<Program> logger) =>
{
    var obraId = await financeiroService.ResolveAnexoAsync(anexoId);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await financeiroService.DeleteAnexoAsync(anexoId, obraId.Value, userId);
    if (result is null)
    {
        return Results.NotFound();
    }

    if (result.FalhasNoStorage > 0)
    {
        logger.LogWarning("Anexo {AnexoId} removido do banco, mas o arquivo nao foi removido do storage", anexoId);
    }

    return Results.NoContent();
})
.RequireAuthorization("AdminOrMaster")
.WithName("DeleteFinanceiroAnexo")
.WithDescription("Remove um anexo de lançamento (banco e R2). Somente Admin/Master; audita lancamento_anexo_removido");

app.MapGet("/financeiro/anexos/{anexoId:guid}/download", async (Guid anexoId, FinanceiroService financeiroService, ObraAccessService accessService, ClaimsPrincipal principal, HttpContext httpContext) =>
{
    var obraId = await financeiroService.ResolveAnexoAsync(anexoId);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    // Cliente so baixa comprovante de lancamento liberado da propria obra: o filtro (anexo + obra + visibilidade)
    // e feito no SQL; lancamento oculto = 404. So depois disso o arquivo e lido do R2.
    var somenteVisiveisCliente = !accessService.IsAdminOrMaster(principal);
    var result = await financeiroService.DownloadAnexoAsync(anexoId, obraId.Value, somenteVisiveisCliente);
    if (result is null)
    {
        return Results.NotFound();
    }

    var (content, fileName, contentType) = result.Value;
    httpContext.Response.Headers["X-Content-Type-Options"] = "nosniff";
    return Results.File(content, contentType ?? "application/octet-stream", fileName);
})
.RequireAuthorization()
.WithName("DownloadFinanceiroAnexo")
.WithDescription("Baixa anexo de um lançamento financeiro (cliente: somente de lançamentos liberados da própria obra)");

app.MapGet("/relatorios-fotograficos/{id:guid}", async (Guid id, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    // Padrao: resolve so o obra_id -> acesso -> leitura presa a obra (WHERE id AND obra_id).
    var obraId = await service.ResolveRelatorioAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.GetByIdAndObraAsync(id, obraId.Value);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatorioFotograficoById")
.WithDescription("Retorna detalhes de um relatório fotográfico (fotos em ordem estável, sem chave do bucket)");

app.MapPost("/relatorios-fotograficos", async (CreateRelatorioFotograficoRequest request, IValidator<CreateRelatorioFotograficoRequest> validator, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    // Acesso a obra ANTES de validar o corpo (padrao: 403 nao depende do conteudo enviado).
    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var created = await service.CreateAsync(request);
    return created.Status switch
    {
        RelatorioCreateStatus.Created => Results.Created($"/relatorios-fotograficos/{created.Relatorio!.Id}", created.Relatorio),
        RelatorioCreateStatus.ObraNaoEncontrada => Results.NotFound(),
        // Mesma resposta para etapa inexistente e etapa de outra obra (nao confirma que ela existe em outro lugar).
        _ => Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["EtapaId"] = ["A etapa informada deve ser desta obra."]
        })
    };
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateRelatorioFotografico")
.WithDescription("Cria relatório fotográfico (mensal ou etapa) em uma obra (Admin/Master). Etapa informada precisa ser da mesma obra (400); obra inexistente = 404");

app.MapPut("/relatorios-fotograficos/{id:guid}", async (Guid id, UpdateRelatorioFotograficoRequest request, IValidator<UpdateRelatorioFotograficoRequest> validator, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await service.ResolveRelatorioAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await service.UpdateAsync(id, obraId.Value, request, userId);
    return result.Status switch
    {
        RelatorioUpdateStatus.Updated => Results.Ok(result.Relatorio),
        RelatorioUpdateStatus.NaoEncontrado => Results.NotFound(),
        _ => Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["EtapaId"] = ["A etapa informada deve ser desta obra."]
        })
    };
})
.RequireAuthorization("AdminOrMaster")
.WithName("UpdateRelatorioFotografico")
.WithDescription("Edita tipo, etapa, título e competência de um relatório fotográfico; a obra não muda. Somente Admin/Master; audita relatorio_fotografico_editado");

app.MapDelete("/relatorios-fotograficos/{id:guid}", async (Guid id, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal, ILogger<Program> logger) =>
{
    var obraId = await service.ResolveRelatorioAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await service.DeleteAsync(id, obraId.Value, userId);
    if (result is null)
    {
        return Results.NotFound();
    }

    if (result.FalhasNoStorage > 0)
    {
        logger.LogWarning("Relatorio fotografico {RelatorioId} excluido, mas {Falhas} arquivo(s) nao foram removidos do storage", id, result.FalhasNoStorage);
    }

    return Results.NoContent();
})
.RequireAuthorization("AdminOrMaster")
.WithName("DeleteRelatorioFotografico")
.WithDescription("Exclui um relatório fotográfico e suas fotos (banco e R2). Exclusão definitiva, sem lixeira. Somente Admin/Master; audita relatorio_fotografico_excluido");

app.MapGet("/obras/{obraId:guid}/relatorios-fotograficos", async (Guid obraId, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatoriosFotograficosByObra")
.WithDescription("Lista relatórios fotográficos de uma obra");

app.MapPost("/relatorios-fotograficos/{id:guid}/fotos", async (Guid id, IFormFile file, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal, DateOnly? dataFoto, string? descricao, int? ordem = null) =>
{
    // Padrao: resolve so o obra_id (sem carregar fotos) -> acesso -> validacoes -> R2.
    var obraId = await service.ResolveRelatorioAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!KhazObras.Api.Validation.FileUploadValidator.IsValid(file, out var validationError))
    {
        return Results.BadRequest(new { message = validationError });
    }

    // O validador generico aceita PDF/Office; foto aceita apenas imagem (extensao + content-type).
    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (!FotoRegras.IsImagem(extension, file.ContentType))
    {
        return Results.BadRequest(new { message = "Foto deve ser uma imagem (jpg, jpeg, png, webp ou gif)." });
    }

    // descricao <= 255, dataFoto entre 2000-01-01 e amanha, ordem >= 0 (antes de qualquer envio ao R2).
    var erros = FotoRegras.Erros(descricao, dataFoto, ordem);
    if (erros.Count > 0)
    {
        return Results.BadRequest(new { message = string.Join(" ", erros.Values.SelectMany(mensagens => mensagens)) });
    }

    using var stream = file.OpenReadStream();
    var result = await service.UploadFotoAsync(id, obraId.Value, stream, file.FileName, file.ContentType, dataFoto, descricao, ordem);

    return result.Status switch
    {
        FotoUploadStatus.Created => Results.Created($"/fotos/{result.Foto!.Id}", result.Foto),
        FotoUploadStatus.LimiteExcedido => Results.BadRequest(new { message = $"Cada relatorio aceita no maximo {FotoRegras.MaxFotosPorRelatorio} fotos." }),
        FotoUploadStatus.NomeArquivoInvalido => Results.BadRequest(new { message = $"O nome do arquivo deve ter de 1 a {FotoRegras.MaxNomeArquivo} caracteres." }),
        _ => Results.NotFound()
    };
})
.DisableAntiforgery()
.RequireAuthorization("AdminOrMaster")
.WithName("UploadFoto")
.WithDescription("Adiciona foto (jpg/jpeg/png/webp/gif, máx 10MB, magic bytes) a um relatório fotográfico; no máximo 100 fotos por relatório (400 ao exceder). dataFoto, descricao e ordem na query string; sem ordem, a foto vai para o fim. Somente Admin/Master");

app.MapPatch("/relatorios-fotograficos/{id:guid}/fotos/ordem", async (Guid id, ReordenarFotosRequest request, IValidator<ReordenarFotosRequest> validator, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await service.ResolveRelatorioAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await service.ReordenarFotosAsync(id, obraId.Value, request, userId);
    if (result is null)
    {
        // Mesma resposta para id inexistente e id de outra obra/relatorio (nao confirma que o registro existe em outro lugar).
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["Fotos"] = ["Uma ou mais fotos informadas nao pertencem a este relatorio."]
        });
    }

    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("ReordenarFotos")
.WithDescription("Reordena fotos de um relatório em lote (máx. 200; tudo-ou-nada: foto de outro relatório/obra = 400 sem alterar nada). Somente Admin/Master; audita fotos_reordenadas");

app.MapPatch("/fotos/{fotoId:guid}", async (Guid fotoId, System.Text.Json.JsonElement body, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var obraId = await service.ResolveFotoAsync(fotoId);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!UpdateFotoRequestParser.TryParse(body, out var request, out var erros))
    {
        return Results.ValidationProblem(erros);
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await service.UpdateFotoAsync(fotoId, obraId.Value, request, userId);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("UpdateFoto")
.WithDescription("Altera descrição, data e/ou ordem de uma foto (PATCH parcial: só os campos enviados; null limpa descrição/data). Somente Admin/Master; audita foto_editada");

app.MapDelete("/fotos/{fotoId:guid}", async (Guid fotoId, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal, ILogger<Program> logger) =>
{
    var obraId = await service.ResolveFotoAsync(fotoId);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await service.DeleteFotoAsync(fotoId, obraId.Value, userId);
    if (result is null)
    {
        return Results.NotFound();
    }

    if (result.FalhasNoStorage > 0)
    {
        logger.LogWarning("Foto {FotoId} removida do banco, mas o arquivo nao foi removido do storage", fotoId);
    }

    return Results.NoContent();
})
.RequireAuthorization("AdminOrMaster")
.WithName("DeleteFoto")
.WithDescription("Remove uma foto (banco e R2). Somente Admin/Master; audita foto_removida");

app.MapGet("/fotos/{fotoId:guid}/arquivo", async (Guid fotoId, RelatorioFotograficoService service, ObraAccessService accessService, ClaimsPrincipal principal, HttpContext httpContext) =>
{
    var obraId = await service.ResolveFotoAsync(fotoId);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.DownloadFotoAsync(fotoId, obraId.Value);
    if (result is null)
    {
        return Results.NotFound();
    }

    var (content, fileName, contentType) = result.Value;
    httpContext.Response.Headers["X-Content-Type-Options"] = "nosniff";
    return Results.File(content, contentType, fileName);
})
.RequireAuthorization()
.WithName("DownloadFoto")
.WithDescription("Baixa o arquivo de uma foto de relatório fotográfico (cliente: somente da própria obra)");

app.MapPost("/relatorios-mensais", async (CreateRelatorioMensalRequest request, IValidator<CreateRelatorioMensalRequest> validator, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var validation = await validator.ValidateAsync(request);
    if (!validation.IsValid)
    {
        return Results.ValidationProblem(validation.ToDictionary());
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, request.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    var result = await service.CreateAsync(request, userId);
    return Results.Created($"/relatorios-mensais/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateRelatorioMensal")
.WithDescription("Cria relatório mensal para uma obra. Estados: draft → published");

app.MapGet("/relatorios-mensais/{id:guid}", async (Guid id, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var result = await service.GetByIdAsync(id);
    if (result is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, result.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        // Cliente: só publicados e sem ids internos (rascunho = 404).
        var visaoCliente = await service.GetPublishedByIdForClientAsync(id);
        return visaoCliente is null ? Results.NotFound() : Results.Ok(visaoCliente);
    }

    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatorioMensalById")
.WithDescription("Retorna detalhes de um relatório mensal");

app.MapGet("/obras/{obraId:guid}/relatorios-mensais", async (Guid obraId, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal, bool onlyPublished = false) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        // Cliente: ignora onlyPublished, sempre só publicados e sem ids internos.
        return Results.Ok(await service.GetPublishedByObraIdForClientAsync(obraId));
    }

    var result = await service.GetByObraIdAsync(obraId, onlyPublished);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetRelatoriosMensaisByObra")
.WithDescription("Lista relatórios mensais de uma obra (filtrável por status published)");

app.MapPost("/relatorios-mensais/{id:guid}/publish", async (Guid id, RelatorioMensalService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    var existing = await service.GetByIdAsync(id);
    if (existing is null)
    {
        return Results.NotFound();
    }

    if (!accessService.IsAdminOrMaster(principal))
    {
        return Results.Forbid();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, existing.ObraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    try
    {
        var result = await service.PublishAsync(id);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { message = ex.Message });
    }
})
.RequireAuthorization()
.WithName("PublishRelatorioMensal")
.WithDescription("Publica relatório mensal (transição: draft → published). Somente Admin/Master");

app.MapPost("/obras/{obraId:guid}/projetos", async (Guid obraId, IFormFile file, ProjetoDocumentoService service, ObraAccessService accessService, ClaimsPrincipal principal, Guid? etapaId, string? tipoDocumento) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    if (!KhazObras.Api.Validation.FileUploadValidator.IsValid(file, out var validationError))
    {
        return Results.BadRequest(new { message = validationError });
    }

    // Etapa informada precisa ser desta obra (senao 400); nada vai ao R2 antes dessa checagem.
    if (etapaId is not null && !await service.EtapaPertenceAObraAsync(etapaId.Value, obraId))
    {
        return Results.BadRequest(new { message = "Etapa nao encontrada nesta obra." });
    }

    using var stream = file.OpenReadStream();
    var result = await service.UploadAsync(obraId, etapaId, stream, file.FileName, file.ContentType, tipoDocumento);
    return Results.Created($"/projetos/{result.Id}", result);
})
.DisableAntiforgery()
.RequireAuthorization("AdminOrMaster")
.WithName("UploadProjetoDocumento")
.WithDescription("Anexa documento/projeto a uma obra (máx 10MB, validado por magic bytes)");

app.MapGet("/projetos/{id:guid}/download", async (Guid id, ProjetoDocumentoService service, ObraAccessService accessService, ClaimsPrincipal principal, HttpContext httpContext) =>
{
    var obraId = await service.ResolveAsync(id);
    if (obraId is null)
    {
        return Results.NotFound();
    }

    try
    {
        await accessService.EnsureAccessAsync(principal, obraId.Value);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    // So depois de todas as checagens o arquivo e lido do R2.
    var result = await service.DownloadAsync(id, obraId.Value);
    if (result is null)
    {
        return Results.NotFound();
    }

    var (content, fileName, contentType) = result.Value;
    httpContext.Response.Headers["X-Content-Type-Options"] = "nosniff";
    return Results.File(content, contentType, fileName);
})
.RequireAuthorization()
.WithName("DownloadProjetoDocumento")
.WithDescription("Baixa documento/projeto (Admin/Master ou cliente vinculado a obra)");

app.MapGet("/obras/{obraId:guid}/projetos", async (Guid obraId, ProjetoDocumentoService service, ObraAccessService accessService, ClaimsPrincipal principal) =>
{
    try
    {
        await accessService.EnsureAccessAsync(principal, obraId);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }

    var result = await service.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetProjetosByObra")
.WithDescription("Lista documentos/projetos de uma obra");

app.MapPost("/fornecedores", async (CreateFornecedorRequest request, FornecedorService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/fornecedores/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateFornecedor")
.WithDescription("Cria fornecedor (módulo interno, sem escopo de obra)");

app.MapGet("/fornecedores/{id:guid}", async (Guid id, FornecedorService service) =>
{
    var result = await service.GetByIdAsync(id);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetFornecedorById")
.WithDescription("Retorna detalhes de um fornecedor");

app.MapGet("/fornecedores", async (FornecedorService service) =>
{
    var result = await service.GetAllAsync();
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetFornecedores")
.WithDescription("Lista todos os fornecedores");

app.MapPost("/prestadores", async (CreatePrestadorRequest request, PrestadorService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/prestadores/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreatePrestador")
.WithDescription("Cria prestador de serviço (módulo interno, sem escopo de obra)");

app.MapGet("/prestadores/{id:guid}", async (Guid id, PrestadorService service) =>
{
    var result = await service.GetByIdAsync(id);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetPrestadorById")
.WithDescription("Retorna detalhes de um prestador");

app.MapGet("/obras/{obraId:guid}/prestadores", async (Guid obraId, PrestadorService service) =>
{
    var result = await service.GetByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetPrestadoresByObra")
.WithDescription("Lista prestadores vinculados a uma obra");

app.MapPost("/estoque/itens", async (CreateEstoqueItemRequest request, EstoqueService service) =>
{
    var result = await service.CreateItemAsync(request);
    return Results.Created($"/estoque/itens/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateEstoqueItem")
.WithDescription("Cria item de estoque para uma obra");

app.MapGet("/obras/{obraId:guid}/estoque/itens", async (Guid obraId, EstoqueService service) =>
{
    var result = await service.GetItensByObraIdAsync(obraId);
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetEstoqueItensByObra")
.WithDescription("Lista itens de estoque de uma obra");

app.MapPost("/estoque/itens/{itemId:guid}/movimentacoes", async (Guid itemId, CreateMovimentacaoRequest request, EstoqueService service) =>
{
    try
    {
        var result = await service.AddMovimentacaoAsync(itemId, request);
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }
})
.RequireAuthorization("AdminOrMaster")
.WithName("AddEstoqueMovimentacao")
.WithDescription("Registra movimentação (entrada/saída) de estoque");

app.MapPost("/pipeline", async (CreatePipelineRequest request, PipelineService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/pipeline/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreatePipeline")
.WithDescription("Cria etapa de pipeline para gestão de processos internos");

app.MapGet("/pipeline", async (PipelineService service) =>
{
    var result = await service.GetAllAsync();
    return Results.Ok(result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("GetPipeline")
.WithDescription("Lista todos os itens de pipeline");

app.MapPost("/notificacoes", async (CreateNotificacaoRequest request, NotificacaoService service) =>
{
    var result = await service.CreateAsync(request);
    return Results.Created($"/notificacoes/{result.Id}", result);
})
.RequireAuthorization("AdminOrMaster")
.WithName("CreateNotificacao")
.WithDescription("Cria notificação para módulo específico (email/WhatsApp - apenas base criada)");

app.MapGet("/notificacoes/minhas", async (ClaimsPrincipal principal, NotificacaoService service) =>
{
    var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var result = await service.GetByUserIdAsync(userId);
    return Results.Ok(result);
})
.RequireAuthorization()
.WithName("GetMinhasNotificacoes")
.WithDescription("Lista notificações do usuário autenticado");

app.MapPost("/notificacoes/{id:guid}/marcar-lida", async (Guid id, ClaimsPrincipal principal, NotificacaoService service) =>
{
    var userId = Guid.Parse(principal.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    try
    {
        await service.MarkAsReadAsync(id, userId);
        return Results.NoContent();
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }
    catch (InvalidOperationException)
    {
        return Results.NotFound();
    }
})
.RequireAuthorization()
.WithName("MarkNotificacaoAsRead")
.WithDescription("Marca notificação como lida (IDOR prevention)");

app.MapGet("/auditoria/{entidade}/{entidadeId:guid}", async (string entidade, Guid entidadeId, LogAuditoriaService service) =>
{
    var result = await service.GetByEntidadeAsync(entidade, entidadeId);
    return Results.Ok(result);
})
.RequireAuthorization("MasterOnly")
.WithName("GetAuditoriaByEntidade")
.WithDescription("Consulta log de auditoria por entidade (somente Master)");

app.MapPost("/users/{userId:guid}/obras/{obraId:guid}", async (Guid userId, Guid obraId, IUserObraRepository userObraRepository) =>
{
    await userObraRepository.LinkAsync(userId, obraId);
    return Results.NoContent();
})
.RequireAuthorization("MasterOnly")
.WithName("LinkUserToObra")
.WithDescription("Vincula usuário a uma obra (somente Master)");

app.MapGet("/users", async (IUserRepository userRepository) =>
{
    var users = await userRepository.GetAllAsync();
    var result = users.Select(u => new UserResponse(u.Id, u.Name, u.Email, u.Role.ToString(), u.IsActive, u.CreatedAt)).ToList();
    return Results.Ok(result);
})
.RequireAuthorization("MasterOnly")
.WithName("GetUsers")
.WithDescription("Lista todos os usuários (somente Master)");

app.Run();

// Necessario para WebApplicationFactory<Program> nos testes de integracao HTTP.
public partial class Program { }
