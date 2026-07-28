import { describe, it, expect } from 'vitest';
import {
  parseAnalysisResponse,
  parseJsonPayload,
  extractContent,
  extractJsonObject,
  repairPrematureObjectClose,
  normalizeLikelyJson,
  normalizeScore,
  normalizeStringList,
  normalizeRisk,
  normalizeStage,
  normalizeMomentum,
  AnalysisParseError,
} from './analysis-parser';

/** A complete, valid analysis object as the model is instructed to return. */
const validAnalysis = {
  conversation_health: 72,
  attraction_score: 81,
  ghosting_risk: 18,
  response_effort_balance: 64,
  meetup_readiness: 70,
  confidence_score: 66,
  rizz_score: 74,
  conversation_stage: 'Momentum Window',
  momentum: 'Rising',
  archetype: 'Situationship Tax Audit',
  brutal_verdict: "She's into it, stop overthinking.",
  rizz_roast: 'Your openers are fine, your follow-through needs a gym membership.',
  insights: ['She asked 3 follow-ups', 'You went one-word twice'],
  green_flags: ['Initiates contact'],
  red_flags: ['Slowing replies'],
  fake_golddigger_risk: 'None',
  fake_golddigger_reason: 'No transactional signals.',
  next_move: 'Suggest the trivia night with a specific day.',
  reply_suggestions: ['r1', 'r2', 'r3', 'r4', 'r5'],
  date_ideas: ['Trivia night', 'Coffee walk'],
};

/** Wrap a content string in the OpenAI chat-completions envelope. */
function openAiEnvelope(content: string) {
  return { choices: [{ message: { content } }] };
}

describe('parseAnalysisResponse', () => {
  it('parses a clean valid JSON envelope', () => {
    const res = parseAnalysisResponse(openAiEnvelope(JSON.stringify(validAnalysis)));
    expect(res.attraction_score).toBe(81);
    expect(res.archetype).toBe('Situationship Tax Audit');
    expect(res.reply_suggestions).toHaveLength(5);
    expect(res.conversation_stage).toBe('Momentum Window');
  });

  it('parses JSON wrapped in markdown fences', () => {
    const fenced = '```json\n' + JSON.stringify(validAnalysis) + '\n```';
    const res = parseAnalysisResponse(openAiEnvelope(fenced));
    expect(res.rizz_score).toBe(74);
  });

  it('parses JSON with surrounding prose preamble/trailing text', () => {
    const content = `Sure! Here is your analysis:\n${JSON.stringify(validAnalysis)}\nHope that helps!`;
    const res = parseAnalysisResponse(openAiEnvelope(content));
    expect(res.brutal_verdict).toContain('into it');
  });

  it('repairs curly/smart quotes', () => {
    const dirty = JSON.stringify(validAnalysis).replace(
      'into it',
      '\u201Cinto\u201D it',
    );
    const res = parseAnalysisResponse(openAiEnvelope(dirty));
    expect(res.brutal_verdict).toContain('into');
  });

  it('repairs a prematurely-closed top-level object', () => {
    // Model closes the object early, then keeps emitting sibling keys.
    const broken =
      '{"attraction_score": 81, "ghosting_risk": 18}' +
      ', "rizz_score": 74, "archetype": "X", "brutal_verdict": "y", "reply_suggestions": ["a"]}';
    const res = parseAnalysisResponse(openAiEnvelope(broken));
    expect(res.attraction_score).toBe(81);
    expect(res.rizz_score).toBe(74);
  });

  it('fills missing fields with safe defaults', () => {
    const res = parseAnalysisResponse(openAiEnvelope('{"attraction_score": 50}'));
    expect(res.attraction_score).toBe(50);
    expect(res.ghosting_risk).toBe(0);
    expect(res.archetype).toBe('Mixed Signals');
    expect(res.insights).toEqual([]);
    expect(res.fake_golddigger_risk).toBe('None');
  });

  it('clamps out-of-range and non-numeric scores', () => {
    const res = parseAnalysisResponse(
      openAiEnvelope('{"attraction_score": 250, "ghosting_risk": -40, "rizz_score": "abc"}'),
    );
    expect(res.attraction_score).toBe(100);
    expect(res.ghosting_risk).toBe(0);
    expect(res.rizz_score).toBe(0);
  });

  it('coerces invalid enum values to Unknown / None', () => {
    const res = parseAnalysisResponse(
      openAiEnvelope('{"conversation_stage": "Wildcard", "momentum": "Sideways", "fake_golddigger_risk": "Extreme"}'),
    );
    expect(res.conversation_stage).toBe('Unknown');
    expect(res.momentum).toBe('Unknown');
    expect(res.fake_golddigger_risk).toBe('None');
  });

  it('normalizes a newline-delimited string into a list', () => {
    const res = parseAnalysisResponse(
      openAiEnvelope('{"insights": "- first\\n- second\\n* third"}'),
    );
    expect(res.insights).toEqual(['first', 'second', 'third']);
  });

  it('inserts missing commas between adjacent array strings', () => {
    const broken = '{"reply_suggestions": ["one" "two" "three"]}';
    const res = parseAnalysisResponse(openAiEnvelope(broken));
    expect(res.reply_suggestions).toEqual(['one', 'two', 'three']);
  });

  it('throws AnalysisParseError on unrecoverable garbage', () => {
    expect(() => parseAnalysisResponse(openAiEnvelope('totally not json {{{'))).toThrow(
      AnalysisParseError,
    );
  });
});

