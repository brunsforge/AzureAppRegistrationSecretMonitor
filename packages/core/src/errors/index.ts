export class AarmError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthError extends AarmError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
  }
}

export class PermissionError extends AarmError {
  constructor(
    message: string,
    public readonly missingPermission?: string,
  ) {
    super(message, 'PERMISSION_ERROR');
  }
}

export class GraphError extends AarmError {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message, 'GRAPH_ERROR');
  }
}

export class ConfigError extends AarmError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
  }
}
