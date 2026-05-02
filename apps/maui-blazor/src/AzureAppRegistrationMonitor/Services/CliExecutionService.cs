using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Invokes the aarm CLI as a child process and deserialises the JSON output envelope.
///
/// Binary resolution order:
///   1. aarm.cmd / aarm.exe alongside the app executable (bundled deployment)
///   2. %APPDATA%\npm\aarm.cmd (npm install -g on Windows)
///   3. AARM_CLI_PATH env var pointing to the CLI script + node on PATH (development)
///   4. "aarm" on PATH (npm link)
/// </summary>
public class CliExecutionService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly string _binaryPath;
    private readonly string? _scriptPath; // set when using node <script> mode

    public CliExecutionService()
    {
        (_binaryPath, _scriptPath) = FindBinary();
    }

    /// <summary>Run an aarm command and deserialise the result envelope.</summary>
    public async Task<ResultEnvelope<T>?> RunAsync<T>(
        string tenantNameOrId,
        params string[] args)
    {
        var fullArgs = BuildArgs(tenantNameOrId, args);
        var (stdout, exitCode) = await ExecuteAsync(fullArgs);

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
        var (stdout, _) = await ExecuteAsync(BuildArgs(tenantNameOrId, args));
        return stdout;
    }

    private string[] BuildArgs(string tenantNameOrId, string[] extraArgs)
    {
        var list = new List<string>();
        // When running via "node <script>" the script path is prepended as first arg
        if (_scriptPath is not null) list.Add(_scriptPath);
        list.AddRange(new[] { "--tenant", tenantNameOrId, "--output", "json" });
        list.AddRange(extraArgs);
        return list.ToArray();
    }

    private async Task<(string Stdout, int ExitCode)> ExecuteAsync(string[] args)
    {
        var psi = new ProcessStartInfo
        {
            FileName = _binaryPath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
        };

        foreach (var arg in args) psi.ArgumentList.Add(arg);

        using var process = new Process { StartInfo = psi };
        var stdoutSb = new StringBuilder();
        var stderrSb = new StringBuilder();

        process.OutputDataReceived += (_, e) => { if (e.Data != null) stdoutSb.AppendLine(e.Data); };
        process.ErrorDataReceived  += (_, e) => { if (e.Data != null) stderrSb.AppendLine(e.Data); };

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
    /// Returns (binaryPath, scriptPath?) where scriptPath is non-null when
    /// running via "node &lt;scriptPath&gt;" instead of a native binary.
    /// </summary>
    private static (string Binary, string? Script) FindBinary()
    {
        // 1. Bundled alongside the MAUI app executable
        var appDir = Path.GetDirectoryName(Environment.ProcessPath) ?? ".";
        foreach (var name in new[] { "aarm.cmd", "aarm.exe" })
        {
            var p = Path.Combine(appDir, name);
            if (File.Exists(p)) return (p, null);
        }

        // 2. npm global install — %APPDATA%\npm\aarm.cmd (Windows default)
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var npmCmd = Path.Combine(appData, "npm", "aarm.cmd");
        if (File.Exists(npmCmd)) return (npmCmd, null);

        // 3. AARM_CLI_PATH env var — point to the CLI dist/index.js for development
        //    Usage: $env:AARM_CLI_PATH = "C:\...\packages\cli\dist\index.js"
        var envScript = Environment.GetEnvironmentVariable("AARM_CLI_PATH");
        if (!string.IsNullOrEmpty(envScript) && File.Exists(envScript))
        {
            var node = FindNodeExe();
            if (node is not null) return (node, envScript);
        }

        // 4. PATH fallback — works after npm link or global install
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
