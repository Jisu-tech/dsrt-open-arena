import type { SupabaseClient } from '@supabase/supabase-js';

export class RepositoryError extends Error {
  public readonly code: string;
  public readonly details: string | null;
  public readonly hint: string | null;

  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'RepositoryError';
    
    // Supabase PostgREST error structure mapping
    if (originalError && typeof originalError === 'object') {
      const err = originalError as Record<string, unknown>;
      this.code = typeof err.code === 'string' ? err.code : 'UNKNOWN';
      this.details = typeof err.details === 'string' ? err.details : null;
      this.hint = typeof err.hint === 'string' ? err.hint : null;
    } else {
      this.code = 'UNKNOWN';
      this.details = null;
      this.hint = null;
    }
  }
}

export abstract class BaseRepository {
  /**
   * Requires an initialized SupabaseClient.
   * RLS applies automatically if this client was created with a user session.
   */
  constructor(protected readonly supabase: SupabaseClient) {}

  /**
   * Uniform error handler for Supabase responses.
   * Never fails silently. Always throws a traceable RepositoryError.
   */
  protected handleError(error: unknown, operation: string, customMessage?: string): never {
    const msg = customMessage ?? `Database operation failed: ${operation}`;
    
    // Log internally for debugging, but sanitize before sending to client
    console.error(`[RepositoryError:${operation}]`, error);
    
    throw new RepositoryError(msg, operation, error);
  }

  /**
   * Helper to validate single-row updates/inserts.
   */
  protected ensureData<T>(data: T | null | undefined, error: unknown, operation: string): T {
    if (error) this.handleError(error, operation);
    if (!data) {
      throw new RepositoryError(`No data returned from operation`, operation);
    }
    return data;
  }
}