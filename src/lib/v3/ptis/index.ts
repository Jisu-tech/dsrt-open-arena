export interface CandidateModel {
  provider: string;
  model: string;
  score: number;
  reason: string;
}

export interface DecisionResult {
  chosen: CandidateModel;
  alternatives: CandidateModel[];
  reasoning: string;
}
