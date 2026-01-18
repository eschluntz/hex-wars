// ============================================================================
// HEX DOMINION - Combat Animation System
// ============================================================================

import { HexUtil, type AxialCoord } from './core.js';

// Animation timing constants (ms)
export const ANIMATION_START_DELAY = 150;  // Pause before animation begins
export const LUNGE_OUT_DURATION = 80;
export const LUNGE_BACK_DURATION = 80;
const FLASH_DURATION = 100;
const SHAKE_DURATION = 150;
const DAMAGE_FLOAT_DURATION = 800;
const DEATH_DURATION = 300;
const HEALTH_DRAIN_DURATION = 200;

// Delay before counter-attack health drains (after counter lunge hits)
export const COUNTER_ATTACK_HEALTH_DELAY = ANIMATION_START_DELAY + LUNGE_OUT_DURATION + LUNGE_BACK_DURATION + 50 + LUNGE_OUT_DURATION;

// Total duration to wait for combat animations to complete (includes counter-attack and death)
// Timeline: start delay -> lunge -> counter delay -> counter lunge -> death animation
const COUNTER_START = ANIMATION_START_DELAY + LUNGE_OUT_DURATION + LUNGE_BACK_DURATION + 50;
const DEATH_FROM_COUNTER_END = COUNTER_START + LUNGE_OUT_DURATION + FLASH_DURATION + DEATH_DURATION;
export const COMBAT_ANIMATION_DURATION = DEATH_FROM_COUNTER_END;  // ~670ms

export interface CombatAnimation {
  type: 'lunge' | 'hit' | 'death';
  unitId: string;
  startTime: number;
  duration: number;
  // Lunge-specific
  targetWorldX?: number;
  targetWorldY?: number;
  unitWorldX?: number;
  unitWorldY?: number;
  // Hit-specific
  shakeOffset?: number;
}

export interface FloatingNumber {
  x: number;  // World X position
  y: number;  // World Y position
  text: string;
  startTime: number;
  duration: number;
  color: string;  // Text color (e.g., '#ff4444' for damage, '#44ff44' for heal)
}

export interface DeathParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  startTime: number;
  duration: number;
}

export interface UnitVisualState {
  offsetX: number;
  offsetY: number;
  scale: number;
  alpha: number;
  flashIntensity: number;  // 0-1, for white flash overlay
}

const DEFAULT_VISUAL_STATE: UnitVisualState = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  alpha: 1,
  flashIntensity: 0,
};

export class CombatAnimator {
  private animations: CombatAnimation[] = [];
  private floatingNumbers: FloatingNumber[] = [];
  private deathParticles: DeathParticle[] = [];
  private healthDisplays: Map<string, { current: number; target: number; startTime: number }> = new Map();
  private currentTime: number = 0;

