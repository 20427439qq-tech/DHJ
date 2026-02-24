export interface Point {
  x: number;
  y: number;
}

export interface Rocket {
  id: string;
  start: Point;
  current: Point;
  target: Point;
  speed: number;
  color: string;
}

export interface Missile {
  id: string;
  start: Point;
  current: Point;
  target: Point;
  speed: number;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  growthRate: number;
  state: 'growing' | 'shrinking';
}

export interface Tower {
  id: number;
  x: number;
  y: number;
  ammo: number;
  maxAmmo: number;
  destroyed: boolean;
}

export interface City {
  id: number;
  x: number;
  y: number;
  destroyed: boolean;
}

export type GameState = 'START' | 'PLAYING' | 'WON' | 'LOST';
