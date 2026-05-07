// Register all Azure Function triggers by importing their modules.
// Azure Functions v4 discovers triggers via side effects on import.

import { initializeStorage } from './storage/stores.js';

// Ensure Blob Storage containers exist before any trigger fires.
// createIfNotExists is idempotent — safe on every cold start.
await initializeStorage();

import './triggers/timerTrigger.js';
import './http/statusHandler.js';
import './http/dataHandlers.js';
import './http/tenantCrudHandlers.js';
import './http/dashboardHandler.js';
import './http/reportHandler.js';
