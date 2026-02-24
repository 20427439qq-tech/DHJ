/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket as RocketIcon, Shield, Target, Trophy, RotateCcw, Play } from 'lucide-react';
import { Point, Rocket, Missile, Explosion, Tower, City, GameState } from './types';

const WIN_SCORE = 1000;
const ROCKET_SCORE = 20;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [megaBombs, setMegaBombs] = useState(3);
  
  // Game objects refs to avoid re-renders during animation loop
  const rocketsRef = useRef<Rocket[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);

  const initGame = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Initialize towers
    const initialTowers: Tower[] = [
      { id: 0, x: width * 0.1, y: height - 60, ammo: 20, maxAmmo: 20, destroyed: false },
      { id: 1, x: width * 0.5, y: height - 60, ammo: 40, maxAmmo: 40, destroyed: false },
      { id: 2, x: width * 0.9, y: height - 60, ammo: 20, maxAmmo: 20, destroyed: false },
    ];

    // Initialize cities
    const initialCities: City[] = [
      { id: 0, x: width * 0.22, y: height - 40, destroyed: false },
      { id: 1, x: width * 0.32, y: height - 40, destroyed: false },
      { id: 2, x: width * 0.42, y: height - 40, destroyed: false },
      { id: 3, x: width * 0.58, y: height - 40, destroyed: false },
      { id: 4, x: width * 0.68, y: height - 40, destroyed: false },
      { id: 5, x: width * 0.78, y: height - 40, destroyed: false },
    ];

    setTowers(initialTowers);
    setCities(initialCities);
    setScore(0);
    setMegaBombs(3);
    rocketsRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    setGameState('PLAYING');
  }, []);

  const triggerMegaBomb = () => {
    if (gameState !== 'PLAYING' || megaBombs <= 0) return;
    
    setMegaBombs(prev => prev - 1);
    
    // Create a massive screen-clearing explosion effect
    explosionsRef.current.push({
      id: 'mega-' + Math.random(),
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      radius: 0,
      maxRadius: Math.max(window.innerWidth, window.innerHeight),
      growthRate: 20,
      state: 'growing'
    });

    // Clear all rockets
    setScore(s => s + rocketsRef.current.length * ROCKET_SCORE);
    rocketsRef.current = [];
  };

  const spawnRocket = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Target a random non-destroyed city or tower
    const activeTargets = [
      ...cities.filter(c => !c.destroyed).map(c => ({ x: c.x, y: c.y, type: 'city', id: c.id })),
      ...towers.filter(t => !t.destroyed).map(t => ({ x: t.x, y: t.y, type: 'tower', id: t.id }))
    ];

    if (activeTargets.length === 0) return;

    const target = activeTargets[Math.floor(Math.random() * activeTargets.length)];
    const startX = Math.random() * width;
    
    const newRocket: Rocket = {
      id: Math.random().toString(36).substr(2, 9),
      start: { x: startX, y: 0 },
      current: { x: startX, y: 0 },
      target: { x: target.x, y: target.y },
      speed: 0.6 + Math.random() * 0.8 + (score / 2000), // Reduced speed as requested
      color: '#ff4444'
    };

    rocketsRef.current.push(newRocket);
  }, [gameState, cities, towers, score]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    // Don't fire if clicking too low (near ground)
    if (y > window.innerHeight - 120) return;

    // Find closest tower with ammo
    let bestTower: Tower | null = null;
    let minDist = Infinity;

    towers.forEach(t => {
      if (!t.destroyed && t.ammo > 0) {
        const dist = Math.abs(t.x - x);
        if (dist < minDist) {
          minDist = dist;
          bestTower = t;
        }
      }
    });

    if (bestTower) {
      const tower = bestTower as Tower;
      setTowers(prev => prev.map(t => t.id === tower.id ? { ...t, ammo: t.ammo - 1 } : t));

      const newMissile: Missile = {
        id: Math.random().toString(36).substr(2, 9),
        start: { x: tower.x, y: tower.y - 20 },
        current: { x: tower.x, y: tower.y - 20 },
        target: { x, y },
        speed: 10
      };
      missilesRef.current.push(newMissile);
    }
  };

  const update = (time: number) => {
    if (gameState !== 'PLAYING') return;

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Spawn rockets periodically
    if (Math.random() < 0.015 + (score / 15000)) {
      spawnRocket();
    }

    // Update rockets
    rocketsRef.current = rocketsRef.current.filter(rocket => {
      const dx = rocket.target.x - rocket.current.x;
      const dy = rocket.target.y - rocket.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < rocket.speed) {
        // Impact!
        explosionsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: rocket.target.x,
          y: rocket.target.y,
          radius: 0,
          maxRadius: 40,
          growthRate: 2,
          state: 'growing'
        });

        // Damage targets
        setCities(prev => prev.map(c => {
          if (Math.abs(c.x - rocket.target.x) < 30 && Math.abs(c.y - rocket.target.y) < 30) {
            return { ...c, destroyed: true };
          }
          return c;
        }));

        setTowers(prev => prev.map(t => {
          if (Math.abs(t.x - rocket.target.x) < 40 && Math.abs(t.y - rocket.target.y) < 40) {
            return { ...t, destroyed: true };
          }
          return t;
        }));

        return false;
      }

      const angle = Math.atan2(dy, dx);
      rocket.current.x += Math.cos(angle) * rocket.speed;
      rocket.current.y += Math.sin(angle) * rocket.speed;
      return true;
    });

    // Update missiles
    missilesRef.current = missilesRef.current.filter(missile => {
      const dx = missile.target.x - missile.current.x;
      const dy = missile.target.y - missile.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < missile.speed) {
        // Create explosion at target
        explosionsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: missile.target.x,
          y: missile.target.y,
          radius: 0,
          maxRadius: 50,
          growthRate: 2.5,
          state: 'growing'
        });
        return false;
      }

      const angle = Math.atan2(dy, dx);
      missile.current.x += Math.cos(angle) * missile.speed;
      missile.current.y += Math.sin(angle) * missile.speed;
      return true;
    });

    // Update explosions and check collisions with rockets
    explosionsRef.current = explosionsRef.current.filter(exp => {
      if (exp.state === 'growing') {
        exp.radius += exp.growthRate;
        if (exp.radius >= exp.maxRadius) exp.state = 'shrinking';
      } else {
        exp.radius -= exp.growthRate * 0.6;
      }

      // Check collision with rockets
      rocketsRef.current = rocketsRef.current.filter(rocket => {
        const dx = rocket.current.x - exp.x;
        const dy = rocket.current.y - exp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < exp.radius) {
          setScore(s => s + ROCKET_SCORE);
          // Chain explosion
          explosionsRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            x: rocket.current.x,
            y: rocket.current.y,
            radius: 5,
            maxRadius: 35,
            growthRate: 2.5,
            state: 'growing'
          });
          return false;
        }
        return true;
      });

      return exp.radius > 0;
    });

    // Check game over / win
    if (score >= WIN_SCORE) {
      setGameState('WON');
    } else if (towers.every(t => t.destroyed)) {
      setGameState('LOST');
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw Background (Atmospheric Night Sky)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, '#020617'); // Deep space blue
    skyGradient.addColorStop(0.5, '#0f172a');
    skyGradient.addColorStop(1, '#1e1b4b'); // Horizon purple/blue
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Stars
    ctx.fillStyle = 'white';
    for(let i = 0; i < 100; i++) {
      const x = (Math.sin(i * 123.45) * 0.5 + 0.5) * canvas.width;
      const y = (Math.cos(i * 678.90) * 0.5 + 0.5) * canvas.height * 0.7;
      const size = Math.random() * 1.5;
      ctx.globalAlpha = 0.2 + Math.random() * 0.5;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1.0;

    // 2. Draw Ground / Mountains
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 40);
    for(let i = 0; i <= 10; i++) {
      const x = (i / 10) * canvas.width;
      const y = canvas.height - 40 - Math.sin(i * 2) * 20;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();

    // 3. Draw Cities (More detailed)
    cities.forEach(city => {
      if (!city.destroyed) {
        // Building shadow
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(city.x - 18, city.y - 20, 36, 20);
        
        // Main building
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(city.x - 15, city.y - 18, 30, 18);
        
        // Windows
        ctx.fillStyle = '#fde047';
        for(let r = 0; r < 3; r++) {
          for(let c = 0; c < 3; c++) {
            if (Math.random() > 0.2) {
              ctx.fillRect(city.x - 12 + c * 9, city.y - 15 + r * 5, 4, 3);
            }
          }
        }
        
        // Roof detail
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(city.x - 8, city.y - 25, 16, 7);
      } else {
        // Ruined city
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(city.x - 15, city.y - 5, 30, 5);
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(city.x, city.y - 2, 10, 0, Math.PI, true);
        ctx.fill();
      }
    });

    // 4. Draw Towers (Sci-fi look)
    towers.forEach(tower => {
      if (!tower.destroyed) {
        // Base
        ctx.fillStyle = '#334155';
        ctx.fillRect(tower.x - 25, tower.y - 10, 50, 10);
        
        // Body
        const towerGrad = ctx.createLinearGradient(tower.x - 15, 0, tower.x + 15, 0);
        towerGrad.addColorStop(0, '#475569');
        towerGrad.addColorStop(0.5, '#94a3b8');
        towerGrad.addColorStop(1, '#475569');
        ctx.fillStyle = towerGrad;
        ctx.beginPath();
        ctx.moveTo(tower.x - 15, tower.y - 10);
        ctx.lineTo(tower.x + 15, tower.y - 10);
        ctx.lineTo(tower.x + 8, tower.y - 40);
        ctx.lineTo(tower.x - 8, tower.y - 40);
        ctx.closePath();
        ctx.fill();

        // Cannon head
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y - 45, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        if (tower.ammo > 0) {
          const glow = ctx.createRadialGradient(tower.x, tower.y - 45, 0, tower.x, tower.y - 45, 15);
          glow.addColorStop(0, 'rgba(52, 211, 153, 0.4)');
          glow.addColorStop(1, 'rgba(52, 211, 153, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(tower.x, tower.y - 45, 15, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Destroyed tower
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(tower.x - 20, tower.y - 5, 40, 5);
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(tower.x - 10, tower.y - 5);
        ctx.lineTo(tower.x + 5, tower.y - 5);
        ctx.lineTo(tower.x - 5, tower.y - 15);
        ctx.closePath();
        ctx.fill();
      }
    });

    // 5. Draw Rockets (With trails)
    rocketsRef.current.forEach(rocket => {
      // Trail
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(rocket.start.x, rocket.start.y);
      ctx.lineTo(rocket.current.x, rocket.current.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rocket head
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(rocket.current.x, rocket.current.y, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Rocket glow
      const glow = ctx.createRadialGradient(rocket.current.x, rocket.current.y, 0, rocket.current.x, rocket.current.y, 6);
      glow.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
      glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(rocket.current.x, rocket.current.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Draw Missiles (High-tech)
    missilesRef.current.forEach(missile => {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(missile.current.x, missile.current.y);
      const angle = Math.atan2(missile.current.y - missile.start.y, missile.current.x - missile.start.x);
      ctx.lineTo(missile.current.x - Math.cos(angle) * 15, missile.current.y - Math.sin(angle) * 15);
      ctx.stroke();

      // Target marker
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(missile.target.x, missile.target.y, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(missile.target.x - 8, missile.target.y);
      ctx.lineTo(missile.target.x + 8, missile.target.y);
      ctx.moveTo(missile.target.x, missile.target.y - 8);
      ctx.lineTo(missile.target.x, missile.target.y + 8);
      ctx.stroke();
    });

    // 7. Draw Explosions
    explosionsRef.current.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      if (exp.id.startsWith('mega-')) {
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.2, 'rgba(167, 139, 250, 0.8)');
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(124, 58, 237, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(253, 224, 71, 0.9)');
        gradient.addColorStop(0.5, 'rgba(249, 115, 22, 0.7)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
      }
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(update);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, score, towers, cities, megaBombs]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      <canvas
        ref={canvasRef}
        onMouseDown={handleCanvasClick}
        onTouchStart={handleCanvasClick}
        className="cursor-crosshair"
      />

      {/* HUD */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl shadow-emerald-500/10">
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/70 font-bold mb-1">防卫积分</div>
          <div className="text-4xl font-bold text-white tabular-nums tracking-tight">{score}</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (score / WIN_SCORE) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-white/40 font-mono">{WIN_SCORE}</div>
          </div>
        </div>

        <div className="flex gap-4">
          {towers.map(tower => (
            <div 
              key={tower.id} 
              className={`bg-slate-900/80 backdrop-blur-xl border p-4 rounded-3xl transition-all shadow-xl ${
                tower.destroyed ? 'border-red-500/50 opacity-40 grayscale' : 'border-white/10'
              }`}
            >
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 font-bold">
                {tower.id === 1 ? '中央火力' : tower.id === 0 ? '左翼防线' : '右翼防线'}
              </div>
              <div className="flex items-end gap-2">
                <div className={`text-2xl font-bold font-mono ${tower.ammo < 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {tower.destroyed ? 'OFFLINE' : tower.ammo}
                </div>
                {!tower.destroyed && (
                  <div className="text-[10px] text-white/30 mb-1">/ {tower.maxAmmo}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mega Bomb Button */}
      <div className="absolute bottom-10 right-10 flex flex-col items-center gap-3">
        <AnimatePresence>
          {megaBombs > 0 && gameState === 'PLAYING' && (
            <motion.button
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={triggerMegaBomb}
              className="relative w-20 h-20 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center shadow-2xl shadow-violet-500/40 border-4 border-violet-400/30 group"
            >
              <div className="absolute inset-0 rounded-full bg-violet-400/20 animate-ping group-hover:animate-none" />
              <div className="bg-black/20 p-3 rounded-full">
                <RocketIcon className="w-8 h-8 text-white fill-current" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-white text-violet-600 rounded-full flex items-center justify-center font-bold text-sm shadow-lg border-2 border-violet-600">
                {megaBombs}
              </div>
            </motion.button>
          )}
        </AnimatePresence>
        <div className="text-[10px] uppercase tracking-[0.3em] text-violet-400 font-bold drop-shadow-lg">
          终极脉冲弹
        </div>
      </div>

      {/* Screens */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center z-50"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 20 }}
            >
              <div className="mb-8 relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                <div className="relative inline-flex p-6 bg-emerald-500/10 rounded-[2.5rem] border border-emerald-500/30 shadow-2xl">
                  <Shield className="w-16 h-16 text-emerald-400" />
                </div>
              </div>
              
              <h1 className="text-6xl md:text-8xl font-display mb-6 tracking-tighter text-white drop-shadow-2xl">
                WFWD<span className="text-emerald-400">新星防御</span>
              </h1>
              
              <p className="text-slate-400 max-w-xl mx-auto mb-12 text-xl leading-relaxed font-light">
                指挥官，敌方饱和攻击即将抵达。操作三座量子防空塔，利用拦截弹的爆炸力场粉碎敌方火箭。
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-3xl mx-auto">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                  <Target className="w-8 h-8 text-orange-400 mb-3 mx-auto" />
                  <div className="text-lg font-bold mb-1">预判打击</div>
                  <div className="text-sm text-white/40">瞄准敌机航线前方</div>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                  <RocketIcon className="w-8 h-8 text-violet-400 mb-3 mx-auto" />
                  <div className="text-lg font-bold mb-1">终极脉冲</div>
                  <div className="text-sm text-white/40">全屏清场，仅限3次</div>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                  <Trophy className="w-8 h-8 text-yellow-400 mb-3 mx-auto" />
                  <div className="text-lg font-bold mb-1">防卫目标</div>
                  <div className="text-sm text-white/40">达成 {WIN_SCORE} 积分</div>
                </div>
              </div>

              <button 
                onClick={initGame}
                className="group relative px-12 py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-[2rem] transition-all hover:scale-105 active:scale-95 flex items-center gap-4 mx-auto shadow-2xl shadow-emerald-500/40 text-xl uppercase tracking-widest"
              >
                <Play className="w-6 h-6 fill-current" />
                启动防御系统
              </button>
            </motion.div>
          </motion.div>
        )}

        {gameState === 'WON' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-emerald-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring" }}
            >
              <div className="mb-8 inline-flex p-8 bg-yellow-500/20 rounded-full border border-yellow-500/30 shadow-2xl shadow-yellow-500/20">
                <Trophy className="w-24 h-24 text-yellow-400" />
              </div>
              <h2 className="text-7xl md:text-9xl font-display mb-6 text-white tracking-tighter">战役大捷</h2>
              <p className="text-emerald-200/60 mb-12 text-2xl font-light">新星防线屹立不倒。最终战绩: <span className="text-white font-bold">{score}</span></p>
              <button 
                onClick={initGame}
                className="px-12 py-5 bg-white text-emerald-950 font-black rounded-[2rem] transition-all hover:scale-105 active:scale-95 flex items-center gap-4 mx-auto shadow-2xl text-xl uppercase tracking-widest"
              >
                <RotateCcw className="w-6 h-6" />
                再次出征
              </button>
            </motion.div>
          </motion.div>
        )}

        {gameState === 'LOST' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-red-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring" }}
            >
              <div className="mb-8 inline-flex p-8 bg-red-500/20 rounded-full border border-red-500/30 shadow-2xl shadow-red-500/20">
                <Shield className="w-24 h-24 text-red-400" />
              </div>
              <h2 className="text-7xl md:text-9xl font-display mb-6 text-white tracking-tighter">防线崩溃</h2>
              <p className="text-red-200/60 mb-12 text-2xl font-light">所有防御塔已离线。最终战绩: <span className="text-white font-bold">{score}</span></p>
              <button 
                onClick={initGame}
                className="px-12 py-5 bg-white text-red-950 font-black rounded-[2rem] transition-all hover:scale-105 active:scale-95 flex items-center gap-4 mx-auto shadow-2xl text-xl uppercase tracking-widest"
              >
                <RotateCcw className="w-6 h-6" />
                重整旗鼓
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient Effects */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 to-transparent" />
      <div className="absolute inset-0 pointer-events-none border-[40px] border-white/5 opacity-20" />
    </div>
  );
}
