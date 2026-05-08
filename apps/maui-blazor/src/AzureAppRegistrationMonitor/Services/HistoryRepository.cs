using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Persists scan results as JSON files in ~/.aarm/history/{tenantId}/.
/// Phase 1 (MVP) storage — SQLite is planned for Phase 2 (ADR-0004).
/// </summary>
public class HistoryRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
    };

    private readonly string _historyRoot;

    public HistoryRepository()
    {
        _historyRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".aarm", "history");
    }

    public async Task SaveScanAsync(
        string tenantId,
        IReadOnlyList<AppRegistrationSummary> apps)
    {
        var dir = Path.Combine(_historyRoot, tenantId);
        Directory.CreateDirectory(dir);

        var timestamp = DateTimeOffset.UtcNow;
        var fileName = $"apps-{timestamp:yyyyMMddHHmmss}.json";
        var filePath = Path.Combine(dir, fileName);

        var entry = new ScanHistoryEntry(
            TenantId: tenantId,
            ScannedAt: timestamp.ToString("O"),
            AppCount: apps.Count,
            SecretCount: apps.Sum(a => a.SecretCount),
            ExpiredCount: apps.Sum(a => a.ExpiredSecretCount),
            ExpiringCount: apps.Sum(a => a.ExpiringSecretCount),
            Apps: apps);

        await File.WriteAllTextAsync(filePath, JsonSerializer.Serialize(entry, JsonOptions));
    }

    public async Task<IReadOnlyList<ScanHistoryEntry>> GetHistoryAsync(
        string tenantId,
        int maxEntries = 30)
    {
        var dir = Path.Combine(_historyRoot, tenantId);
        if (!Directory.Exists(dir))
            return Array.Empty<ScanHistoryEntry>();

        var files = Directory.GetFiles(dir, "apps-*.json")
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
    string ScannedAt,
    int AppCount,
    int SecretCount,
    int ExpiredCount,
    int ExpiringCount,
    IReadOnlyList<AppRegistrationSummary> Apps
);
