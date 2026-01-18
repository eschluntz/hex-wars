// ============================================================================
// HEX DOMINION - Audio UI Controls
// ============================================================================

import { audioManager } from './audio-manager.js';

export class AudioUI {
  private container: HTMLElement;
  private muteBtn: HTMLButtonElement;
  private musicSlider: HTMLInputElement;
  private sfxSlider: HTMLInputElement;
  private isExpanded = false;

  constructor() {
    this.container = document.getElementById('audio-controls')!;
    this.muteBtn = document.getElementById('audio-mute-btn') as HTMLButtonElement;
    this.musicSlider = document.getElementById('music-volume') as HTMLInputElement;
    this.sfxSlider = document.getElementById('sfx-volume') as HTMLInputElement;

    this.initializeValues();
    this.setupEventListeners();
  }

  private initializeValues(): void {
    // Set slider values from saved settings
    this.musicSlider.value = String(audioManager.getMusicVolume() * 100);
    this.sfxSlider.value = String(audioManager.getSfxVolume() * 100);
    this.updateMuteButton();
  }

  private setupEventListeners(): void {
    // Mute button
    this.muteBtn.addEventListener('click', () => {
      audioManager.toggleMute();
      this.updateMuteButton();
    });

    // Toggle expanded on hover (for sliders)
    this.container.addEventListener('mouseenter', () => {
      this.isExpanded = true;
      this.container.classList.add('expanded');
    });

    this.container.addEventListener('mouseleave', () => {
      this.isExpanded = false;
      this.container.classList.remove('expanded');
    });

    // Music volume slider
    this.musicSlider.addEventListener('input', () => {
      const value = parseInt(this.musicSlider.value) / 100;
      audioManager.setMusicVolume(value);
      // Unmute if adjusting volume
      if (audioManager.isMuted() && value > 0) {
        audioManager.setMuted(false);
        this.updateMuteButton();
      }
    });

    // SFX volume slider
    this.sfxSlider.addEventListener('input', () => {
      const value = parseInt(this.sfxSlider.value) / 100;
      audioManager.setSfxVolume(value);
      // Unmute if adjusting volume
      if (audioManager.isMuted() && value > 0) {
        audioManager.setMuted(false);
        this.updateMuteButton();
      }
    });

    // Play a test sound when releasing sfx slider
    this.sfxSlider.addEventListener('change', () => {
      audioManager.playSfx('click');
    });
  }

  private updateMuteButton(): void {
    const isMuted = audioManager.isMuted();
    this.muteBtn.textContent = isMuted ? '🔇' : '🔊';
    this.muteBtn.title = isMuted ? 'Unmute' : 'Mute';
  }
}
