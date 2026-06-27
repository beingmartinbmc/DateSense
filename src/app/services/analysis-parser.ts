import {
  AnalysisResponse,
  ConversationMomentum,
  ConversationStage,
} from '../models/analysis.model';

/**
 * Pure, framework-free parsing of the LLM's raw response into a clean,
 * fully-typed {@link AnalysisResponse}.
 *
 * LLM output is unreliable: it arrives wrapped in different envelope shapes,
 * sometimes fenced in markdown, sometimes with curly quotes, missing commas,
 * or a prematurely-closed top-level object. This module is the single place
 * that turns that mess into something safe — which is exactly why it is pulled
 * out of the Angular service and covered by unit tests.
 */

export class AnalysisParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisParseError';
  }
}

/** Top-level entry point: raw HTTP body → normalized AnalysisResponse. */
export function parseAnalysisResponse(raw: unknown): AnalysisResponse {
  const content = extractContent(raw);
  const data = parseJsonPayload(content);
  return normalizeAnalysis(data);
}

// ── Envelope extraction ──────────────────────────────────────────────────────

export function extractContent(raw: any): string {
  const root = raw?.data ?? raw;
  const candidates = [
    root?.choices?.[0]?.message?.content,
    root?.output?.[0]?.content,
    root?.output,
    root?.output_text,
    root?.text,
    root?.content,
    looksLikeAnalysisObject(root) ? JSON.stringify(root) : null,
    looksLikeAnalysisObject(raw) ? JSON.stringify(raw) : null,
    typeof raw === 'string' ? raw : null,
  ];

  for (const candidate of candidates) {
    const normalized = stringifyContent(candidate);
    if (normalized) {
      return normalized;
    }
  }

  throw new AnalysisParseError('Could not extract AI response');
}

function stringifyContent(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (!item || typeof item !== 'object') {
        return '';
      }
      if ('text' in item && typeof (item as any).text === 'string') {
        return (item as any).text;
      }
      if ('content' in item) {
        return stringifyContent((item as any).content);
      }
      return '';
    })
    .join('\n')
    .trim();
}

// ── JSON payload parsing + repair ladder ─────────────────────────────────────

export function parseJsonPayload(content: string): any {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const repaired = repairPrematureObjectClose(cleaned);
  const extracted = extractJsonObject(cleaned);
  const repairedExtracted = extractJsonObject(repaired);

  const candidates = [
    cleaned,
    repaired,
    repairedExtracted,
    extracted,
    normalizeLikelyJson(repaired),
    normalizeLikelyJson(cleaned),
    repairedExtracted ? normalizeLikelyJson(repairedExtracted) : null,
    extracted ? normalizeLikelyJson(extracted) : null,
  ].filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed) {
      return parsed;
    }
  }

  throw new AnalysisParseError('The AI returned an invalid response format. Please retry.');
}

