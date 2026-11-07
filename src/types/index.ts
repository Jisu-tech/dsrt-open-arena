export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type WorkspaceMembership = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  workspace?: Workspace;
};

export type CredentialItem = {
  id: string;
  provider: string;
  key_mask: string;
  status: string;
  last_validated_at: string | null;
  total_cost_usd: number;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  default_provider: string;
  default_model: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  user_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  is_amplified: boolean;
  token_count_prompt: number;
  token_count_completion: number;
  provider_cost_usd: number;
  dsrt_cost_usd: number;
  latency_ms: number;
  created_at: string;
};

export type ApiError = {
  error: string;
  code?: string;
};

export type ApiSuccess<T> = {
  data: T;
};

// ─── V3 re-exports (non-breaking) ──────────────────────────────────────────
export type {
  V3Provider,
  ModelLifecycleState,
  WorkspaceAccessibility,
  SuppliedPricing,
  CatalogueSyncResult,
} from '@/lib/v3/contracts/registry';

export type {
  NormalizedUsage,
} from '@/lib/v3/providers/usage-normalizer';

export type {
  DecisionResult,
  CandidateModel,
} from '@/lib/v3/ptis';