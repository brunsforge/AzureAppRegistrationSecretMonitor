using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Reads tenant profiles from the aarm config directory (~/.aarm/tenants.json).
/// This mirrors what the CLI writes — the MAUI app reads the same file without duplicating storage.
/// </summary>
public class TenantConfigRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly string _configDir;

    public TenantConfigRepository()
    {
        _configDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".aarm");
    }

    public TenantConfigRepository(string configDir)
    {
        _configDir = configDir;
    }

    private string TenantsFilePath => Path.Combine(_configDir, "tenants.json");

    public async Task<IReadOnlyList<TenantProfile>> ListTenantsAsync()
    {
        if (!File.Exists(TenantsFilePath))
            return Array.Empty<TenantProfile>();

        try
        {
            var json = await File.ReadAllTextAsync(TenantsFilePath);
            // Deserialize directly to IReadOnlyList to avoid the List<T>? vs T[] nullability conflict
            return JsonSerializer.Deserialize<IReadOnlyList<TenantProfile>>(json, JsonOptions)
                   ?? Array.Empty<TenantProfile>();
        }
        catch (JsonException)
        {
            return Array.Empty<TenantProfile>();
        }
    }

    public async Task<TenantProfile?> GetTenantAsync(string nameOrId)
    {
        var tenants = await ListTenantsAsync();
        return tenants.FirstOrDefault(t =>
            t.TenantId == nameOrId || t.DisplayName == nameOrId);
    }
}
