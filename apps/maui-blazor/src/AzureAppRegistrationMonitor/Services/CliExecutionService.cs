using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Invokes the aarm CLI as a child process and deserialises the JSON output envelope.
///
/// Binary resolution order (checked on every invocation so Settings changes take effect immediately):
///   1. aarm.cmd / aarm.exe alongside the app executable  (bundled deployment)
///   2. %APPDATA%\npm\aarm.cmd                            (npm install -g on Windows)
///   3. Settings.CliPathOverride → node &lt;script&gt;      (set in AARM Settings page)
///   4. AARM_CLI_PATH env var  → node &lt;script&gt;       (set before launching the app)
///   5. "aarm" on PATH                                     (npm link)
/// </summary>
public class CliExecutionService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly SettingsService _settings;

    /// <summary>
    /// Fired for each line written to stderr by the CLI while a command is running.
    /// Useful for surfacing device-code auth prompts in the UI.
    /// Subscribers must be thread-safe (invoked from a background thread).
    /// </summary>
    public event Action<string>? ProgressMessage;

    public CliExecutionService(SettingsService settings)
    {
        _settings = settings;
    }

    /// <summary>Run an aarm command and deserialise the result envelope.</summary>
    public async Task<ResultEnvelope<T>?> RunAsync<T>(
        string tenantNameOrId,
        params string[] args)
    {
        var (binary, script) = FindBinary();
        var fullArgs = BuildArgs(tenantNameOrId, args, script);
        var (stdout, exitCode) = await ExecuteAsync(binary, fullArgs);

        if (string.IsNullOrWhiteSpace(stdout))
            throw new CliException($"aarm exited with code {exitCode} and produced no output.");

        try
        {
            return JsonSerializer.Deserialize<ResultEnvelope<T>>(stdout, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new CliException($"Failed to parse aarm output: {ex.Message}", ex);
        }
    }

    /// <summary>Run an aarm command and return raw stdout.</summary>
    public async Task<string> RunRawAsync(string tenantNameOrId, params string[] args)
    {
        var (binary, script) = FindBinary();
        var (stdout, _) = await ExecuteAsync(binary, BuildArgs(tenantNameOrId, args, script));
        return stdout;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private static string[] BuildArgs(string tenantNameOrId, string[] extraArgs, string? scriptPath)
    {
        var list = new List<string>();
        if (scriptPath is not null) list.Add(scriptPath); // "node <script> --tenant …"
        list.AddRange(new[] { "--tenant", tenantNameOrId, "--output", "json" });
        list.AddRange(extraArgs);
        return list.ToArray();
    }

    private async Task<(string Stdout, int ExitCode)> ExecuteAsync(string binary, string[] args)
    {
        var psi = new ProcessStartInfo
        {
            FileName = binary,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            UseShellExecute  = false,
            CreateNoWindow   = true,
            StandardOutputEncoding = Encoding.UTF8,
        };
        foreach (var arg in args) psi.ArgumentList.Add(arg);

        using var process = new Process { StartInfo = psi };
        var stdoutSb = new StringBuilder();
        var stderrSb = new StringBuilder();

        process.OutputDataReceived += (_, e) => { if (e.Data != null) stdoutSb.AppendLine(e.Data); };
        process.ErrorDataReceived  += (_, e) =>
        {
            if (e.Data == null) return;
            stderrSb.AppendLine(e.Data);
            ProgressMessage?.Invoke(e.Data);
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync();

        if (process.ExitCode != 0 && process.ExitCode != 10)
        {
            var stderr = stderrSb.ToString().Trim();
            throw new CliException(
                $"aarm exited with code {process.ExitCode}." +
                (string.IsNullOrWhiteSpace(stderr) ? "" : $"\n{stderr}"),
                process.ExitCode);
        }

        return (stdoutSb.ToString().Trim(), process.ExitCode);
    }

    /// <summary>
    /// Resolves the CLI binary on every call so that changes in Settings take
    /// effect immediately without restarting the app.
    /// Returns (binaryPath, scriptPath?) — scriptPath is non-null when running
    /// via "node &lt;scriptPath&gt;" instead of a native aarm binary.
    /// </summary>
    private (string Binary, string? Script) FindBinary()
    {
        // 1a. Bundled cli/ subfolder (ADR-0007): node.exe + aarm.mjs alongside the MAUI exe
        var appDir = Path.GetDirectoryName(Environment.ProcessPath) ?? ".";
        var bundledNode   = Path.Combine(appDir, "cli", "node.exe");
        var bundledScript = Path.Combine(appDir, "cli", "aarm.mjs");
        if (File.Exists(bundledNode) && File.Exists(bundledScript))
            return (bundledNode, bundledScript);

        // 1b. Native aarm binary alongside the MAUI executable
        foreach (var name in new[] { "aarm.cmd", "aarm.exe" })
        {
            var p = Path.Combine(appDir, name);
            if (File.Exists(p)) return (p, null);
        }

        // 2. npm global install location (%APPDATA%\npm\aarm.cmd on Windows)
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var npmCmd = Path.Combine(appData, "npm", "aarm.cmd");
        if (File.Exists(npmCmd)) return (npmCmd, null);

        // 3. Settings page override — highest-priority dev override
        //    Set this in AARM → Settings → CLI path override
        //    e.g.  C:\dev\AzureAppRegistrationSecretMonitor\packages\cli\dist\index.js
        var settingsScript = _settings.Settings.CliPathOverride;
        if (!string.IsNullOrEmpty(settingsScript) && File.Exists(settingsScript))
        {
            var node = FindNodeExe();
            if (node is not null) return (node, settingsScript);
        }

        // 4. AARM_CLI_PATH environment variable (set before launching the app)
        var envScript = Environment.GetEnvironmentVariable("AARM_CLI_PATH");
        if (!string.IsNullOrEmpty(envScript) && File.Exists(envScript))
        {
            var node = FindNodeExe();
            if (node is not null) return (node, envScript);
        }

        // 5. PATH fallback — npm link or global install
        return ("aarm", null);
    }

    private static string? FindNodeExe()
    {
        var locator = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "where" : "which";
        foreach (var candidate in new[] { "node.exe", "node" })
        {
            try
            {
                using var p = Process.Start(new ProcessStartInfo
                {
                    FileName = locator,
                    Arguments = candidate,
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                });
                p?.WaitForExit(2_000);
                if (p?.ExitCode == 0) return candidate;
            }
            catch { /* ignore */ }
        }
        return null;
    }
}

public class CliException : Exception
{
    public int? ExitCode { get; }
    public CliException(string message, int exitCode) : base(message) => ExitCode = exitCode;
    public CliException(string message, Exception inner) : base(message, inner) { }
    public CliException(string message) : base(message) { }
}
