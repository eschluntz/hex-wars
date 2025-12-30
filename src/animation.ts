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

    // Snap camera to hex
    this.viewport.centerOn(animation.hexQ, animation.hexR);

    if (animation.type === 'move' && animation.path) {
      // Set animation path for move animations
      const pathPreview: PathPreview = {
        path: animation.path,
        reachableIndex: animation.path.length - 1  // All reachable (green)
      };
      this.renderer.animationPath = pathPreview;
      this.renderer.activeToast = null;
    } else if (animation.toastText) {
      // Set toast for other animation types
      this.renderer.animationPath = null;
      this.renderer.activeToast = {
        q: animation.hexQ,
        r: animation.hexR,
        text: animation.toastText,
        progress: 0
      };
    }

    // Animate over duration
    const startTime = performance.now();

    await new Promise<void>(resolve => {
      const animate = () => {
        // Check for skip during animation
        if (this.isSpacebarHeld()) {
          this.clearAnimation();
          resolve();
          return;
        }

        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

        // Update toast progress for fade in/out effect
        if (this.renderer.activeToast) {
          this.renderer.activeToast.progress = progress;
        }

        if (progress >= 1) {
          this.clearAnimation();
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
    // Skip if spacebar held
    if (this.isSpacebarHeld()) {
      return;
    }

    this.renderer.turnAnnouncement = {
      text: `${teamName}'s Turn`,
      progress: 0
    };

    const startTime = performance.now();

    await new Promise<void>(resolve => {
      const animate = () => {
        // Check for skip during animation
        if (this.isSpacebarHeld()) {
          this.renderer.turnAnnouncement = null;
          resolve();
          return;
        }

        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

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
