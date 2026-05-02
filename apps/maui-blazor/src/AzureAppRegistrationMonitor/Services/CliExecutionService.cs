using System.Diagnostics;
using System.Text;
using System.Text.Json;
using AzureAppRegistrationMonitor.Models;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Invokes the aarm CLI as a child process and deserialises the JSON output envelope.
/// The CLI is located by checking the application directory first (bundled binary),
/// then falling back to PATH.
/// </summary>
public class CliExecutionService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly string _binaryPath;

    public CliExecutionService()
    {
        _binaryPath = FindBinary();
    }

    /// <summary>Run an aarm command and deserialise the result envelope.</summary>
    /// <param name="tenantNameOrId">Tenant name or ID to pass via --tenant.</param>
    /// <param name="args">Additional CLI arguments (e.g. "secrets", "expiring", "--days", "30").</param>
    public async Task<ResultEnvelope<T>?> RunAsync<T>(
        string tenantNameOrId,
        params string[] args)
    {
        var fullArgs = BuildArgs(tenantNameOrId, args);
        var (stdout, exitCode) = await ExecuteAsync(fullArgs);

        if (string.IsNullOrWhiteSpace(stdout))
        {
            throw new CliException($"aarm exited with code {exitCode} and produced no output.");
        }

        try
        {
            return JsonSerializer.Deserialize<ResultEnvelope<T>>(stdout, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new CliException($"Failed to parse aarm output: {ex.Message}", ex);
        }
    }

    /// <summary>Run an aarm command and return raw stdout (for commands without a typed envelope).</summary>
    public async Task<string> RunRawAsync(string tenantNameOrId, params string[] args)
    {
        var fullArgs = BuildArgs(tenantNameOrId, args);
        var (stdout, _) = await ExecuteAsync(fullArgs);
        return stdout;
    }

    private static string[] BuildArgs(string tenantNameOrId, string[] extraArgs)
    {
        var args = new List<string> { "--tenant", tenantNameOrId, "--output", "json" };
        args.AddRange(extraArgs);
        return args.ToArray();
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

        foreach (var arg in args)
        {
            psi.ArgumentList.Add(arg);
        }

        using var process = new Process { StartInfo = psi };
        var stdoutBuilder = new StringBuilder();
        var stderrBuilder = new StringBuilder();

        process.OutputDataReceived += (_, e) => { if (e.Data != null) stdoutBuilder.AppendLine(e.Data); };
        process.ErrorDataReceived += (_, e) => { if (e.Data != null) stderrBuilder.AppendLine(e.Data); };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync();

        if (process.ExitCode != 0 && process.ExitCode != 10)
        {
            var stderr = stderrBuilder.ToString().Trim();
            throw new CliException(
                $"aarm exited with code {process.ExitCode}." +
                (string.IsNullOrWhiteSpace(stderr) ? "" : $" stderr: {stderr}"),
                process.ExitCode);
        }

        return (stdoutBuilder.ToString().Trim(), process.ExitCode);
    }

    private static string FindBinary()
    {
        // 1. Alongside the app executable (bundled deployment)
        var appDir = Path.GetDirectoryName(Environment.ProcessPath) ?? ".";
        var bundledCmd = Path.Combine(appDir, "aarm.cmd");
        if (File.Exists(bundledCmd)) return bundledCmd;

        var bundledExe = Path.Combine(appDir, "aarm.exe");
        if (File.Exists(bundledExe)) return bundledExe;

        // 2. Fall back to PATH (globally installed via npm install -g)
        return "aarm";
    }
}

public class CliException : Exception
{
    public int? ExitCode { get; }

    public CliException(string message, int exitCode) : base(message)
        => ExitCode = exitCode;

    public CliException(string message, Exception inner) : base(message, inner) { }

    public CliException(string message) : base(message) { }
}
