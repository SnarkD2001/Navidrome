import React, { useRef, useState, useEffect } from 'react';
import { SubsonicSong } from '../../api/types';
import { getCoverArtUrl } from '../../api/subsonic';
import { ServerConfig } from '../../api/types';

interface CoverImageProps {
  coverArt?: string;
  size?: number;
  alt?: string;
  className?: string;
}

export default function CoverImage({ coverArt, size = 300, alt = '', className = '' }: CoverImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const getConfig = (): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const config = getConfig();
  const url = coverArt && config ? getCoverArtUrl(config, coverArt, size) : null;

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {isVisible && url && !hasError ? (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 bg-[rgb(var(--bg-card))] animate-pulse" />
          )}
          <img
            src={url}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            loading="lazy"
          />
        </>
      ) : (
        <div className="w-full h-full bg-[rgb(var(--bg-card))] flex items-center justify-center">
          <span className="text-4xl">🎵</span>
        </div>
      )}
    </div>
  );
}
