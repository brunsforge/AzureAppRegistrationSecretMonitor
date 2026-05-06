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
            .UseMauiApp<App>()
            // .UseNotifyIcon()  — re-enable once H.NotifyIcon.Maui API is verified (OQ-043)
            .ConfigureFonts(fonts =>
            {
                // Add custom fonts once .ttf files are placed in Resources/Fonts/
            });

        builder.Services.AddMauiBlazorWebView();

#if DEBUG
        builder.Services.AddBlazorWebViewDeveloperTools();
        builder.Logging.AddDebug();
#endif

        // Infrastructure services
        builder.Services.AddSingleton<AppStateService>();
        builder.Services.AddSingleton<AppInitializationService>();
        builder.Services.AddSingleton<CliExecutionService>();
        builder.Services.AddSingleton<TenantConfigRepository>();
        builder.Services.AddSingleton<HistoryRepository>();
        builder.Services.AddSingleton<SettingsService>();
        builder.Services.AddSingleton<SystemTrayService>();
        builder.Services.AddSingleton<TeamsNotificationService>();
        builder.Services.AddSingleton<CredentialRepository>();
        builder.Services.AddSingleton<NotificationService>();

        // View models
        builder.Services.AddTransient<TenantOverviewViewModel>();
        builder.Services.AddTransient<PreflightViewModel>();
        builder.Services.AddTransient<DashboardViewModel>();
        builder.Services.AddTransient<SecretListViewModel>();

        return builder.Build();
    }
}
