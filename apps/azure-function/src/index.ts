// Register all Azure Function triggers by importing their modules.
// Azure Functions v4 discovers triggers via side effects on import.

import { initializeStorage } from './storage/stores.js';

// Initialize storage containers in the background.
// Must not block module evaluation — a startup failure must not prevent function registration.
initializeStorage().catch((err) => console.error('[aarm] Storage init failed:', err));

import './triggers/timerTrigger.js';
import './http/statusHandler.js';
import './http/dataHandlers.js';
import './http/tenantCrudHandlers.js';
import './http/dashboardHandler.js';
import './http/reportHandler.js';
