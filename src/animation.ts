// ============================================================================
// HEX DOMINION - Animation Controller
// ============================================================================

import { type AxialCoord } from './core.js';
import { type Renderer, type PathPreview } from './renderer.js';
import { type Viewport } from './viewport.js';

export type AnimationType = 'move' | 'build' | 'research' | 'design' | 'combat';

export interface Animation {
  type: AnimationType;
  hexQ: number;
  hexR: number;
  path?: AxialCoord[];      // For 'move'
  toastText?: string;       // For toast types
}

const ANIMATION_DURATION = 1000; // ms

export class AnimationController {
  private renderer: Renderer;
  private viewport: Viewport;
  private isSpacebarHeld: () => boolean;

  constructor(
    renderer: Renderer,
    viewport: Viewport,
    isSpacebarHeld: () => boolean
  ) {
    this.renderer = renderer;
    this.viewport = viewport;
    this.isSpacebarHeld = isSpacebarHeld;
  }

  async play(animation: Animation): Promise<void> {
    // Skip if spacebar held
    if (this.isSpacebarHeld()) {
      return;
    }

    // Smoothly pan camera to hex
    this.viewport.panTo(animation.hexQ, animation.hexR);

    if (animation.type === 'move' && animation.path) {
      // Set animation path for move animations
      const pathPreview: PathPreview = {
        path: animation.path,
        reachableIndex: animation.path.length - 1  // All reachable (green)
      };
      this.renderer.animationPath = pathPreview;
      this.renderer.activeToast = null;

      // First phase: show path from start position
      await this.waitForDuration(ANIMATION_DURATION / 2);
      if (this.isSpacebarHeld()) {
        this.clearAnimation();
        return;
      }

      // Second phase: pan to destination
      const dest = animation.path[animation.path.length - 1]!;
      this.viewport.panTo(dest.q, dest.r);
      await this.waitForDuration(ANIMATION_DURATION / 2);

      this.clearAnimation();
    } else if (animation.toastText) {
      // Set toast for other animation types
      this.renderer.animationPath = null;
      this.renderer.activeToast = {
        q: animation.hexQ,
        r: animation.hexR,
        text: animation.toastText,
        progress: 0
      };

      // Animate toast over duration
      await this.animateToast(ANIMATION_DURATION);
      this.clearAnimation();
    }
  }

  private waitForDuration(duration: number): Promise<void> {
    return new Promise(resolve => {
      const startTime = performance.now();
      const check = () => {
        if (this.isSpacebarHeld()) {
          resolve();
          return;
        }
        const elapsed = performance.now() - startTime;
        if (elapsed >= duration) {
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      requestAnimationFrame(check);
    });
  }

  private animateToast(duration: number): Promise<void> {
    return new Promise(resolve => {
      const startTime = performance.now();
      const animate = () => {
        if (this.isSpacebarHeld()) {
          resolve();
          return;
        }

        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (this.renderer.activeToast) {
          this.renderer.activeToast.progress = progress;
        }

        if (progress >= 1) {
          resolve();
        } else {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    });
  }

  private clearAnimation(): void {
    this.renderer.animationPath = null;
    this.renderer.activeToast = null;
  }

  async playTurnAnnouncement(teamName: string): Promise<void> {
    const FAST_DURATION = 100;

    this.renderer.turnAnnouncement = {
      text: `${teamName}'s Turn`,
      progress: 0
    };

    const startTime = performance.now();

    await new Promise<void>(resolve => {
      const animate = () => {
        const elapsed = performance.now() - startTime;
        // Use fast duration if spacebar held at any point
        const duration = this.isSpacebarHeld() ? FAST_DURATION : ANIMATION_DURATION;
        const progress = Math.min(elapsed / duration, 1);

        if (this.renderer.turnAnnouncement) {
          this.renderer.turnAnnouncement.progress = progress;
        }

        if (progress >= 1) {
          this.renderer.turnAnnouncement = null;
          resolve();
        } else {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    });
  }
}