  /**
   * Trigger a combat animation sequence.
   * @param attackerId - The attacking unit's ID
   * @param attackerQ - Attacker's hex Q coordinate
   * @param attackerR - Attacker's hex R coordinate
   * @param defenderId - The defending unit's ID
   * @param defenderQ - Defender's hex Q coordinate
   * @param defenderR - Defender's hex R coordinate
   * @param damage - Damage dealt to defender
   * @param defenderDied - Whether defender was killed
   * @param hexSize - Size of hex for coordinate conversion
   */
  triggerAttack(
    attackerId: string,
    attackerQ: number,
    attackerR: number,
    defenderId: string,
    defenderQ: number,
    defenderR: number,
    damage: number,
    defenderDied: boolean,
    hexSize: number
  ): void {
    const now = this.currentTime;
    const start = now + ANIMATION_START_DELAY;  // Add delay before animation begins

    // Get world positions
    const attackerWorld = HexUtil.axialToPixel(attackerQ, attackerR, hexSize);
    const defenderWorld = HexUtil.axialToPixel(defenderQ, defenderR, hexSize);

    // Attacker lunge animation
    this.animations.push({
      type: 'lunge',
      unitId: attackerId,
      startTime: start,
      duration: LUNGE_OUT_DURATION + LUNGE_BACK_DURATION,
      targetWorldX: defenderWorld.x,
      targetWorldY: defenderWorld.y,
      unitWorldX: attackerWorld.x,
      unitWorldY: attackerWorld.y,
    });

    // Defender hit animation (starts after lunge out)
    this.animations.push({
      type: 'hit',
      unitId: defenderId,
      startTime: start + LUNGE_OUT_DURATION,
      duration: Math.max(FLASH_DURATION, SHAKE_DURATION),
    });

    // Floating damage number
    this.floatingNumbers.push({
      x: defenderWorld.x,
      y: defenderWorld.y,
      text: `-${damage}`,
      startTime: start + LUNGE_OUT_DURATION,
      duration: DAMAGE_FLOAT_DURATION,
      color: '#ff4444',
    });

    // Death animation if defender died
    if (defenderDied) {
      this.animations.push({
        type: 'death',
        unitId: defenderId,
        startTime: start + LUNGE_OUT_DURATION + FLASH_DURATION,
        duration: DEATH_DURATION,
      });

      // Death particles
      this.spawnDeathParticles(defenderWorld.x, defenderWorld.y, start + LUNGE_OUT_DURATION + FLASH_DURATION);
    }
  }

  /**
   * Trigger a counter-attack animation.
   */
  triggerCounterAttack(
    defenderId: string,
    defenderQ: number,
    defenderR: number,
    attackerId: string,
    attackerQ: number,
    attackerR: number,
    damage: number,
    attackerDied: boolean,
    hexSize: number
  ): void {
    // Counter-attack starts after initial attack sequence (including the start delay)
    const start = this.currentTime + ANIMATION_START_DELAY + LUNGE_OUT_DURATION + LUNGE_BACK_DURATION + 50;

    const defenderWorld = HexUtil.axialToPixel(defenderQ, defenderR, hexSize);
    const attackerWorld = HexUtil.axialToPixel(attackerQ, attackerR, hexSize);

    // Defender (now counter-attacker) lunges
    this.animations.push({
      type: 'lunge',
      unitId: defenderId,
      startTime: start,
      duration: LUNGE_OUT_DURATION + LUNGE_BACK_DURATION,
      targetWorldX: attackerWorld.x,
      targetWorldY: attackerWorld.y,
      unitWorldX: defenderWorld.x,
      unitWorldY: defenderWorld.y,
    });

    // Original attacker gets hit
    this.animations.push({
      type: 'hit',
      unitId: attackerId,
      startTime: start + LUNGE_OUT_DURATION,
      duration: Math.max(FLASH_DURATION, SHAKE_DURATION),
    });

    // Counter damage floating number
    this.floatingNumbers.push({
      x: attackerWorld.x,
      y: attackerWorld.y,
      text: `-${damage}`,
      startTime: start + LUNGE_OUT_DURATION,
      duration: DAMAGE_FLOAT_DURATION,
      color: '#ff4444',
    });

    // Death animation if attacker died from counter
    if (attackerDied) {
      this.animations.push({
        type: 'death',
        unitId: attackerId,
        startTime: start + LUNGE_OUT_DURATION + FLASH_DURATION,
        duration: DEATH_DURATION,
      });

      this.spawnDeathParticles(attackerWorld.x, attackerWorld.y, start + LUNGE_OUT_DURATION + FLASH_DURATION);
    }
  }

