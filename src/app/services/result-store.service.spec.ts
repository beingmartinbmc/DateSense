import { describe, it, expect } from 'vitest';
import { ResultStore } from './result-store.service';
import { AnalysisResponse } from '../models/analysis.model';

/**
 * Share tokens travel in a URL that anyone can read, so the privacy promise
 * printed on the share card ("your chat, names and screenshots are never
 * included") has to be enforced by code, not by convention.
 */
function makeResult(overrides: Partial<AnalysisResponse> = {}): AnalysisResponse {
  return {
    attraction_score: 71,
    ghosting_risk: 22,
    conversation_health: 64,
    response_effort_balance: 58,
    meetup_readiness: 47,
    confidence_score: 80,
    rizz_score: 66,
    conversation_stage: 'Building Rapport',
    momentum: 'Rising',
    archetype: 'Enthusiastic Overthinker',
    brutal_verdict: 'She likes you, you just keep changing the subject.',
    rizz_roast: 'Four questions in a row is an interrogation, not a conversation.',
    insights: ['They asked two follow-up questions about your trip.'],
    green_flags: ['Initiates contact'],
    red_flags: ['Replies getting shorter'],
    fake_golddigger_risk: 'None',
    fake_golddigger_reason: 'Nothing transactional in the exchange.',
    next_move: 'Suggest the trivia night directly, with a day attached.',
    reply_suggestions: ['So is that a yes to trivia on Thursday?'],
    date_ideas: ['True-crime trivia night at the pub on 5th'],
    conversation_digest: 'You: what is the most embarrassing song on your playlist?\nThem: haha bold of you',
    ...overrides,
  };
}

describe('ResultStore share tokens', () => {
  const store = new ResultStore();

  it('round-trips the scores and verdict a shared card displays', () => {
    const decoded = store.decodeShareToken(store.encodeShareToken(makeResult()));

    expect(decoded).not.toBeNull();
    expect(decoded!.attraction_score).toBe(71);
    expect(decoded!.rizz_score).toBe(66);
    expect(decoded!.archetype).toBe('Enthusiastic Overthinker');
    expect(decoded!.brutal_verdict).toBe('She likes you, you just keep changing the subject.');
    expect(decoded!.conversation_stage).toBe('Building Rapport');
  });

  it('never leaks conversation content into the token', () => {
    const result = makeResult();
    const decodedToken = atob(
      store.encodeShareToken(result).replace(/-/g, '+').replace(/_/g, '/'),
    );

    // The digest is the closest thing we hold to the raw chat.
    expect(decodedToken).not.toContain('embarrassing song');
    expect(decodedToken).not.toContain(result.conversation_digest);
    expect(decodedToken).not.toContain(result.reply_suggestions[0]);
    expect(decodedToken).not.toContain(result.next_move);
    expect(decodedToken).not.toContain(result.insights[0]);
  });

  it('drops conversation content when decoding, even if a token carries it', () => {
    const decoded = store.decodeShareToken(store.encodeShareToken(makeResult()));

    expect(decoded!.conversation_digest).toBe('');
    expect(decoded!.reply_suggestions).toEqual([]);
    expect(decoded!.insights).toEqual([]);
    expect(decoded!.next_move).toBe('');
  });

  it('returns null for a malformed token instead of throwing', () => {
    expect(store.decodeShareToken('not-a-real-token')).toBeNull();
    expect(store.decodeShareToken('')).toBeNull();
  });
});
