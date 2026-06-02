import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { SubsonicSong, ServerConfig } from '../../api/types';
import { usePlayerStore } from '../../store/player';
import { usePlaylistStore } from '../../store/playlist';
import { useWallStore } from '../../store/wall';
import { useWall } from '../../hooks/useWall';
import { getCoverArtUrl, star, unstar, createPlaylist, getPlaylists } from '../../api/subsonic';
import Icon from '../common/Icon';
import ContextMenu from './ContextMenu';

interface CardPosition {
  x: number;
  y: number;
  rotation: number;
  track: SubsonicSong;
}

const DB_NAME = 'navidrome-player';
const STORE_NAME = 'backgrounds';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function loadBgFromDB(): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('custom-bg');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function poissonDiskSampling(
  count: number,
  width: number,
  height: number,
  minDistance: number,
  maxAttempts: number = 50
): { x: number; y: number }[] {
  const cellSize = minDistance / Math.SQRT2;
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const grid: (number | null)[][] = Array.from({ length: gridHeight }, () => 
    Array.from({ length: gridWidth }, () => null)
  );
  
  const points: { x: number; y: number }[] = [];
  const activeList: number[] = [];
  
  const random = (min: number, max: number) => Math.random() * (max - min) + min;
  
  const firstPoint = {
    x: random(minDistance * 2, width - minDistance * 2),
    y: random(minDistance * 2, height - minDistance * 2),
  };
  points.push(firstPoint);
  activeList.push(0);
  
  const gridX = Math.floor(firstPoint.x / cellSize);
  const gridY = Math.floor(firstPoint.y / cellSize);
  grid[gridY][gridX] = 0;
  
  while (activeList.length > 0 && points.length < count) {
    const randomIndex = Math.floor(Math.random() * activeList.length);
    const pointIndex = activeList[randomIndex];
    const point = points[pointIndex];
    
    let found = false;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = random(0, Math.PI * 2);
      const distance = random(minDistance, minDistance * 1.3);
      const newX = point.x + Math.cos(angle) * distance;
      const newY = point.y + Math.sin(angle) * distance;
      
      if (newX < minDistance * 2 || newX > width - minDistance * 2 || 
          newY < minDistance * 2 || newY > height - minDistance * 2) {
        continue;
      }
      
      const newGridX = Math.floor(newX / cellSize);
      const newGridY = Math.floor(newY / cellSize);
      
      let tooClose = false;
      
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const checkX = newGridX + dx;
          const checkY = newGridY + dy;
          
          if (checkX >= 0 && checkX < gridWidth && checkY >= 0 && checkY < gridHeight) {
            const neighborIndex = grid[checkY][checkX];
            if (neighborIndex !== null) {
              const neighbor = points[neighborIndex];
              const dist = Math.sqrt((newX - neighbor.x) ** 2 + (newY - neighbor.y) ** 2);
              if (dist < minDistance) {
                tooClose = true;
                break;
              }
            }
          }
        }
        if (tooClose) break;
      }
      
      if (!tooClose) {
        const newIndex = points.length;
        points.push({ x: newX, y: newY });
        activeList.push(newIndex);
        grid[newGridY][newGridX] = newIndex;
        found = true;
        break;
      }
    }
    
    if (!found) {
      activeList.splice(randomIndex, 1);
    }
  }
  
  return points;
}

interface BackgroundWallProps {
  onLogout: () => void;
}

