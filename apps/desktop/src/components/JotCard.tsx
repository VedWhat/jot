import React, { useState } from 'react';
import { useJotStore } from '../store';
import { formatRelativeTime } from '../utils/time';
import type { Jot } from '../db';

async function callEnrich(transcript: string, prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: transcript },
      ],
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`);
  }
  return (await res.json()).choices[0].message.content ?? '';
}

export function JotCard({ jot }: { jot: Jot }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const removeJot = useJotStore((s) => s.removeJot);
  const editJot = useJotStore((s) => s.editJot);
  const apiKeys = useJotStore((s) => s.apiKeys);
  const enrichPrompt = useJotStore((s) => s.enrichPrompt);

  const canEnrich = !!apiKeys.openai && !!enrichPrompt;

  function startEditing() {
    setDraft(jot.transcript);
    setEditing(true);
    setEnriched(null);
  }

  async function handleSave() {
    if (draft.trim()) await editJot(jot.id, draft.trim());
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
    if (e.key === 'Escape') setEditing(false);
  }

  async function handleEnrich() {
    setEnriching(true);
    setEnrichError(null);
    setEnriched(null);
    try {
      const result = await callEnrich(jot.transcript, enrichPrompt, apiKeys.openai);
      setEnriched(result);
    } catch (e: any) {
      setEnrichError(e.message);
    } finally {
      setEnriching(false);
    }
  }

  async function handleSaveEnriched() {
    if (enriched?.trim()) {
      await editJot(jot.id, enriched.trim());
      setEnriched(null);
      setExpanded(false);
    }
  }

  return (
    <div
      onClick={() => { if (!editing) setExpanded((p) => !p); }}
      className="px-5 py-4 border-b border-stone-100 cursor-pointer hover:bg-stone-50/80 transition-colors"
    >
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="font-mono text-[10px] text-stone-300">
          {formatRelativeTime(jot.created_at)}
        </span>
        {jot.engine !== 'webspeech' && (
          <span className="font-mono text-[10px] text-stone-200">{jot.engine}</span>
        )}
      </div>

      <p className="text-[13px] font-semibold text-stone-700 mb-1 leading-snug">{jot.title}</p>

      {expanded ? (
        <div onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={4}
              className="w-full mt-1 text-[13px] text-stone-600 leading-relaxed border border-stone-200 rounded-lg p-3 bg-white outline-none focus:border-stone-300 font-sans"
            />
          ) : (
            <p className="text-[13px] text-stone-500 leading-relaxed whitespace-pre-wrap mt-1">
              {jot.transcript}
            </p>
          )}

          {/* Action row */}
          <div className="flex gap-4 mt-3 items-center flex-wrap">
            {editing ? (
              <>
                <button onClick={handleSave} className="text-[12px] font-medium text-stone-700 hover:text-stone-900">save</button>
                <button onClick={() => setEditing(false)} className="text-[12px] text-stone-300 hover:text-stone-500">cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => removeJot(jot.id)} className="text-[12px] text-accent/70 hover:text-accent">delete</button>
                <button onClick={startEditing} className="text-[12px] text-stone-400 hover:text-stone-600">edit</button>
                {canEnrich && !enriched && (
                  <button
                    onClick={handleEnrich}
                    disabled={enriching}
                    className="text-[12px] text-stone-300 hover:text-stone-500 disabled:opacity-40"
                  >
                    {enriching ? 'enriching...' : '✦ enrich'}
                  </button>
                )}
                <button onClick={() => { setExpanded(false); setEnriched(null); setEnrichError(null); }} className="text-[12px] text-stone-300 hover:text-stone-500 ml-auto">close</button>
              </>
            )}
          </div>

          {/* Enrich error */}
          {enrichError && (
            <p className="font-mono text-[10px] text-accent mt-2">{enrichError}</p>
          )}

          {/* Enriched result */}
          {enriched && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="font-mono text-[9px] text-stone-300 uppercase tracking-widest mb-2">enriched</p>
              <p className="text-[13px] text-stone-500 leading-relaxed whitespace-pre-wrap">{enriched}</p>
              <div className="flex gap-4 mt-3">
                <button
                  onClick={handleSaveEnriched}
                  className="text-[12px] font-medium text-stone-700 hover:text-stone-900"
                >
                  save as transcript
                </button>
                <button
                  onClick={() => setEnriched(null)}
                  className="text-[12px] text-stone-300 hover:text-stone-500"
                >
                  dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-stone-400 leading-relaxed line-clamp-2">
          {jot.transcript}
        </p>
      )}
    </div>
  );
}
