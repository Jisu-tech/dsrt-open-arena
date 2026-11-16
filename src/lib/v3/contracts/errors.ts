import {
  ErrorSeverity,
  ErrorCategory,
  ErrorRecoverability,
} from './enums';

export { ErrorSeverity, ErrorCategory, ErrorRecoverability };

export class V3Error extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly recoverability: ErrorRecoverability;
  public readonly code?: string;

  constructor(
    message: string,
    category: ErrorCategory = 'internal',
    severity: ErrorSeverity = 'error',
    recoverability: ErrorRecoverability = 'non_retryable',
    code?: string
  ) {
    super(message);
    this.name = 'V3Error';
    this.category = category;
    this.severity = severity;
    this.recoverability = recoverability;
    this.code = code;
  }
}
