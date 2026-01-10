// ============================================================================
// HEX DOMINION - Animation Controller
// ============================================================================

import { type AxialCoord } from './core.js';
import { type Renderer, type PathPreview } from './renderer.js';
import { type Viewport } from './viewport.js';

export type AnimationType = 'move' | 'build' | 'combat';

export interface Animation {
  type: AnimationType;
  hexQ: number;
  hexR: number;
  path?: AxialCoord[];      // For 'move'
  unitId?: string;          // For 'move' - unit to animate along path
  skipCameraPan?: boolean;  // For 'move' - don't pan camera during animation
  toastText?: string;       // For toast types
}

const ANIMATION_DURATION = 1000; // ms
const MOVE_MS_PER_HEX = 120; // ms per hex segment for constant speed movement

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

    // Smoothly pan camera to hex (unless skipped for player moves)
    if (!animation.skipCameraPan) {
      this.viewport.panTo(animation.hexQ, animation.hexR);
    }

    if (animation.type === 'move' && animation.path) {
      // Set animation path for move animations
      const pathPreview: PathPreview = {
        path: animation.path,
        reachableIndex: animation.path.length - 1  // All reachable (green)
      };
      this.renderer.animationPath = pathPreview;
      this.renderer.activeToast = null;

      // Set up unit animation
      this.renderer.animatingUnitId = animation.unitId!;
      this.renderer.animationProgress = 0;

      // Calculate duration based on path length (constant speed)
      const numSegments = animation.path.length - 1;
      const duration = numSegments * MOVE_MS_PER_HEX;

      // Animate unit sliding along path
      const dest = animation.path[animation.path.length - 1]!;
      const panCamera = !animation.skipCameraPan;
      await this.animateMove(dest.q, dest.r, duration, panCamera);

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

        this.renderer.activeToast!.progress = progress;

        if (progress >= 1) {
          resolve();
        } else {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    });
  }

  private animateMove(destQ: number, destR: number, duration: number, panCamera: boolean): Promise<void> {
    return new Promise(resolve => {
      const startTime = performance.now();
      const animate = () => {
        if (this.isSpacebarHeld()) {
          this.renderer.animationProgress = 1;
          resolve();
          return;
        }

        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        this.renderer.animationProgress = progress;

        // Pan camera to destination (for AI moves)
        if (panCamera && progress > 0.5) {
          this.viewport.panTo(destQ, destR);
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
    this.renderer.animatingUnitId = null;
    this.renderer.animationProgress = 0;
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

        this.renderer.turnAnnouncement!.progress = progress;

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

  async playGameOverAnnouncement(isVictory: boolean, reason: string): Promise<void> {
    const FAST_DURATION = 200;
    const GAME_OVER_DURATION = 1500; // Longer duration for game over

    this.renderer.turnAnnouncement = {
      text: isVictory ? 'Victory!' : 'Defeat',
      subtitle: reason,
      progress: 0
    };

    const startTime = performance.now();

    await new Promise<void>(resolve => {
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const duration = this.isSpacebarHeld() ? FAST_DURATION : GAME_OVER_DURATION;
        const progress = Math.min(elapsed / duration, 1);

        this.renderer.turnAnnouncement!.progress = progress;

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
