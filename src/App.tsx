/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Trophy, RotateCcw, Zap } from 'lucide-react';

// --- Constants ---
const GRID_SIZE = 4;
const TILE_GAP = 12;
const BORDER_RADIUS = 8;
const ANIMATION_DURATION = 150; // ms

// --- Types ---
type Position = { x: number; y: number };
type Tile = {
  id: number;
  value: number;
  x: number;
  y: number;
  prevX?: number;
  prevY?: number;
  isNew?: boolean;
  mergedFrom?: Tile[];
};

// --- Utils ---
const getRandomPos = () => Math.floor(Math.random() * GRID_SIZE);

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const getTileColor = (value: number) => {
  const colors: Record<number, { bg: string; text: string }> = {
    2: { bg: '#E3F2FD', text: '#1E88E5' },
    4: { bg: '#BBDEFB', text: '#1976D2' },
    8: { bg: '#90CAF9', text: '#1565C0' },
    16: { bg: '#64B5F6', text: '#ffffff' },
    32: { bg: '#42A5F5', text: '#ffffff' },
    64: { bg: '#2196F3', text: '#ffffff' },
    128: { bg: '#E0F2F1', text: '#00796B' },
    256: { bg: '#B2DFDB', text: '#00695C' },
    512: { bg: '#80CBC4', text: '#004D40' },
    1024: { bg: '#4DB6AC', text: '#ffffff' },
    2048: { bg: '#26A69A', text: '#ffffff' },
  };
  return colors[value] || { bg: '#263238', text: '#ffffff' };
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [nextId, setNextId] = useState(0);

  // Touch and Mouse handling
  const dragStart = useRef<Position | null>(null);

  // --- Game Logic ---
  const spawnTile = useCallback((currentTiles: Tile[]) => {
    const emptyPos: Position[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!currentTiles.find(t => t.x === x && t.y === y)) {
          emptyPos.push({ x, y });
        }
      }
    }

    if (emptyPos.length === 0) return currentTiles;

    const { x, y } = emptyPos[Math.floor(Math.random() * emptyPos.length)];
    const newTile: Tile = {
      id: Date.now() + Math.random(),
      value: Math.random() < 0.9 ? 2 : 4,
      x,
      y,
      isNew: true,
    };
    return [...currentTiles, newTile];
  }, []);

  const initGame = useCallback(() => {
    let newTiles: Tile[] = [];
    newTiles = spawnTile(newTiles);
    newTiles = spawnTile(newTiles);
    setTiles(newTiles);
    setScore(0);
    setGameOver(false);
    setWin(false);
  }, [spawnTile]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.getElementsByTagName('head')[0].appendChild(meta);
    return () => {
      document.getElementsByTagName('head')[0].removeChild(meta);
    };
  }, []);

  useEffect(() => {
    initGame();
    const savedBest = localStorage.getItem('bestScore');
    if (savedBest) setBestScore(parseInt(savedBest, 10));
  }, []); // Run only once on mount

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem('bestScore', score.toString());
    }
  }, [score, bestScore]);

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver) return;

    setTiles(prevTiles => {
      const newTiles: Tile[] = [];
      let moved = false;
      let currentScore = score;

      const isVertical = direction === 'up' || direction === 'down';
      const isForward = direction === 'right' || direction === 'down';

      for (let i = 0; i < GRID_SIZE; i++) {
        const line: Tile[] = prevTiles
          .filter(t => (isVertical ? t.x === i : t.y === i))
          .sort((a, b) => (isVertical ? a.y - b.y : a.x - b.x));

        if (isForward) line.reverse();

        const mergedLine: Tile[] = [];
        for (let j = 0; j < line.length; j++) {
          const tile = { ...line[j], prevX: line[j].x, prevY: line[j].y, isNew: false, mergedFrom: undefined };
          const nextTile = line[j + 1];

          if (nextTile && tile.value === nextTile.value) {
            const mergedValue = tile.value * 2;
            const mergedTile: Tile = {
              ...tile,
              value: mergedValue,
              mergedFrom: [tile, { ...nextTile, prevX: nextTile.x, prevY: nextTile.y }],
            };
            mergedLine.push(mergedTile);
            currentScore += mergedValue;
            j++;
            moved = true;
          } else {
            mergedLine.push(tile);
          }
        }

        mergedLine.forEach((tile, index) => {
          const newPos = isForward ? GRID_SIZE - 1 - index : index;
          const oldX = tile.x;
          const oldY = tile.y;
          if (isVertical) {
            tile.y = newPos;
          } else {
            tile.x = newPos;
          }
          if (tile.x !== oldX || tile.y !== oldY) moved = true;
          newTiles.push(tile);
        });
      }

      if (moved) {
        setScore(currentScore);
        const spawned = spawnTile(newTiles);
        
        // Check win
        if (!win && spawned.some(t => t.value === 2048)) {
          setWin(true);
        }

        // Check game over
        if (spawned.length === GRID_SIZE * GRID_SIZE) {
          const canMove = () => {
            // Check for empty spaces
            if (spawned.length < GRID_SIZE * GRID_SIZE) return true;

            // Check for adjacent merges
            for (let x = 0; x < GRID_SIZE; x++) {
              for (let y = 0; y < GRID_SIZE; y++) {
                const tile = spawned.find(t => t.x === x && t.y === y);
                if (!tile) continue;
                
                // Check right and down neighbors
                const right = spawned.find(t => t.x === x + 1 && t.y === y);
                const down = spawned.find(t => t.x === x && t.y === y + 1);
                
                if (right && right.value === tile.value) return true;
                if (down && down.value === tile.value) return true;
              }
            }
            return false;
          };

          if (!canMove()) {
            setGameOver(true);
          }
        }
        
        return spawned;
      }
      return prevTiles;
    });
  }, [gameOver, score, spawnTile]);

  // --- Rendering ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const startTime = performance.now();

    const render = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      const width = canvas.width;
      const height = canvas.height;
      const tileSize = (width - TILE_GAP * (GRID_SIZE + 1)) / GRID_SIZE;

      ctx.clearRect(0, 0, width, height);

      // Draw background
      ctx.fillStyle = '#CFD8DC';
      drawRoundedRect(ctx, 0, 0, width, height, BORDER_RADIUS);
      ctx.fill();

      // Draw empty slots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
          const px = TILE_GAP + x * (tileSize + TILE_GAP);
          const py = TILE_GAP + y * (tileSize + TILE_GAP);
          drawRoundedRect(ctx, px, py, tileSize, tileSize, BORDER_RADIUS);
          ctx.fill();
        }
      }

      // Draw tiles
      tiles.forEach(tile => {
        const { bg, text } = getTileColor(tile.value);
        
        let currentX = tile.x;
        let currentY = tile.y;
        let scale = 1;

        if (tile.prevX !== undefined && tile.prevY !== undefined) {
          currentX = tile.prevX + (tile.x - tile.prevX) * progress;
          currentY = tile.prevY + (tile.y - tile.prevY) * progress;
        }

        if (tile.isNew) {
          scale = progress;
        }

        const px = TILE_GAP + currentX * (tileSize + TILE_GAP);
        const py = TILE_GAP + currentY * (tileSize + TILE_GAP);

        ctx.save();
        ctx.translate(px + tileSize / 2, py + tileSize / 2);
        ctx.scale(scale, scale);
        ctx.translate(-(px + tileSize / 2), -(py + tileSize / 2));

        ctx.fillStyle = bg;
        drawRoundedRect(ctx, px, py, tileSize, tileSize, BORDER_RADIUS);
        ctx.fill();

        ctx.fillStyle = text;
        ctx.font = `bold ${tileSize * 0.4}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tile.value.toString(), px + tileSize / 2, py + tileSize / 2);
        ctx.restore();
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [tiles]);

  // --- Event Handlers ---
  const handleDragStart = useCallback((x: number, y: number) => {
    dragStart.current = { x, y };
  }, []);

  const handleDragEnd = useCallback((x: number, y: number) => {
    if (!dragStart.current) return;
    const dx = x - dragStart.current.x;
    const dy = y - dragStart.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 30) {
      if (absX > absY) {
        move(dx > 0 ? 'right' : 'left');
      } else {
        move(dy > 0 ? 'down' : 'up');
      }
    }
    dragStart.current = null;
  }, [move]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, [handleDragStart]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
  }, []);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, [handleDragEnd]);

  const onMouseDown = useCallback((e: MouseEvent) => {
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  const onMouseUp = useCallback((e: MouseEvent) => {
    handleDragEnd(e.clientX, e.clientY);
  }, [handleDragEnd]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Touch events
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });

    // Mouse events
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseUp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': move('up'); break;
        case 'ArrowDown': move('down'); break;
        case 'ArrowLeft': move('left'); break;
        case 'ArrowRight': move('right'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  // Resize handling
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const size = Math.min(container.clientWidth, 500);
      canvas.width = size;
      canvas.height = size;
      // Trigger re-render
      setTiles(t => [...t]);
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-[#37474F] font-sans p-4 flex flex-col items-center">
      <div className="w-full max-w-[500px] flex flex-col gap-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-6xl font-bold tracking-tight text-[#455A64]">2048</h1>
          <div className="flex gap-2">
            <div className="bg-[#90A4AE] rounded-md px-4 py-2 text-center min-w-[80px]">
              <div className="text-[#ECEFF1] text-xs font-bold uppercase">점수</div>
              <div className="text-white text-xl font-bold">{score}</div>
            </div>
            <div className="bg-[#90A4AE] rounded-md px-4 py-2 text-center min-w-[80px]">
              <div className="text-[#ECEFF1] text-xs font-bold uppercase">최고 점수</div>
              <div className="text-white text-xl font-bold">{bestScore}</div>
            </div>
          </div>
        </div>

        {/* Subheader */}
        <div className="flex justify-between items-center">
          <p className="text-lg font-medium">
            숫자를 합쳐서 <span className="font-bold">2048 타일을 만드세요!</span>
          </p>
          <button 
            onClick={initGame}
            className="bg-[#607D8B] hover:bg-[#546E7A] text-white font-bold py-2 px-4 rounded-md flex items-center gap-2 transition-colors shadow-sm"
          >
            <RotateCcw size={18} />
            새 게임
          </button>
        </div>

        {/* Game Area */}
        <div 
          ref={containerRef}
          className="relative w-full aspect-square bg-[#CFD8DC] rounded-lg shadow-inner overflow-hidden touch-none"
        >
          <canvas 
            ref={canvasRef} 
            className="block w-full h-full"
          />
          
          {gameOver && (
            <div className="absolute inset-0 bg-[#ECEFF1]/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 z-20">
              <h2 className="text-5xl font-bold mb-4 text-[#455A64]">게임 종료!</h2>
              <button 
                onClick={initGame}
                className="bg-[#607D8B] text-white font-bold py-3 px-8 rounded-md text-xl hover:scale-105 transition-transform shadow-lg"
              >
                다시 시도
              </button>
            </div>
          )}

          {win && (
            <div className="absolute inset-0 bg-[#80CBC4]/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 z-20">
              <h2 className="text-5xl font-bold mb-4 text-white drop-shadow-md">승리했습니다!</h2>
              <div className="flex gap-4">
                <button 
                  onClick={() => setWin(false)}
                  className="bg-[#607D8B] text-white font-bold py-3 px-6 rounded-md text-lg hover:scale-105 transition-transform shadow-lg"
                >
                  계속하기
                </button>
                <button 
                  onClick={initGame}
                  className="bg-white text-[#455A64] font-bold py-3 px-6 rounded-md text-lg hover:scale-105 transition-transform shadow-lg"
                >
                  새 게임
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 text-sm leading-relaxed">
          <p>
            <span className="font-bold uppercase">게임 방법:</span> 화면을 상하좌우로 밀어서 타일을 이동시키세요. 같은 숫자의 타일이 만나면 <span className="font-bold">하나로 합쳐집니다!</span>
          </p>
          <hr className="my-4 border-[#CFD8DC]" />
          <p className="text-[#78909C]">
            React와 HTML5 Canvas로 제작되었습니다. 모바일 터치에 최적화되어 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
