import React, { useState } from 'react';
import { useJotStore } from '../store';
import { formatRelativeTime } from '../utils/time';
import type { Jot } from '../db';

type EnrichResult = { category: string; content: string; title: string };

const CATEGORY_DOT: Record<string, string> = {
  idea:     'bg-sky-400',
  task:     'bg-amber-400',
  remember: 'bg-emerald-400',
  other:    'bg-stone-300',
};

const ENRICH_PROMPT = `Classify this voice note and turn it into something actionable.

Categories: idea | task | remember | other

Structure your response based on the category:

IDEA:
**Core insight:** One sentence — what is this idea, specifically?
**Why it matters:** What problem does it solve or opportunity does it create?
**Angles to explore:** 3–5 specific questions worth investigating
**Next steps:** 2–4 actions (verb-first, specific enough to do today)

TASK:
**Goal:** What done looks like
**Steps:**
- [ ] Step 1 (action verb + specific outcome)
- [ ] Step 2
**Blockers:** Anything that needs to happen first

REMEMBER:
**What:** The fact, reference, or thing to recall
**Why:** When this will be useful
**Context:** Related ideas or background

OTHER:
Rewrite cleanly — fix grammar, improve clarity, preserve all meaning.

You MUST respond with only a JSON object — no markdown, no explanation, nothing else.
Required fields:
  "category": one of "idea", "task", "remember", or "other"
  "title": a concise, descriptive title for this jot (max 8 words, no punctuation at end)
  "content": the enriched/rewritten text based on the instructions above

Example shape: {"category":"idea","title":"Build a voice-first todo app","content":"..."}`;