  private spawnDeathParticles(worldX: number, worldY: number, startTime: number): void {
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const speed = 50 + Math.random() * 50;
      this.deathParticles.push({
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        startTime,
        duration: DEATH_DURATION,
      });
    }
  }

  /**
   * Update displayed health for smooth animation.
   * @param oldHealth - Health before damage
   * @param newHealth - Health after damage
   * @param delay - Optional delay in ms before the health starts draining (default: after lunge hits)
   */
  setUnitHealth(unitId: string, oldHealth: number, newHealth: number, delay?: number): void {
    const actualDelay = delay ?? (ANIMATION_START_DELAY + LUNGE_OUT_DURATION);

    this.healthDisplays.set(unitId, {
      current: oldHealth,
      target: newHealth,
      startTime: this.currentTime + actualDelay,
    });
  }

  /**
   * Trigger a heal animation with green floating number.
   * @returns Duration of the heal animation in ms
   */
  triggerHeal(
    unitId: string,
    q: number,
    r: number,
    healAmount: number,
    oldHealth: number,
    newHealth: number,
    hexSize: number
  ): number {
    const now = this.currentTime;
    const world = HexUtil.axialToPixel(q, r, hexSize);

    // Green floating heal number
    this.floatingNumbers.push({
      x: world.x,
      y: world.y,
      text: `+${healAmount}`,
      startTime: now,
      duration: DAMAGE_FLOAT_DURATION,
      color: '#44ff44',
    });

    // Update health display
    this.healthDisplays.set(unitId, {
      current: oldHealth,
      target: newHealth,
      startTime: now,
    });

    return DAMAGE_FLOAT_DURATION;
  }

  /**
   * Get the displayed health for a unit (for smooth animation).
   */
  getDisplayedHealth(unitId: string, actualHealth: number): number {
    const display = this.healthDisplays.get(unitId);
    if (!display) return actualHealth;

    // If actual health differs from target (e.g., unit was healed/joined), clear the animation
    if (display.target !== actualHealth) {
      this.healthDisplays.delete(unitId);
      return actualHealth;
    }

    const elapsed = this.currentTime - display.startTime;
    // Clamp progress: 0 before start, 1 after complete
    const progress = Math.max(0, Math.min(elapsed / HEALTH_DRAIN_DURATION, 1));

    // Ease out
    const eased = 1 - Math.pow(1 - progress, 2);
    return display.current + (display.target - display.current) * eased;
  }

  /**
   * Get visual state for a unit (offsets, scale, alpha, flash).
   */
  getUnitVisualState(unitId: string): UnitVisualState {
    const state = { ...DEFAULT_VISUAL_STATE };
    const now = this.currentTime;

    for (const anim of this.animations) {
      if (anim.unitId !== unitId) continue;

      const elapsed = now - anim.startTime;
      if (elapsed < 0 || elapsed > anim.duration) continue;

      const progress = elapsed / anim.duration;

      switch (anim.type) {
        case 'lunge': {
          // Lunge toward target then snap back
          const lungeProgress = elapsed / LUNGE_OUT_DURATION;
          const backProgress = (elapsed - LUNGE_OUT_DURATION) / LUNGE_BACK_DURATION;

          let lungeAmount: number;
          if (lungeProgress < 1) {
            // Easing: ease out quad
            lungeAmount = 1 - Math.pow(1 - lungeProgress, 2);
          } else if (backProgress < 1) {
            // Snap back with ease in
            lungeAmount = 1 - backProgress * backProgress;
          } else {
            lungeAmount = 0;
          }

          // Calculate direction to target
          const dx = anim.targetWorldX! - anim.unitWorldX!;
          const dy = anim.targetWorldY! - anim.unitWorldY!;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const lungeDistance = dist * 0.2;  // 20% toward target
            state.offsetX = (dx / dist) * lungeDistance * lungeAmount;
            state.offsetY = (dy / dist) * lungeDistance * lungeAmount;
          }
          break;
        }

        case 'hit': {
          // Flash effect
          const flashProgress = elapsed / FLASH_DURATION;
          if (flashProgress < 1) {
            // Quick flash then fade
            state.flashIntensity = flashProgress < 0.3 ? 1 : 1 - ((flashProgress - 0.3) / 0.7);
          }

          // Shake effect
          const shakeProgress = elapsed / SHAKE_DURATION;
          if (shakeProgress < 1) {
            // Oscillating shake that decays
            const shakeAmount = 4 * (1 - shakeProgress);
            const shakeFreq = 3;
            state.offsetX = Math.sin(shakeProgress * Math.PI * 2 * shakeFreq) * shakeAmount;
          }
          break;
        }

        case 'death': {
          // Shrink and fade
          const deathProgress = progress;
          state.scale = 1 - deathProgress * 0.5;  // Shrink to 50%
          state.alpha = 1 - deathProgress;

          // Flash at start
          if (deathProgress < 0.2) {
            state.flashIntensity = 1 - (deathProgress / 0.2);
          }
          break;
        }
      }
    }

    return state;
  }

  /**
   * Get active floating damage numbers.
   */
  getFloatingNumbers(): Array<{ x: number; y: number; text: string; alpha: number; offsetY: number; color: string }> {
    const now = this.currentTime;
    const result: Array<{ x: number; y: number; text: string; alpha: number; offsetY: number; color: string }> = [];

    for (const fn of this.floatingNumbers) {
      const elapsed = now - fn.startTime;
      if (elapsed < 0 || elapsed > fn.duration) continue;

      const progress = elapsed / fn.duration;
      // Float upward
      const offsetY = -30 * progress;
      // Fade out in last 30%
      const alpha = progress > 0.7 ? 1 - ((progress - 0.7) / 0.3) : 1;

      result.push({
        x: fn.x,
        y: fn.y,
        text: fn.text,
        alpha,
        offsetY,
        color: fn.color,
      });
    }

    return result;
  }

  /**
   * Get active death particles.
   */
  getDeathParticles(): Array<{ x: number; y: number; alpha: number; size: number }> {
    const now = this.currentTime;
    const result: Array<{ x: number; y: number; alpha: number; size: number }> = [];

    for (const p of this.deathParticles) {
      const elapsed = now - p.startTime;
      if (elapsed < 0 || elapsed > p.duration) continue;

      const progress = elapsed / p.duration;
      const x = p.x + p.vx * (elapsed / 1000);
      const y = p.y + p.vy * (elapsed / 1000);
      const alpha = 1 - progress;
      const size = 4 * (1 - progress * 0.5);

      result.push({ x, y, alpha, size });
    }

    return result;
  }

  /**
   * Check if any combat animations are currently active.
   */
  isAnimating(): boolean {
    const now = this.currentTime;

    for (const anim of this.animations) {
      if (now >= anim.startTime && now <= anim.startTime + anim.duration) {
        return true;
      }
    }

    for (const fn of this.floatingNumbers) {
      if (now >= fn.startTime && now <= fn.startTime + fn.duration) {
        return true;
      }
    }

    for (const p of this.deathParticles) {
      if (now >= p.startTime && now <= p.startTime + p.duration) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a unit has a pending or active death animation.
   * Used to keep dead units visible during their death animation.
   */
  hasDeathAnimation(unitId: string): boolean {
    const now = this.currentTime;
    for (const anim of this.animations) {
      if (anim.unitId === unitId && anim.type === 'death') {
        // Include pending animations (not yet started) and active ones
        if (now <= anim.startTime + anim.duration) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Update animation state. Call each frame with current timestamp.
   */
  update(currentTime: number): void {
    this.currentTime = currentTime;

    // Clean up finished animations
    this.animations = this.animations.filter(
      a => currentTime <= a.startTime + a.duration + 100  // Keep briefly after end for smooth transitions
    );

    this.floatingNumbers = this.floatingNumbers.filter(
      fn => currentTime <= fn.startTime + fn.duration
    );

    this.deathParticles = this.deathParticles.filter(
      p => currentTime <= p.startTime + p.duration
    );

    // Update health displays
    for (const [unitId, display] of this.healthDisplays.entries()) {
      const elapsed = currentTime - display.startTime;
      if (elapsed >= HEALTH_DRAIN_DURATION) {
        display.current = display.target;
      }
    }
  }

  /**
   * Clear all animations (e.g., on turn change or game reset).
   */
  clear(): void {
    this.animations = [];
    this.floatingNumbers = [];
    this.deathParticles = [];
    this.healthDisplays.clear();
  }
}
