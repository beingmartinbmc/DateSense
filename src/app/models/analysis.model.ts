/**
 * Shared analysis domain types. Kept separate from the API service so the pure
 * response-parsing logic (and its tests) don't pull in Angular/HTTP.
 */

export type ConversationStage =
  | 'Opening'
  | 'Building Rapport'
  | 'Momentum Window'
  | 'Stalling'
  | 'Dead'
  | 'Unknown';

export type ConversationMomentum = 'Rising' | 'Flat' | 'Fading' | 'Unknown';

export interface AnalysisResponse {
  attraction_score: number;
  ghosting_risk: number;
  conversation_health: number;
  response_effort_balance: number;
  meetup_readiness: number;
  confidence_score: number;
  rizz_score: number;
  conversation_stage: ConversationStage;
  momentum: ConversationMomentum;
  archetype: string;
  brutal_verdict: string;
  rizz_roast: string;
  insights: string[];
  green_flags: string[];
  red_flags: string[];
  fake_golddigger_risk: string;
  fake_golddigger_reason: string;
  next_move: string;
  reply_suggestions: string[];
  date_ideas: string[];
}

export interface ManualInputData {
  yourName?: string;
  theirName?: string;
  yourAge?: string;
  theirAge?: string;
  platform?: string;
  chatDuration?: string;
  chatMessages: string;
  yourBio?: string;
  theirBio?: string;
  additionalContext?: string;
  /** What the user is hoping to get out of this connection. */
  goal?: string;
}

/** Tone presets for regenerating reply suggestions. */
export type ReplyTone =
  | 'Balanced'
  | 'Playful'
  | 'Flirty'
  | 'Bold'
  | 'Direct'
  | 'Genuine'
  | 'Funny'
  | 'Unhinged';

export const REPLY_TONES: ReplyTone[] = [
  'Balanced',
  'Playful',
  'Flirty',
  'Bold',
  'Direct',
  'Genuine',
  'Funny',
  'Unhinged',
];
