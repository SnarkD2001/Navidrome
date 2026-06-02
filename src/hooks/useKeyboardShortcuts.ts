import { useEffect, useCallback } from 'react';
import { usePlayerStore } from '../store/player';
import { useWallStore } from '../store/wall';

/**
 * 全局键盘快捷键
 *
 * 播放控制：
 *   Space        播放/暂停
 *   ← / →        快退/快进 5 秒
 *   ↑ / ↓        音量 +/- 5%
 *   N            下一曲
 *   P            上一曲
 *   M            静音/恢复
 *   F            展开/收起全屏播放器
 *   Escape       关闭全屏播放器
 *
 * 搜索：
 *   Cmd/Ctrl + K  聚焦搜索框
 *
 * 当焦点在 input / textarea 时，播放控制快捷键不生效（Space / 方向键等正常输入）。
 */

// 当焦点在可编辑元素上时，跳过快捷键
function isEditableFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || el.getAttribute('contenteditable') === 'true';
}

export function useKeyboardShortcuts() {
  const {
    togglePlay,
    next,
    prev,
    setVolume,
    volume,
    toggleFullPlayer,
    isFullPlayerOpen,
    currentTime,
    duration,
  } = usePlayerStore();
  const { setSearchQuery, setSource } = useWallStore();

  // seek 需要直接操作 Howl 实例，这里通过 store 的 currentTime 做不到精确 seek
  // 所以 seek 功能放在 usePlayer 里暴露，这里只做 volume / 播放控制
  // 但我们可以用自定义事件来桥接
  const dispatchSeek = useCallback((delta: number) => {
    window.dispatchEvent(new CustomEvent('nd-seek', { detail: { delta } }));
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl + K → 聚焦搜索框（任何情况下都生效）
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // 以下快捷键在输入框中不生效
    if (isEditableFocused()) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        dispatchSeek(-5);
        break;

      case 'ArrowRight':
        e.preventDefault();
        dispatchSeek(5);
        break;

      case 'ArrowUp':
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
        break;

      case 'ArrowDown':
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
        break;

      case 'n':
      case 'N':
        e.preventDefault();
        next();
        break;

      case 'p':
      case 'P':
        e.preventDefault();
        prev();
        break;

      case 'm':
      case 'M':
        e.preventDefault();
        // 切换静音：如果当前音量 > 0，记住旧值后归零；否则恢复
        if (volume > 0) {
          // 存到 dataset 方便恢复
          document.documentElement.dataset.prevVolume = volume.toString();
          setVolume(0);
        } else {
          const prev = parseFloat(document.documentElement.dataset.prevVolume || '0.7');
          setVolume(prev);
        }
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullPlayer();
        break;

      case 'Escape':
        if (isFullPlayerOpen) {
          e.preventDefault();
          toggleFullPlayer();
        }
        break;
    }
  }, [togglePlay, next, prev, setVolume, volume, toggleFullPlayer, isFullPlayerOpen, dispatchSeek]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
