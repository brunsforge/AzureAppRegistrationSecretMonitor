using AzureAppRegistrationMonitor.Models;
using AzureAppRegistrationMonitor.Services;

namespace AzureAppRegistrationMonitor.ViewModels;

public class TenantOverviewViewModel
{
    private readonly TenantConfigRepository _repo;
    private readonly CliExecutionService _cli;

    public TenantOverviewViewModel(TenantConfigRepository repo, CliExecutionService cli)
    {
        _repo = repo;
        _cli = cli;
    }

    public IReadOnlyList<TenantProfile> Tenants { get; private set; } = Array.Empty<TenantProfile>();
    public bool IsLoading { get; private set; }
    public string? ErrorMessage { get; private set; }

    // Per-tenant preflight state
    private readonly Dictionary<string, PreflightResult?> _preflightCache = new();
    private readonly Dictionary<string, bool> _preflightRunning = new();

    public PreflightResult? GetPreflight(string tenantId)
        => _preflightCache.GetValueOrDefault(tenantId);

    public bool IsPreflightRunning(string tenantId)
        => _preflightRunning.GetValueOrDefault(tenantId);

    public async Task LoadTenantsAsync()
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            Tenants = await _repo.ListTenantsAsync();
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// Cloud Mode: populate the tenant list from an externally loaded source
    /// (Azure Function /api/tenants) without touching the local repository.
    /// </summary>
    public Task LoadFromExternalAsync(IReadOnlyList<TenantProfile> tenants)
    {
        Tenants = tenants;
        IsLoading = false;
        ErrorMessage = null;
        return Task.CompletedTask;
    }

    public async Task RunPreflightAsync(string tenantNameOrId, Action stateChanged)
    {
        _preflightRunning[tenantNameOrId] = true;
        stateChanged();

        try
        {
            var envelope = await _cli.RunAsync<PreflightResult>(
                tenantNameOrId, "preflight", "run");

            if (envelope?.Data is not null)
                _preflightCache[envelope.Data.TenantId] = envelope.Data;
        }
        catch (Exception ex)
        {
            ErrorMessage = $"Preflight failed for {tenantNameOrId}: {ex.Message}";
        }
        finally
        {
            _preflightRunning[tenantNameOrId] = false;
            stateChanged();
        }
    }
}