async function callEnrich(transcript: string, apiKey: string): Promise<EnrichResult> {
  const systemPrompt = ENRICH_PROMPT;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript },
      ],
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`);
  }
  const raw: string = (await res.json()).choices[0].message.content ?? '';
  // Extract JSON robustly — strip markdown fences if present
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Model did not return JSON. Check your enrich prompt.');
  const parsed = JSON.parse(jsonMatch[0]);
  if (typeof parsed.content !== 'string' || !parsed.content.trim()) {
    throw new Error('Model returned empty content. Try again.');
  }
  const category = typeof parsed.category === 'string' ? parsed.category : 'other';
  const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : '';
  return { category, content: parsed.content, title };
}

export function JotCard({ jot }: { jot: Jot }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState<EnrichResult | null>(null);
  const [editingEnriched, setEditingEnriched] = useState(false);
  const [enrichedDraft, setEnrichedDraft] = useState('');

  const removeJot = useJotStore((s) => s.removeJot);
  const editJot = useJotStore((s) => s.editJot);
  const apiKeys = useJotStore((s) => s.apiKeys);
  const addToast = useJotStore((s) => s.addToast);

  const canEnrich = !!apiKeys.openai;
  const categoryDot = jot.category ? CATEGORY_DOT[jot.category] ?? 'bg-stone-300' : null;

  function startEditing() {
    setDraft(jot.transcript);
    setEditing(true);
    setEnriched(null);
  }

  async function handleSave() {
    if (draft.trim()) await editJot(jot.id, draft.trim(), jot.category, jot.title);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
    if (e.key === 'Escape') setEditing(false);
  }

  async function handleEnrich() {
    setEnriching(true);
    setEnriched(null);
    try {
      const result = await callEnrich(jot.transcript, apiKeys.openai);
      setEnriched(result);
    } catch (e: any) {
      addToast('error', `Enrich failed: ${e.message}`);
    } finally {
      setEnriching(false);
    }
  }

  function startEditingEnriched() {
    setEnrichedDraft(enriched?.content ?? '');
    setEditingEnriched(true);
  }

  function commitEnrichedDraft() {
    if (enriched) setEnriched({ ...enriched, content: enrichedDraft });
    setEditingEnriched(false);
  }

  function handleEnrichedDraftKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commitEnrichedDraft();
    if (e.key === 'Escape') setEditingEnriched(false);
  }

  async function handleSaveEnriched() {
    const content = (editingEnriched ? enrichedDraft : enriched?.content) ?? '';
    if (content.trim()) {
      await editJot(jot.id, content.trim(), enriched?.category, enriched?.title || undefined);
      setEnriched(null);
      setEditingEnriched(false);
      setExpanded(false);
    }
  }

  return (
    <div
      onClick={() => { if (!editing) setExpanded((p) => !p); }}
      className="px-5 py-4 border-b border-stone-100 cursor-pointer hover:bg-stone-50 transition-colors"
    >
      {/* Header row */}
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-2">
          {categoryDot && (
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${categoryDot}`} />
          )}
          <span className="font-mono text-[10px] font-medium text-stone-500">
            {formatRelativeTime(jot.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {jot.category && (
            <span className="font-mono text-[9px] font-semibold text-stone-500 uppercase tracking-widest">{jot.category}</span>
          )}
          {jot.engine !== 'webspeech' && (
            <span className="font-mono text-[9px] text-stone-400 uppercase tracking-widest">{jot.engine}</span>
          )}
        </div>
      </div>

      {/* Title */}
      <p className="text-[13px] font-bold text-stone-900 leading-snug mb-1">{jot.title}</p>

      {/* Collapsed excerpt */}
      {!expanded && (
        <p className="text-[12px] text-stone-600 leading-relaxed line-clamp-2">
          {jot.transcript}
        </p>
      )}

      {/* Expanded */}
      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={4}
              className="w-full mt-1 text-[13px] text-stone-700 leading-relaxed border border-stone-200 rounded-lg p-3 bg-white outline-none focus:border-stone-300 font-sans resize-none"
            />
          ) : (
            <p className="text-[13px] text-stone-600 leading-relaxed whitespace-pre-wrap mt-1">
              {jot.transcript}
            </p>
          )}

          {/* Action row */}
          <div className="flex gap-4 mt-3 items-center flex-wrap">
            {editing ? (
              <>
                <button onClick={handleSave} className="text-[12px] font-semibold text-stone-800 hover:text-stone-900">save</button>
                <button onClick={() => setEditing(false)} className="text-[12px] text-stone-400 hover:text-stone-600">cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => removeJot(jot.id)} className="text-[12px] text-accent/80 hover:text-accent">delete</button>
                <button onClick={startEditing} className="text-[12px] text-stone-500 hover:text-stone-700">edit</button>
                {canEnrich && !enriched && (
                  <button
                    onClick={handleEnrich}
                    disabled={enriching}
                    className="text-[12px] text-stone-500 hover:text-stone-700 disabled:opacity-40 flex items-center gap-1"
                  >
                    {enriching
                      ? <><span className="inline-block w-2.5 h-2.5 border border-stone-300 border-t-stone-600 rounded-full animate-spin" /> enriching</>
                      : '✦ enrich'}
                  </button>
                )}
                <button
                  onClick={() => { setExpanded(false); setEnriched(null); }}
                  className="text-[12px] text-stone-400 hover:text-stone-600 ml-auto"
                >
                  close
                </button>
              </>
            )}
          </div>

          {/* Enriched result */}
          {enriched && (
            <div className="mt-4 rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-widest">enriched</span>
                {enriched.category && (
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[enriched.category] ?? 'bg-stone-300'}`} />
                )}
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-widest">{enriched.category}</span>
              </div>
              {editingEnriched ? (
                <textarea
                  value={enrichedDraft}
                  onChange={(e) => setEnrichedDraft(e.target.value)}
                  onKeyDown={handleEnrichedDraftKey}
                  autoFocus
                  rows={5}
                  className="w-full text-[13px] text-stone-700 leading-relaxed border border-stone-200 rounded-lg p-3 bg-white outline-none focus:border-stone-300 font-sans resize-none"
                />
              ) : (
                <p className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-wrap">{enriched.content}</p>
              )}
              <div className="flex gap-4 mt-3 items-center">
                <button onClick={handleSaveEnriched} className="text-[12px] font-semibold text-stone-800 hover:text-stone-900">
                  save
                </button>
                {editingEnriched ? (
                  <button onClick={commitEnrichedDraft} className="text-[12px] text-stone-500 hover:text-stone-700">
                    done
                  </button>
                ) : (
                  <button onClick={startEditingEnriched} className="text-[12px] text-stone-500 hover:text-stone-700">
                    edit
                  </button>
                )}
                <button onClick={() => { setEnriched(null); setEditingEnriched(false); }} className="text-[12px] text-stone-400 hover:text-stone-600 ml-auto">
                  dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
