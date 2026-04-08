import React from 'react';
import { useJotStore } from '../store';

interface Props {
  onPress: () => void;
}

export function MicButton({ onPress }: Props) {
  const { isRecording } = useJotStore();

  return (
    // Container sized to give ripple rings room to breathe
    <div className="relative w-56 h-56 flex items-center justify-center">

      {/* Ripple rings — sonar, appear only when recording */}
      {isRecording && (
        <>
          <div className="absolute w-40 h-40 rounded-full border border-accent/30 mic-ripple-1" />
          <div className="absolute w-40 h-40 rounded-full border border-accent/20 mic-ripple-2" />
        </>
      )}

      {/* Static outer decorative ring — always visible, very subtle */}
      <div
        className={[
          'absolute w-48 h-48 rounded-full border transition-colors duration-700',
          isRecording ? 'border-accent/10' : 'border-stone-100',
        ].join(' ')}
      />

      {/* Main button — 160px per spec */}
      <button
        onClick={onPress}
        className={[
          'relative w-40 h-40 rounded-full flex items-center justify-center outline-none no-drag transition-all duration-500',
          isRecording
            ? 'bg-red-50 border-2 border-accent/45'
            : 'bg-white border border-stone-200 shadow-sm hover:border-stone-300 hover:shadow',
        ].join(' ')}
      >
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isRecording ? '#E24B4A' : '#C4BDB8'}
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500"
        >
          <rect x="9" y="2" width="6" height="11" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
      </button>
    </div>
  );
}