export function repairPrematureObjectClose(text: string): string {
  let out = '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '{' || ch === '[') {
      depth += 1;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '}' && depth === 1) {
      let j = i + 1;
      while (j < len && /\s/.test(text[j])) {
        j += 1;
      }

      if (j < len && text[j] === ',') {
        let k = j + 1;
        while (k < len && /\s/.test(text[k])) {
          k += 1;
        }
        if (k < len && text[k] === '"') {
          i += 1;
          continue;
        }
      } else if (j < len && text[j] === '"') {
        out += ',';
        i += 1;
        continue;
      }
    }

    if (ch === '}' || ch === ']') {
      depth -= 1;
      out += ch;
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function extractJsonObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

export function normalizeLikelyJson(text: string): string {
  const apostropheNormalized = text.replace(/[\u2018\u2019]/g, "'");
  const quoteRewritten = rewriteCurlyStrings(apostropheNormalized);
  return insertMissingArrayCommas(quoteRewritten);
}

function rewriteCurlyStrings(text: string): string {
  let out = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (ch === '"') {
      const start = i;
      i += 1;
      while (i < len) {
        const c = text[i];
        if (c === '\\') {
          i += 2;
          continue;
        }
        if (c === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      out += text.slice(start, i);
      continue;
    }

    if (ch === '\u201C') {
      i += 1;
      let content = '';
      while (i < len && text[i] !== '\u201D') {
        const c = text[i];
        if (c === '\\' || c === '"') {
          content += '\\' + c;
        } else {
          content += c;
        }
        i += 1;
      }
      if (i < len) {
        i += 1;
      }
      out += '"' + content + '"';
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function insertMissingArrayCommas(text: string): string {
  let out = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (ch === '"') {
      const start = i;
      i += 1;
      while (i < len) {
        const c = text[i];
        if (c === '\\') {
          i += 2;
          continue;
        }
        if (c === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      out += text.slice(start, i);

      let j = i;
      while (j < len && /\s/.test(text[j])) {
        j += 1;
      }
      if (j < len && text[j] === '"') {
        out += ',';
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

// ── Field normalization ──────────────────────────────────────────────────────

export function normalizeAnalysis(data: any): AnalysisResponse {
  return {
    attraction_score: normalizeScore(data?.attraction_score),
    ghosting_risk: normalizeScore(data?.ghosting_risk),
    conversation_health: normalizeScore(data?.conversation_health),
    response_effort_balance: normalizeScore(data?.response_effort_balance),
    meetup_readiness: normalizeScore(data?.meetup_readiness),
    confidence_score: normalizeScore(data?.confidence_score),
    rizz_score: normalizeScore(data?.rizz_score),
    conversation_stage: normalizeStage(data?.conversation_stage),
    momentum: normalizeMomentum(data?.momentum),
    archetype: normalizeText(data?.archetype, 'Mixed Signals'),
    brutal_verdict: normalizeText(
      data?.brutal_verdict,
      'Too little to go on — give it another exchange before reading the tea leaves.',
    ),
    rizz_roast: normalizeText(
      data?.rizz_roast,
      'Not enough to roast yet — send a few more messages and try again.',
    ),
    insights: normalizeStringList(data?.insights),
    green_flags: normalizeStringList(data?.green_flags),
    red_flags: normalizeStringList(data?.red_flags),
    fake_golddigger_risk: normalizeRisk(data?.fake_golddigger_risk),
    fake_golddigger_reason: normalizeText(data?.fake_golddigger_reason, 'No red flags detected'),
    next_move: normalizeText(
      data?.next_move,
      'Keep the conversation simple and wait for clearer signals before forcing the next step.',
    ),
    reply_suggestions: normalizeStringList(data?.reply_suggestions),
    date_ideas: normalizeStringList(data?.date_ideas),
  };
}

function looksLikeAnalysisObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('conversation_health' in value ||
      'attraction_score' in value ||
      'ghosting_risk' in value ||
      'reply_suggestions' in value)
  );
}

export function normalizeScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function normalizeStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((item) => item.replace(/^[-*•\s]+/, '').trim())
      .filter((item) => item.length > 0);
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function normalizeRisk(value: unknown): string {
  const allowed = ['None', 'Low', 'Medium', 'High'];
  const normalized = normalizeText(value, 'None');
  return allowed.includes(normalized) ? normalized : 'None';
}

export function normalizeStage(value: unknown): ConversationStage {
  const allowed: ConversationStage[] = [
    'Opening',
    'Building Rapport',
    'Momentum Window',
    'Stalling',
    'Dead',
    'Unknown',
  ];
  const normalized = normalizeText(value, 'Unknown') as ConversationStage;
  return allowed.includes(normalized) ? normalized : 'Unknown';
}

export function normalizeMomentum(value: unknown): ConversationMomentum {
  const allowed: ConversationMomentum[] = ['Rising', 'Flat', 'Fading', 'Unknown'];
  const normalized = normalizeText(value, 'Unknown') as ConversationMomentum;
  return allowed.includes(normalized) ? normalized : 'Unknown';
}
