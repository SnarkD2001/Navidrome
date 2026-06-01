import React, { useEffect, useState, useRef } from 'react';
import { LyricLine } from '../../api/types';

interface LyricViewProps {
  lyrics: string;
  currentTime: number;
}

function parseLRC(lrc: string): LyricLine[] {
  const lines = lrc.split('\n');
  const result: LyricLine[] = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const milliseconds = parseInt(match[3]);
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export default function LyricView({ lyrics, currentTime }: LyricViewProps) {
  const [parsedLyrics, setParsedLyrics] = useState<LyricLine[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setParsedLyrics(parseLRC(lyrics));
  }, [lyrics]);

  // Find active lyric index
  const activeIndex = parsedLyrics.findIndex((line, index) => {
    const nextLine = parsedLyrics[index + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  // Auto-scroll to active lyric
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const containerHeight = container.clientHeight;
      const activeTop = active.offsetTop;
      const activeHeight = active.clientHeight;

      container.scrollTo({
        top: activeTop - containerHeight / 2 + activeHeight / 2,
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  if (parsedLyrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[rgb(var(--text-secondary))]">
        暂无歌词
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto scrollbar-hide px-8 py-12"
    >
      <div className="space-y-6">
        {parsedLyrics.map((line, index) => (
          <div
            key={index}
            ref={index === activeIndex ? activeRef : null}
            className={`text-center transition-all duration-300 ${
              index === activeIndex
                ? 'text-xl font-bold text-white scale-110'
                : 'text-lg text-[rgb(var(--text-secondary))] opacity-60'
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
