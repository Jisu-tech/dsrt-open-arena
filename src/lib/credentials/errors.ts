export class CredentialError extends Error {
  public readonly code: string;
  public readonly provider: string;

  constructor(code: string, message: string, provider: string) {
    super(message);
    this.name = 'CredentialError';
    this.code = code;
    this.provider = provider;
    Object.setPrototypeOf(this, CredentialError.prototype);
  }
}
