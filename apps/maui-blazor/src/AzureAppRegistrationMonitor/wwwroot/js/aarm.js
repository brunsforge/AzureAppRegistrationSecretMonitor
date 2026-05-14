// AARM — client-side helpers for Blazor components

window.aarm = {

    /**
     * Renders an Adaptive Card JSON string into a container div.
     * The JSON may be either the raw card object or the full Teams message wrapper
     * (with attachments[0].content).
     * Returns true on success, false with an error message on failure.
     */
    renderAdaptiveCard: function (containerId, cardJson) {
        const container = document.getElementById(containerId);
        if (!container) return false;

        if (typeof AdaptiveCards === 'undefined') {
            container.innerHTML = '<p style="color:#f59e0b;padding:1rem">Adaptive Cards library not loaded. Check internet connectivity.</p>';
            return false;
        }

        try {
            const parsed = JSON.parse(cardJson);
            // Support both raw card and Teams message wrapper format
            const cardData = parsed.attachments?.[0]?.content ?? parsed;

            const ac = new AdaptiveCards.AdaptiveCard();
            ac.hostConfig = new AdaptiveCards.HostConfig({
                fontFamily: "system-ui, -apple-system, sans-serif",
                containerStyles: {
                    default: { backgroundColor: "#1e293b", foregroundColors: { default: { default: "#e2e8f0" } } },
                    emphasis: { backgroundColor: "#0f172a" }
                }
            });
            ac.parse(cardData);

            const rendered = ac.render();
            container.innerHTML = '';
            if (rendered) {
                rendered.style.maxWidth = '560px';
                container.appendChild(rendered);
            }
            return true;
        } catch (e) {
            container.innerHTML = '<pre style="color:#ef4444;padding:1rem;font-size:.8rem">' + e.message + '</pre>';
            return false;
        }
    }
};
