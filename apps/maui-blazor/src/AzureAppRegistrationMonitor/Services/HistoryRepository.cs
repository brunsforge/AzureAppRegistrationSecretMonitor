using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Persists scan results as JSON files in ~/.aarm/history/.
/// Phase 1 (MVP) storage — SQLite is planned for Phase 2 (ADR-0004).
/// Each scan is stored as a dated JSON file per tenant/environment.
/// </summary>
public class HistoryRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
    };

    private readonly string _historyDir;

    public HistoryRepository()
    {
        _historyDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".aarm", "history");
    }

    public async Task SaveScanAsync(
        string tenantId,
        string environmentName,
        IReadOnlyList<AppRegistrationSummary> apps)
    {
        Directory.CreateDirectory(_historyDir);

        var timestamp = DateTimeOffset.UtcNow;
        var fileName = $"{tenantId}_{environmentName}_{timestamp:yyyyMMddHHmmss}.json";
        var filePath = Path.Combine(_historyDir, fileName);

        var entry = new ScanHistoryEntry(
            TenantId: tenantId,
            EnvironmentName: environmentName,
            ScannedAt: timestamp.ToString("O"),
            AppCount: apps.Count,
            SecretCount: apps.Sum(a => a.SecretCount),
            ExpiredCount: apps.Sum(a => a.ExpiredSecretCount),
            ExpiringCount: apps.Sum(a => a.ExpiringSecretCount),
            Apps: apps);

        var json = JsonSerializer.Serialize(entry, JsonOptions);
        await File.WriteAllTextAsync(filePath, json);
    }

    public async Task<IReadOnlyList<ScanHistoryEntry>> GetHistoryAsync(
        string tenantId,
        string environmentName,
        int maxEntries = 30)
    {
        if (!Directory.Exists(_historyDir))
            return Array.Empty<ScanHistoryEntry>();

        var prefix = $"{tenantId}_{environmentName}_";
        var files = Directory.GetFiles(_historyDir, $"{prefix}*.json")
                             .OrderByDescending(f => f)
                             .Take(maxEntries);

        var entries = new List<ScanHistoryEntry>();
        foreach (var file in files)
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var entry = JsonSerializer.Deserialize<ScanHistoryEntry>(json, JsonOptions);
                if (entry is not null) entries.Add(entry);
            }
            catch { /* skip corrupt files */ }
        }

        return entries;
    }
}

public record ScanHistoryEntry(
    string TenantId,
    string EnvironmentName,
    string ScannedAt,
    int AppCount,
    int SecretCount,
    int ExpiredCount,
    int ExpiringCount,
    IReadOnlyList<AppRegistrationSummary> Apps
);
