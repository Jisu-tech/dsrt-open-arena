export type CredentialErrorCode =
  | 'CREDENTIAL_NOT_FOUND'
  | 'CREDENTIAL_DISABLED'
  | 'CREDENTIAL_DECRYPTION_FAILED'
  | 'INVALID_API_KEY'
  | 'WORKSPACE_ACCESS_DENIED'
  | 'UNSUPPORTED_PROVIDER';

export class CredentialError extends Error {
  constructor(
    public code: CredentialErrorCode,
    message: string,
    public provider?: string
  ) {
    super(message);
    this.name = 'CredentialError';
  }
}