export default function BackgroundWall({ onLogout }: BackgroundWallProps) {
  const { tracks, isLoading } = useWall();
  const { currentTrack, play } = usePlayerStore();
  const { playlists, activePlaylist, viewMode } = usePlaylistStore();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    track: SubsonicSong;
  } | null>(null);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set());
  const [searchValue, setSearchValue] = useState('');
  
  const scrollRef = useRef({ x: 0, y: 0 });
  const targetScrollRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragScrollStartRef = useRef({ x: 0, y: 0 });
  
  const mousePosRef = useRef({ x: -1000, y: -1000 });
  const smoothMousePosRef = useRef({ x: -1000, y: -1000 });
  const cardScalesRef = useRef<number[]>([]);
  // 红心动画状态: Map<cardIndex, { startTime, type }>
  const heartAnimRef = useRef<Map<number, { startTime: number; type: 'like' | 'unlike' }>>(new Map());
  // 粒子效果: { x, y, vx, vy, life, maxLife, size, color }
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    life: number; maxLife: number; size: number; color: string; rotation: number; rotSpeed: number;
  }>>([]);
  
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const customBgImageRef = useRef<HTMLImageElement | null>(null);
  
  const getConfig = useCallback((): ServerConfig | null => {
    const configStr = localStorage.getItem('navidrome-server');
    return configStr ? JSON.parse(configStr) : null;
  }, []);

  const config = getConfig();

  useEffect(() => {
    const initLikedPlaylist = async () => {
      if (!config) return;
      
      try {
        const allPlaylists = await getPlaylists(config);
        const likedPlaylist = allPlaylists.find(p => p.name === '我喜欢');
        
        if (!likedPlaylist) {
          await createPlaylist(config, '我喜欢');
          usePlaylistStore.getState().fetchPlaylists(config);
        }
        
        if (likedPlaylist && likedPlaylist.entry) {
          const liked = new Set(likedPlaylist.entry.map(s => s.id));
          setLikedTracks(liked);
        }
      } catch (err) {
        console.error('Failed to init liked playlist:', err);
      }
    };
    
    initLikedPlaylist();
  }, [config]);

  useEffect(() => {
    loadBgFromDB().then(dataUrl => {
      if (dataUrl) {
        setCustomBg(dataUrl);
        const img = new Image();
        img.onload = () => {
          customBgImageRef.current = img;
          setBgLoaded(true);
        };
        img.onerror = () => setBgLoaded(true);
        img.src = dataUrl;
      } else {
        setBgLoaded(true);
      }
    }).catch(() => setBgLoaded(true));
  }, []);

  const CARD_WIDTH = 180;
  const CARD_HEIGHT = 220;
  const MIN_DISTANCE = 300;
  const MAGNETIC_RANGE = 280;
  const MAX_SCALE = 1.4;

  const { cardPositions, canvasWidth, canvasHeight } = useMemo(() => {
    const area = tracks.length * MIN_DISTANCE * MIN_DISTANCE * 2.5;
    const side = Math.sqrt(area);
    const width = Math.max(3000, side);
    const height = Math.max(2500, side * 0.85);
    
    const points = poissonDiskSampling(tracks.length, width, height, MIN_DISTANCE);
    const random = (min: number, max: number) => Math.random() * (max - min) + min;
    
    const positions: CardPosition[] = tracks.map((track, index) => {
      const point = points[index] || { 
        x: random(200, width - 200), 
        y: random(200, height - 200) 
      };
      return {
        x: point.x - CARD_WIDTH / 2,
        y: point.y - CARD_HEIGHT / 2,
        rotation: random(-3, 3),
        track,
      };
    });

    cardScalesRef.current = new Array(positions.length).fill(1);

    return {
      cardPositions: positions,
      canvasWidth: width,
      canvasHeight: height,
    };
  }, [tracks]);

  // 爆心粒子生成
  const spawnHeartParticles = useCallback((cardIndex: number) => {
    const card = cardPositions[cardIndex];
    if (!card) return;
    const { x: scrollX, y: scrollY } = scrollRef.current;
    const infoHeight = 40;
    const heartWidth = 44;
    const imgHeight = CARD_HEIGHT - infoHeight;
    const heartWorldX = card.x + CARD_WIDTH - heartWidth / 2;
    const heartWorldY = card.y + imgHeight + infoHeight / 2;

    const colors = ['#ef4444', '#f87171', '#fca5a5', '#fb923c', '#f43f5e'];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 2.5;
      particlesRef.current.push({
        x: heartWorldX - scrollX,
        y: heartWorldY - scrollY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.3,
        size: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
      });
    }
  }, [cardPositions]);

  const toggleLike = useCallback(async (track: SubsonicSong, e: React.MouseEvent, cardIndex?: number) => {
    e.stopPropagation();
    if (!config) return;
    
    const isLiked = likedTracks.has(track.id);
    
    if (cardIndex !== undefined) {
      heartAnimRef.current.set(cardIndex, { startTime: performance.now(), type: isLiked ? 'unlike' : 'like' });
      if (!isLiked) spawnHeartParticles(cardIndex);
    }
    
    try {
      if (isLiked) {
        await unstar(config, track.id);
        setLikedTracks(prev => {
          const next = new Set(prev);
          next.delete(track.id);
          return next;
        });
      } else {
        await star(config, track.id);
        setLikedTracks(prev => new Set(prev).add(track.id));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  }, [config, likedTracks, spawnHeartParticles]);

  useEffect(() => {
    if (!config) return;
    
    const cache = imageCacheRef.current;
    tracks.forEach(track => {
      if (track.coverArt && !cache.has(track.coverArt)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = getCoverArtUrl(config, track.coverArt, 300);
        img.onload = () => cache.set(track.coverArt, img);
        cache.set(track.coverArt, img);
      }
    });
  }, [tracks, config]);

  useEffect(() => {
    if (canvasWidth > 0) {
      const centerX = Math.max(0, (canvasWidth - window.innerWidth) / 2);
      const centerY = Math.max(0, (canvasHeight - window.innerHeight) / 2);
      scrollRef.current = { x: centerX, y: centerY };
      targetScrollRef.current = { x: centerX, y: centerY };
    }
  }, [canvasWidth, canvasHeight]);

  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    
    const scrollLerp = 0.12;
    scrollRef.current.x += (targetScrollRef.current.x - scrollRef.current.x) * scrollLerp;
    scrollRef.current.y += (targetScrollRef.current.y - scrollRef.current.y) * scrollLerp;
    
    const mouseLerp = 0.15;
    smoothMousePosRef.current.x += (mousePosRef.current.x - smoothMousePosRef.current.x) * mouseLerp;
    smoothMousePosRef.current.y += (mousePosRef.current.y - smoothMousePosRef.current.y) * mouseLerp;
    
    // 背景
    if (customBgImageRef.current && customBgImageRef.current.complete && customBgImageRef.current.naturalWidth > 0) {
      const img = customBgImageRef.current;
      const imgRatio = img.width / img.height;
      const screenRatio = width / height;
      
      let drawWidth, drawHeight, drawX, drawY;
      if (imgRatio > screenRatio) {
        drawHeight = height;
        drawWidth = height * imgRatio;
        drawX = (width - drawWidth) / 2;
        drawY = 0;
      } else {
        drawWidth = width;
        drawHeight = width / imgRatio;
        drawX = 0;
        drawY = (height - drawHeight) / 2;
      }
      
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, width, height);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#f8fafc');
      gradient.addColorStop(0.5, '#f1f5f9');
      gradient.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      const gradient2 = ctx.createRadialGradient(width * 0.2, height * 0.2, 0, width * 0.2, height * 0.2, width * 0.5);
      gradient2.addColorStop(0, 'rgba(59, 130, 246, 0.08)');
      gradient2.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, width, height);
      
      const gradient3 = ctx.createRadialGradient(width * 0.8, height * 0.8, 0, width * 0.8, height * 0.8, width * 0.4);
      gradient3.addColorStop(0, 'rgba(139, 92, 246, 0.06)');
      gradient3.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient3;
      ctx.fillRect(0, 0, width, height);
    }
    
    const { x: scrollX, y: scrollY } = scrollRef.current;
    const cache = imageCacheRef.current;
    const mouse = smoothMousePosRef.current;
    
    const sortedCards = cardPositions
      .map((card, index) => ({ ...card, index }))
      .sort((a, b) => a.y - b.y);
    
    const scaleLerp = 0.15;
    
    sortedCards.forEach(card => {
      const centerX = card.x + CARD_WIDTH / 2 - scrollX;
      const centerY = card.y + CARD_HEIGHT / 2 - scrollY;
      
      const dx = mouse.x - centerX;
      const dy = mouse.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      let targetScale = 1;
      if (distance < MAGNETIC_RANGE) {
        const factor = 1 - (distance / MAGNETIC_RANGE);
        targetScale = 1 + (MAX_SCALE - 1) * easeOutCubic(factor);
      }
      
      const currentScale = cardScalesRef.current[card.index] || 1;
      cardScalesRef.current[card.index] = currentScale + (targetScale - currentScale) * scaleLerp;
    });
    
    sortedCards.forEach(card => {
      const scale = cardScalesRef.current[card.index] || 1;
      const centerX = card.x + CARD_WIDTH / 2 - scrollX;
      const centerY = card.y + CARD_HEIGHT / 2 - scrollY;
      
      const scaledWidth = CARD_WIDTH * scale;
      const scaledHeight = CARD_HEIGHT * scale;
      const x = centerX - scaledWidth / 2;
      const y = centerY - scaledHeight / 2;
      
      if (x + scaledWidth < -50 || x > width + 50 || y + scaledHeight < -50 || y > height + 50) {
        return;
      }
      
      const isPlaying = currentTrack?.id === card.track.id;
      const isLiked = likedTracks.has(card.track.id);
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((card.rotation * Math.PI) / 180);
      ctx.scale(scale, scale);
      ctx.translate(-CARD_WIDTH / 2, -CARD_HEIGHT / 2);
      
      const radius = 16;
      const imgHeight = CARD_HEIGHT - 40;
      const infoHeight = 40;
      const heartWidth = 44;
      
      // 卡片阴影
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 20 + (scale - 1) * 30;
      ctx.shadowOffsetY = 4 + (scale - 1) * 8;
      
      // 白色卡片背景
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, radius);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      
      // 细边框
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(0.5, 0.5, CARD_WIDTH - 1, CARD_HEIGHT - 1, radius);
      ctx.stroke();
      
      // 封面图片
      const img = cache.get(card.track.coverArt);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(8, 8, CARD_WIDTH - 16, imgHeight - 8, [radius - 2, radius - 2, 4, 4]);
        ctx.clip();
        ctx.drawImage(img, 8, 8, CARD_WIDTH - 16, imgHeight - 8);
        ctx.restore();
      } else {
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.roundRect(8, 8, CARD_WIDTH - 16, imgHeight - 8, [radius - 2, radius - 2, 4, 4]);
        ctx.fill();
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♪', CARD_WIDTH / 2, imgHeight / 2);
      }
      
      // 悬停效果
      const distToMouse = Math.sqrt(
        (mouse.x - centerX) ** 2 + (mouse.y - centerY) ** 2
      );
      const isHovered = distToMouse < CARD_WIDTH * 0.7 && scale > 1.15;
      
      if (isHovered) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.roundRect(8, 8, CARD_WIDTH - 16, imgHeight - 8, [radius - 2, radius - 2, 4, 4]);
        ctx.fill();
        
        // 播放按钮
        const btnRadius = 28;
        ctx.beginPath();
        ctx.arc(CARD_WIDTH / 2, imgHeight / 2, btnRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        
        ctx.beginPath();
        ctx.moveTo(CARD_WIDTH / 2 - 8, imgHeight / 2 - 12);
        ctx.lineTo(CARD_WIDTH / 2 + 14, imgHeight / 2);
        ctx.lineTo(CARD_WIDTH / 2 - 8, imgHeight / 2 + 12);
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();
      }
      
      // 播放中指示器
      if (isPlaying) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(59, 130, 246, 0.3)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(1.5, 1.5, CARD_WIDTH - 3, CARD_HEIGHT - 3, radius);
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        
        const waveX = 14;
        const waveY = imgHeight - 20;
        ctx.fillStyle = '#3b82f6';
        
        for (let i = 0; i < 3; i++) {
          const barHeight = 4 + Math.sin(Date.now() / 200 + i * 0.8) * 4;
          ctx.fillRect(waveX + i * 5, waveY - barHeight, 3, barHeight);
        }
      }
      
      // 信息区域 - 左侧文字背景
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(0, imgHeight);
      ctx.lineTo(CARD_WIDTH - heartWidth, imgHeight);
      ctx.lineTo(CARD_WIDTH - heartWidth, CARD_HEIGHT);
      ctx.lineTo(radius, CARD_HEIGHT);
      ctx.quadraticCurveTo(0, CARD_HEIGHT, 0, CARD_HEIGHT - radius);
      ctx.lineTo(0, imgHeight);
      ctx.fill();
      
      // 右侧红心按钮背景
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(CARD_WIDTH - heartWidth, imgHeight);
      ctx.lineTo(CARD_WIDTH, imgHeight);
      ctx.lineTo(CARD_WIDTH, CARD_HEIGHT - radius);
      ctx.quadraticCurveTo(CARD_WIDTH, CARD_HEIGHT, CARD_WIDTH - radius, CARD_HEIGHT);
      ctx.lineTo(CARD_WIDTH - heartWidth, CARD_HEIGHT);
      ctx.lineTo(CARD_WIDTH - heartWidth, imgHeight);
      ctx.fill();
      
      // 分隔线
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(12, imgHeight, CARD_WIDTH - heartWidth - 12, 1);
      
      // 标题
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const title = card.track.title.length > 12 ? card.track.title.slice(0, 12) + '…' : card.track.title;
      ctx.fillText(title, 12, imgHeight + infoHeight * 0.35);
      
      // 艺术家
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Inter, system-ui, sans-serif';
      const artist = card.track.artist.length > 14 ? card.track.artist.slice(0, 14) + '…' : card.track.artist;
      ctx.fillText(artist, 12, imgHeight + infoHeight * 0.65);
      
      // 红心按钮 - 垂直居中
      const heartCenterX = CARD_WIDTH - heartWidth / 2;
      const heartCenterY = imgHeight + infoHeight / 2;
      const heartSize = 18;
      
      // 弹跳动画
      const anim = heartAnimRef.current.get(card.index);
      let heartScale = 1;
      if (anim) {
        const elapsed = (performance.now() - anim.startTime) / 1000;
        if (elapsed < 0.5) {
          // damped spring: peak 1.5 at t≈0.08, then bounce back
          heartScale = 1 + 0.5 * Math.exp(-12 * elapsed) * Math.sin(25 * elapsed);
        } else {
          heartAnimRef.current.delete(card.index);
        }
      }
      
      const heartDrawX = heartCenterX;
      const heartDrawY = heartCenterY - heartSize / 2;
      
      ctx.save();
      ctx.translate(heartCenterX, heartCenterY);
      ctx.scale(heartScale, heartScale);
      ctx.translate(-heartCenterX, -heartCenterY);
      
      if (isLiked) {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(heartDrawX, heartDrawY + heartSize * 0.3);
        ctx.bezierCurveTo(heartDrawX, heartDrawY, heartDrawX - heartSize * 0.5, heartDrawY, heartDrawX - heartSize * 0.5, heartDrawY + heartSize * 0.3);
        ctx.bezierCurveTo(heartDrawX - heartSize * 0.5, heartDrawY + heartSize * 0.6, heartDrawX, heartDrawY + heartSize * 0.8, heartDrawX, heartDrawY + heartSize);
        ctx.bezierCurveTo(heartDrawX, heartDrawY + heartSize * 0.8, heartDrawX + heartSize * 0.5, heartDrawY + heartSize * 0.6, heartDrawX + heartSize * 0.5, heartDrawY + heartSize * 0.3);
        ctx.bezierCurveTo(heartDrawX + heartSize * 0.5, heartDrawY, heartDrawX, heartDrawY, heartDrawX, heartDrawY + heartSize * 0.3);
        ctx.fill();
        ctx.shadowColor = 'transparent';
      } else {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(heartDrawX, heartDrawY + heartSize * 0.3);
        ctx.bezierCurveTo(heartDrawX, heartDrawY, heartDrawX - heartSize * 0.5, heartDrawY, heartDrawX - heartSize * 0.5, heartDrawY + heartSize * 0.3);
        ctx.bezierCurveTo(heartDrawX - heartSize * 0.5, heartDrawY + heartSize * 0.6, heartDrawX, heartDrawY + heartSize * 0.8, heartDrawX, heartDrawY + heartSize);
        ctx.bezierCurveTo(heartDrawX, heartDrawY + heartSize * 0.8, heartDrawX + heartSize * 0.5, heartDrawY + heartSize * 0.6, heartDrawX + heartSize * 0.5, heartDrawY + heartSize * 0.3);
        ctx.bezierCurveTo(heartDrawX + heartSize * 0.5, heartDrawY, heartDrawX, heartDrawY, heartDrawX, heartDrawY + heartSize * 0.3);
        ctx.stroke();
      }
      ctx.restore();
      
      ctx.restore();
    });

    // 绘制粒子
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const dt = 1 / 60; // approx frame time
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.life -= dt / p.maxLife;
      p.rotation += p.rotSpeed;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      const alpha = Math.min(1, p.life * 2); // fade out in last 50%
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      // 画小爱心
      const s = p.size * (0.5 + p.life * 0.5);
      ctx.beginPath();
      ctx.moveTo(0, s * 0.3);
      ctx.bezierCurveTo(0, 0, -s * 0.5, 0, -s * 0.5, s * 0.3);
      ctx.bezierCurveTo(-s * 0.5, s * 0.6, 0, s * 0.8, 0, s);
      ctx.bezierCurveTo(0, s * 0.8, s * 0.5, s * 0.6, s * 0.5, s * 0.3);
      ctx.bezierCurveTo(s * 0.5, 0, 0, 0, 0, s * 0.3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }, [cardPositions, currentTrack, likedTracks]);

  useEffect(() => {
    let animId: number;
    const animate = () => {
      drawCanvas();
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [drawCanvas]);

  useEffect(() => {
    const handleResize = () => drawCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  const getCardAtPosition = useCallback((clientX: number, clientY: number): number => {
    const { x: scrollX, y: scrollY } = scrollRef.current;
    const worldX = clientX + scrollX;
    const worldY = clientY + scrollY;
    
    for (let i = cardPositions.length - 1; i >= 0; i--) {
      const card = cardPositions[i];
      const scale = cardScalesRef.current[i] || 1;
      
      // 计算卡片中心（屏幕坐标，和绘制一致）
      const cardCenterX = card.x + CARD_WIDTH / 2;
      const cardCenterY = card.y + CARD_HEIGHT / 2;
      
      // 将鼠标坐标转换到卡片的本地坐标系（考虑旋转 + 缩放）
      const dx = worldX - cardCenterX;
      const dy = worldY - cardCenterY;
      const angle = -(card.rotation * Math.PI) / 180;
      const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle);
      const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle);
      const localX = rotatedX / scale + CARD_WIDTH / 2;
      const localY = rotatedY / scale + CARD_HEIGHT / 2;
      
      // 检查是否在卡片范围内
      if (localX >= 0 && localX <= CARD_WIDTH && localY >= 0 && localY <= CARD_HEIGHT) {
        return i;
      }
    }
    return -1;
  }, [cardPositions]);

  // 红心按钮点击检测 - 使用卡片本地坐标（考虑旋转 + 缩放）
  const isClickOnHeart = useCallback((clientX: number, clientY: number, cardIndex: number): boolean => {
    if (cardIndex < 0) return false;
    
    const card = cardPositions[cardIndex];
    const scale = cardScalesRef.current[cardIndex] || 1;
    const { x: scrollX, y: scrollY } = scrollRef.current;
    
    // 转换为世界坐标
    const worldX = clientX + scrollX;
    const worldY = clientY + scrollY;
    
    // 计算卡片中心
    const cardCenterX = card.x + CARD_WIDTH / 2;
    const cardCenterY = card.y + CARD_HEIGHT / 2;
    
    // 将鼠标坐标转换到卡片的本地坐标系（考虑旋转 + 缩放）
    const dx = worldX - cardCenterX;
    const dy = worldY - cardCenterY;
    const angle = -(card.rotation * Math.PI) / 180;
    const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle);
    const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle);
    const localX = rotatedX / scale + CARD_WIDTH / 2;
    const localY = rotatedY / scale + CARD_HEIGHT / 2;
    
    // 红心按钮在卡片内的相对位置
    const heartWidth = 44;
    const infoHeight = 40;
    const imgHeight = CARD_HEIGHT - infoHeight;
    
    // 红心按钮在本地坐标中的区域
    const heartLeft = CARD_WIDTH - heartWidth;
    const heartTop = imgHeight;
    const heartRight = CARD_WIDTH;
    const heartBottom = CARD_HEIGHT;
    
    // 检查点击是否在红心按钮区域内
    const isInHeart = (
      localX >= heartLeft &&
      localX <= heartRight &&
      localY >= heartTop &&
      localY <= heartBottom
    );
    
    console.log('Heart click check:', {
      clientX, clientY, worldX, worldY, scale,
      localX: localX.toFixed(1), localY: localY.toFixed(1),
      heartLeft, heartTop, heartRight, heartBottom,
      isInHeart
    });
    
    return isInHeart;
  }, [cardPositions]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      dragScrollStartRef.current = { ...targetScrollRef.current };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      const maxX = Math.max(0, canvasWidth - window.innerWidth);
      const maxY = Math.max(0, canvasHeight - window.innerHeight);
      
      targetScrollRef.current = {
        x: Math.max(0, Math.min(dragScrollStartRef.current.x - dx, maxX)),
        y: Math.max(0, Math.min(dragScrollStartRef.current.y - dy, maxY)),
      };
    }
  }, [canvasWidth, canvasHeight]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const dx = Math.abs(e.clientX - dragStartRef.current.x);
      const dy = Math.abs(e.clientY - dragStartRef.current.y);
      
      if (dx < 5 && dy < 5) {
        const cardIndex = getCardAtPosition(e.clientX, e.clientY);
        if (cardIndex >= 0) {
          const isHeart = isClickOnHeart(e.clientX, e.clientY, cardIndex);
          console.log('Click on card:', cardIndex, 'isHeart:', isHeart);
          
          if (isHeart) {
            toggleLike(cardPositions[cardIndex].track, e, cardIndex);
          } else {
            play(cardPositions[cardIndex].track, tracks);
          }
        }
      }
    }
    isDraggingRef.current = false;
  }, [cardPositions, tracks, play, getCardAtPosition, isClickOnHeart, toggleLike]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const maxX = Math.max(0, canvasWidth - window.innerWidth);
    const maxY = Math.max(0, canvasHeight - window.innerHeight);
    
    targetScrollRef.current = {
      x: Math.max(0, Math.min(targetScrollRef.current.x + e.deltaX, maxX)),
      y: Math.max(0, Math.min(targetScrollRef.current.y + e.deltaY, maxY)),
    };
  }, [canvasWidth, canvasHeight]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const cardIndex = getCardAtPosition(e.clientX, e.clientY);
    if (cardIndex >= 0) {
      setContextMenu({ x: e.clientX, y: e.clientY, track: cardPositions[cardIndex].track });
    }
  }, [cardPositions, getCardAtPosition]);

  if (isLoading || !bgLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
        <div className="text-center">
          <Icon name="music" size={64} className="mx-auto mb-4 text-gray-300" />
          <div className="text-gray-500 mb-4">暂无曲目</div>
          <button
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl transition-all duration-200 hover:scale-105 text-white"
            onClick={onLogout}
          >
            重新登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f8fafc] relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: isDraggingRef.current ? 'grabbing' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isDraggingRef.current = false;
          mousePosRef.current = { x: -1000, y: -1000 };
        }}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />

      {/* 顶部导航栏 */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white/80 backdrop-blur-2xl rounded-2xl border border-black/[0.06] shadow-lg shadow-black/5">
          <div className="flex items-center gap-2">
            <Icon name="music" size={20} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-900">Navidrome</span>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          <div className="relative">
            <button
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-xl transition-all duration-200 text-gray-700"
              onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
            >
              <Icon name="playlist" size={14} />
              <span className="text-xs">
                {viewMode === 'all-tracks' ? '全部曲目' :
                 viewMode === 'recent' ? '最近播放' :
                 activePlaylist?.name || '选择歌单'}
              </span>
              <Icon name={showPlaylistMenu ? 'chevron-up' : 'chevron-down'} size={12} />
            </button>

            {showPlaylistMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPlaylistMenu(false)} />
                <div className="absolute top-full left-0 mt-2 w-56 bg-white/95 backdrop-blur-2xl rounded-xl border border-black/[0.06] shadow-xl z-50 overflow-hidden">
                  <div className="py-1">
                    <button
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                        viewMode === 'all-tracks' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                      }`}
                      onClick={() => {
                        usePlaylistStore.getState().setViewMode('all-tracks');
                        useWallStore.getState().setSource('all');
                        setShowPlaylistMenu(false);
                      }}
                    >
                      <Icon name="grid" size={14} />
                      全部曲目
                    </button>
                    <button
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                        viewMode === 'recent' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                      }`}
                      onClick={() => {
                        usePlaylistStore.getState().setViewMode('recent');
                        useWallStore.getState().setSource('recent');
                        setShowPlaylistMenu(false);
                      }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      最近播放
                    </button>
                  </div>

                  <div className="border-t border-gray-100" />

                  <div className="max-h-48 overflow-y-auto py-1">
                    {playlists.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400">暂无歌单</div>
                    ) : (
                      playlists.map(playlist => (
                        <button
                          key={playlist.id}
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                            activePlaylist?.id === playlist.id ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                          }`}
                          onClick={() => {
                            const cfg = getConfig();
                            if (cfg) {
                              usePlaylistStore.getState().fetchPlaylistTracks(cfg, playlist.id);
                              useWallStore.getState().setSource('playlist');
                            }
                            setShowPlaylistMenu(false);
                          }}
                        >
                          <Icon name="music" size={14} />
                          <span className="truncate flex-1">{playlist.name}</span>
                          <span className="text-xs text-gray-400">{playlist.songCount}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Search */}
          <div className="relative">
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              data-search-input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = searchValue.trim();
                  if (q) {
                    useWallStore.getState().setSearchQuery(q);
                    useWallStore.getState().setSource('search');
                  }
                }
                e.stopPropagation();
              }}
              placeholder="搜索..."
              className="w-40 pl-8 pr-2 py-1.5 text-xs bg-gray-100/80 rounded-lg border border-transparent
                         focus:outline-none focus:border-blue-300 focus:bg-white focus:w-56
                         placeholder:text-gray-400 transition-all duration-200 text-gray-700"
            />
          </div>

          <div className="w-px h-6 bg-gray-200" />

          <button
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200 text-gray-500 hover:text-gray-700"
            onClick={() => window.location.href = '/admin'}
            title="后台管理"
          >
            <Icon name="gear" size={14} />
          </button>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          track={contextMenu.track}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
