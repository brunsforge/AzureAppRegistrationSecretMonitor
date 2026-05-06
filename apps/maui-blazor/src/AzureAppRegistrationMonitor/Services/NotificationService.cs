using Windows.UI.Notifications;

namespace AzureAppRegistrationMonitor.Services;

/// <summary>
/// Shows Windows toast notifications. Falls back silently if the
/// notification subsystem is unavailable (e.g. in some CI environments).
/// </summary>
public class NotificationService
{
    private const string AppId = "AARM";

    public void Show(string title, string? body = null)
    {
        try
        {
            var templateType = body is not null
                ? ToastTemplateType.ToastText02
                : ToastTemplateType.ToastText01;

            var xml = ToastNotificationManager.GetTemplateContent(templateType);
            var textNodes = xml.GetElementsByTagName("text");
            textNodes[0].InnerText = title;
            if (body is not null && textNodes.Length > 1)
                textNodes[1].InnerText = body;

            ToastNotificationManager.CreateToastNotifier(AppId)
                .Show(new ToastNotification(xml));
        }
        catch { /* notifications unavailable — fail silently */ }
    }
}
