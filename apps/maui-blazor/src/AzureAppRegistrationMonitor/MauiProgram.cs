using Microsoft.Extensions.Logging;
using AzureAppRegistrationMonitor.Services;
using AzureAppRegistrationMonitor.ViewModels;

namespace AzureAppRegistrationMonitor;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();

        builder
            .UseMauiApp<App>()          // correct MAUI entry point
            // .UseNotifyIcon()         // H.NotifyIcon.Maui — re-enable once base app builds (OQ-043)
            .ConfigureFonts(fonts =>
            {
                // Add custom fonts here once .ttf files are placed in Resources/Fonts/
            });

        builder.Services.AddMauiBlazorWebView();

#if DEBUG
        builder.Services.AddBlazorWebViewDeveloperTools();
        builder.Logging.AddDebug();
#endif

        // Infrastructure services
        builder.Services.AddSingleton<CliExecutionService>();
        builder.Services.AddSingleton<TenantConfigRepository>();
        builder.Services.AddSingleton<HistoryRepository>();
        builder.Services.AddSingleton<SystemTrayService>();

        // View models (transient — one per page lifetime)
        builder.Services.AddTransient<TenantOverviewViewModel>();
        builder.Services.AddTransient<PreflightViewModel>();
        builder.Services.AddTransient<DashboardViewModel>();
        builder.Services.AddTransient<SecretListViewModel>();

        return builder.Build();
    }
}
