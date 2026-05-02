using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Reads and writes tenant profiles from ~/.aarm/tenants.json.
/// Shares the same config file as the aarm CLI.
/// </summary>
public class TenantConfigRepository
{
    private static readonly JsonSerializerOptions ReadOptions  = new() { PropertyNameCaseInsensitive = true };
    private static readonly JsonSerializerOptions WriteOptions = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly string _configDir;

    public TenantConfigRepository()
    {
        _configDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".aarm");
    }

    public TenantConfigRepository(string configDir) => _configDir = configDir;

    private string TenantsFilePath => Path.Combine(_configDir, "tenants.json");

    public async Task<IReadOnlyList<TenantProfile>> ListTenantsAsync()
    {
        if (!File.Exists(TenantsFilePath)) return Array.Empty<TenantProfile>();
        try
        {
            var json = await File.ReadAllTextAsync(TenantsFilePath);
            return JsonSerializer.Deserialize<IReadOnlyList<TenantProfile>>(json, ReadOptions)
                   ?? Array.Empty<TenantProfile>();
        }
        catch (JsonException) { return Array.Empty<TenantProfile>(); }
    }

    public async Task<TenantProfile?> GetTenantAsync(string nameOrId)
    {
        var tenants = await ListTenantsAsync();
        return tenants.FirstOrDefault(t => t.TenantId == nameOrId || t.DisplayName == nameOrId);
    }

    /// <summary>
    /// Update the auth mode of an existing tenant.
    /// Only non-secret modes (interactive-browser, device-code, azure-cli) should be
    /// set from the MAUI UI — secret-bearing modes must be (re)configured via the CLI.
    /// </summary>
    public async Task UpdateAuthModeAsync(string tenantId, string newAuthMode)
    {
        var tenants = (await ListTenantsAsync()).ToList();
        var idx = tenants.FindIndex(t => t.TenantId == tenantId);
        if (idx < 0) return;

        var existing = tenants[idx];
        tenants[idx] = existing with
        {
            AuthMode    = newAuthMode,
            UpdatedAt   = DateTimeOffset.UtcNow.ToString("O"),
        };

        await SaveAllAsync(tenants);
    }

    private async Task SaveAllAsync(IEnumerable<TenantProfile> tenants)
    {
        Directory.CreateDirectory(_configDir);
        await File.WriteAllTextAsync(TenantsFilePath, JsonSerializer.Serialize(tenants, WriteOptions));
    }
}