describe('backend envelope variants', () => {
  it('handles a raw bare analysis object', () => {
    const res = parseAnalysisResponse(validAnalysis);
    expect(res.attraction_score).toBe(81);
  });

  it('handles a { data: { choices } } wrapper', () => {
    const res = parseAnalysisResponse({ data: openAiEnvelope(JSON.stringify(validAnalysis)) });
    expect(res.rizz_score).toBe(74);
  });

  it('handles output_text envelope', () => {
    const res = parseAnalysisResponse({ output_text: JSON.stringify(validAnalysis) });
    expect(res.meetup_readiness).toBe(70);
  });

  it('handles content-array message format', () => {
    const res = parseAnalysisResponse({
      choices: [{ message: { content: [{ type: 'text', text: JSON.stringify(validAnalysis) }] } }],
    });
    expect(res.conversation_health).toBe(72);
  });

  it('handles a plain string body', () => {
    const res = parseAnalysisResponse(JSON.stringify(validAnalysis));
    expect(res.attraction_score).toBe(81);
  });

  it('throws when no content can be extracted', () => {
    expect(() => extractContent({ unexpected: true })).toThrow(AnalysisParseError);
  });
});

describe('parser primitives', () => {
  it('extractJsonObject grabs the first balanced object', () => {
    expect(extractJsonObject('noise {"a":1} tail')).toBe('{"a":1}');
    expect(extractJsonObject('no object here')).toBeNull();
  });

  it('repairPrematureObjectClose is a no-op on valid JSON', () => {
    const valid = '{"a":1,"b":2}';
    expect(JSON.parse(repairPrematureObjectClose(valid))).toEqual({ a: 1, b: 2 });
  });

  it('normalizeLikelyJson rewrites smart quotes to parseable JSON', () => {
    const out = normalizeLikelyJson('{\u201Ca\u201D: \u201Cb\u201D}'.replace(/(\u201C|\u201D)(\w)/g, '$1$2'));
    // At minimum it should not throw and should produce a string.
    expect(typeof out).toBe('string');
  });

  it('normalizeScore clamps and rounds', () => {
    expect(normalizeScore(50.6)).toBe(51);
    expect(normalizeScore(-5)).toBe(0);
    expect(normalizeScore(9999)).toBe(100);
    expect(normalizeScore('nan')).toBe(0);
    expect(normalizeScore(null)).toBe(0);
  });

  it('normalizeStringList handles arrays, strings and junk', () => {
    expect(normalizeStringList(['a', '', 'b ', 3 as any])).toEqual(['a', 'b']);
    expect(normalizeStringList('x\ny')).toEqual(['x', 'y']);
    expect(normalizeStringList(null)).toEqual([]);
  });

  it('normalizeRisk / Stage / Momentum guard enums', () => {
    expect(normalizeRisk('High')).toBe('High');
    expect(normalizeRisk('nope')).toBe('None');
    expect(normalizeStage('Dead')).toBe('Dead');
    expect(normalizeStage('???')).toBe('Unknown');
    expect(normalizeMomentum('Rising')).toBe('Rising');
    expect(normalizeMomentum('???')).toBe('Unknown');
  });

  it('parseJsonPayload strips fences before parsing', () => {
    expect(parseJsonPayload('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});
