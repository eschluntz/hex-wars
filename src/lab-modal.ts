// ============================================================================
// HEX DOMINION - Lab Modal (HTML/DOM-based)
// ============================================================================

import { type DesignState } from './unit-designer.js';
import { type ChassisComponent, type WeaponComponent, type SystemComponent } from './components.js';
import {
  getResearchedChassis,
  getAvailableWeapons,
  getAvailableSystems,
  getDesignPreview,
  getChassisDetails,
  getWeaponDetails,
  getSystemDetails,
} from './unit-designer.js';
import { isNameTaken, type UnitTemplate } from './unit-templates.js';

export interface LabModalCallbacks {
  onSave: (name: string, design: DesignState) => void;
  onCancel: () => void;
}

export class LabModal {
  private overlay: HTMLDivElement;
  private design: DesignState = { chassisId: 'foot', weaponId: null, systemIds: [] };
  private team: string = '';
  private editingId?: string;
  private callbacks: LabModalCallbacks | null = null;
  private templates: UnitTemplate[] = [];

  constructor() {
    this.overlay = this.createOverlay();
    document.body.appendChild(this.overlay);
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = 'lab-overlay';
    overlay.className = 'lab-overlay hidden';
    overlay.innerHTML = `
      <div class="lab-modal">
        <div class="lab-header">
          <h2 class="lab-title">UNIT DESIGNER</h2>
          <button class="lab-close" type="button">&times;</button>
        </div>

        <div class="lab-phase lab-phase-list">
          <div class="lab-templates"></div>
          <button class="lab-new-btn" type="button">+ Create New Design</button>
        </div>

        <div class="lab-phase lab-phase-design hidden">
          <div class="lab-columns">
            <fieldset class="lab-column">
              <legend>Chassis</legend>
              <div class="lab-options" data-group="chassis"></div>
            </fieldset>
            <fieldset class="lab-column">
              <legend>Weapon</legend>
              <div class="lab-options" data-group="weapon"></div>
            </fieldset>
            <fieldset class="lab-column">
              <legend>System</legend>
              <div class="lab-options" data-group="system"></div>
            </fieldset>
          </div>

          <div class="lab-tooltip">Hover over a component for details</div>

          <div class="lab-stats"></div>

          <div class="lab-name-row">
            <label for="lab-name">Name:</label>
            <input type="text" id="lab-name" maxlength="20" autocomplete="off">
            <span class="lab-name-error"></span>
          </div>

          <div class="lab-actions">
            <button class="lab-back-btn" type="button">← Back</button>
            <button class="lab-save-btn" type="button">Save Design</button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this.close();
    });

    overlay.querySelector('.lab-close')!.addEventListener('click', () => this.close());
    overlay.querySelector('.lab-new-btn')!.addEventListener('click', () => this.showDesignPhase());
    overlay.querySelector('.lab-back-btn')!.addEventListener('click', () => this.showListPhase());
    overlay.querySelector('.lab-save-btn')!.addEventListener('click', () => this.save());

    const nameInput = overlay.querySelector('#lab-name') as HTMLInputElement;
    nameInput.addEventListener('input', () => this.validateName());
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.save();
    });

    // Block game keys when modal is open
    document.addEventListener('keydown', e => {
      if (this.overlay.classList.contains('hidden')) return;

      // Close on Escape
      if (e.key === 'Escape') {
        this.close();
        e.preventDefault();
        return;
      }

      // Allow typing in input fields
      if (document.activeElement?.tagName === 'INPUT') {
        // Just stop propagation so game doesn't see it, but let input work
        e.stopPropagation();
        return;
      }

      // Block WASD and Tab from reaching the game
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'Tab'].includes(e.key)) {
        e.stopPropagation();
      }
    }, true); // Use capture phase to intercept before game

    return overlay;
  }

  open(team: string, templates: UnitTemplate[], callbacks: LabModalCallbacks): void {
    this.team = team;
    this.templates = templates;
    this.callbacks = callbacks;
    this.editingId = undefined;
    this.design = { chassisId: 'foot', weaponId: null, systemIds: [] };

    this.renderTemplateList();
    this.showListPhase();
    this.overlay.classList.remove('hidden');
  }

  private close(): void {
    this.overlay.classList.add('hidden');
    this.callbacks?.onCancel();
  }

  private showListPhase(): void {
    this.overlay.querySelector('.lab-phase-list')!.classList.remove('hidden');
    this.overlay.querySelector('.lab-phase-design')!.classList.add('hidden');
    (this.overlay.querySelector('.lab-title') as HTMLElement).textContent = 'UNIT DESIGNER';
  }

  private showDesignPhase(template?: UnitTemplate): void {
    this.overlay.querySelector('.lab-phase-list')!.classList.add('hidden');
    this.overlay.querySelector('.lab-phase-design')!.classList.remove('hidden');

    if (template) {
      this.editingId = template.id;
      this.design = {
        chassisId: template.chassisId,
        weaponId: template.weaponId,
        systemIds: [...template.systemIds],
      };
      (this.overlay.querySelector('#lab-name') as HTMLInputElement).value = template.name;
      (this.overlay.querySelector('.lab-title') as HTMLElement).textContent = 'EDIT DESIGN';
    } else {
      this.editingId = undefined;
      this.design = { chassisId: 'foot', weaponId: null, systemIds: [] };
      (this.overlay.querySelector('#lab-name') as HTMLInputElement).value = '';
      (this.overlay.querySelector('.lab-title') as HTMLElement).textContent = 'NEW DESIGN';
    }

    this.renderOptions();
    this.updateStats();
    this.validateName();
  }

  private renderTemplateList(): void {
    const container = this.overlay.querySelector('.lab-templates')!;
    container.innerHTML = '';

    for (const template of this.templates) {
      const btn = document.createElement('button');
      btn.className = 'lab-template-btn';
      btn.innerHTML = `
        <span class="template-name">${template.name}</span>
        <span class="template-cost">$${template.cost}</span>
      `;
      btn.addEventListener('click', () => this.showDesignPhase(template));
      container.appendChild(btn);
    }
  }

  private renderOptions(): void {
    this.renderChassisOptions();
    this.renderWeaponOptions();
    this.renderSystemOptions();
  }

  private renderChassisOptions(): void {
    const container = this.overlay.querySelector('[data-group="chassis"]')!;
    container.innerHTML = '';

    const chassisList = getResearchedChassis(this.team);
    for (const chassis of chassisList) {
      container.appendChild(this.createOption('chassis', chassis.id, chassis.name, chassis.baseCost, true));
    }
  }

  private renderWeaponOptions(): void {
    const container = this.overlay.querySelector('[data-group="weapon"]')!;
    container.innerHTML = '';

    // None option
    container.appendChild(this.createOption('weapon', '', 'None', 0, true));

    const weapons = getAvailableWeapons(this.design.chassisId, this.design.systemIds, this.team);
    for (const { weapon, available, reason } of weapons) {
      const opt = this.createOption('weapon', weapon.id, weapon.name, weapon.cost, available, reason);
      container.appendChild(opt);
    }
  }

  private renderSystemOptions(): void {
    const container = this.overlay.querySelector('[data-group="system"]')!;
    container.innerHTML = '';

    // None option
    container.appendChild(this.createOption('system', '', 'None', 0, true));

    const systems = getAvailableSystems(this.design.chassisId, this.design.systemIds, this.design.weaponId, this.team);
    for (const { system, available, reason } of systems) {
      const opt = this.createOption('system', system.id, system.name, system.cost, available, reason);
      container.appendChild(opt);
    }
  }

  private createOption(group: string, value: string, name: string, cost: number, available: boolean, reason?: string): HTMLLabelElement {
    const label = document.createElement('label');
    label.className = `lab-option ${available ? '' : 'disabled'}`;

    const isSelected = this.isSelected(group, value);

    label.innerHTML = `
      <input type="radio" name="${group}" value="${value}" ${isSelected ? 'checked' : ''} ${available ? '' : 'disabled'}>
      <span class="option-radio"></span>
      <span class="option-name">${name}</span>
      <span class="option-cost">${cost > 0 ? '$' + cost : ''}</span>
    `;

    const input = label.querySelector('input')!;
    input.addEventListener('change', () => this.onOptionChange(group, value));

    // Tooltip on hover
    label.addEventListener('mouseenter', () => this.showTooltip(group, value, available, reason));
    label.addEventListener('mouseleave', () => this.hideTooltip());

    return label;
  }

  private isSelected(group: string, value: string): boolean {
    if (group === 'chassis') return this.design.chassisId === value;
    if (group === 'weapon') return this.design.weaponId === (value || null);
    if (group === 'system') {
      if (value === '') return this.design.systemIds.length === 0;
      return this.design.systemIds.includes(value);
    }
    return false;
  }

  private onOptionChange(group: string, value: string): void {
    if (group === 'chassis') {
      this.design.chassisId = value;
      // Re-render weapons and systems (availability may have changed)
      this.renderWeaponOptions();
      this.renderSystemOptions();
    } else if (group === 'weapon') {
      this.design.weaponId = value || null;
      // Re-render systems (weight capacity may have changed)
      this.renderSystemOptions();
    } else if (group === 'system') {
      this.design.systemIds = value ? [value] : [];
      // Re-render weapons (weight capacity may have changed)
      this.renderWeaponOptions();
    }
    this.updateStats();
  }

  private showTooltip(group: string, id: string, available: boolean, reason?: string): void {
    const tooltip = this.overlay.querySelector('.lab-tooltip') as HTMLElement;

    if (!id) {
      tooltip.textContent = 'No ' + group + ' equipped';
      return;
    }

    let details;
    if (group === 'chassis') details = getChassisDetails(id);
    else if (group === 'weapon') details = getWeaponDetails(id);
    else details = getSystemDetails(id);

    let text = `${details.name} — ${details.stats.join(' | ')}`;
    if (details.abilities) text += ` | ${details.abilities.join(', ')}`;
    if (!available && reason) text += ` | ⚠️ ${reason}`;

    tooltip.textContent = text;
    tooltip.classList.toggle('unavailable', !available);
  }

  private hideTooltip(): void {
    const tooltip = this.overlay.querySelector('.lab-tooltip') as HTMLElement;
    tooltip.textContent = 'Hover over a component for details';
    tooltip.classList.remove('unavailable');
  }

  private updateStats(): void {
    const container = this.overlay.querySelector('.lab-stats')!;
    const preview = getDesignPreview(this.design);

    if (!preview) {
      container.innerHTML = '<div class="stats-empty">Select components to see stats</div>';
      return;
    }

    const abilities = [];
    if (preview.canCapture) abilities.push('📍 Capture');
    if (preview.canBuild) abilities.push('🔧 Build');
    if (preview.armored) abilities.push('🛡️ Armored');
    if (preview.armorPiercing) abilities.push('💥 AP');

    const abilitiesText = abilities.length ? abilities.join(' ') : '—';
    const errorText = (!preview.valid && preview.error) ? `⚠️ ${preview.error}` : '';

    container.innerHTML = `
      <div class="stat"><span class="stat-label">Cost</span><span class="stat-value cost">$${preview.cost}</span></div>
      <div class="stat"><span class="stat-label">Speed</span><span class="stat-value">${preview.speed}</span></div>
      <div class="stat"><span class="stat-label">Attack</span><span class="stat-value">${preview.attack}</span></div>
      <div class="stat"><span class="stat-label">Range</span><span class="stat-value">${preview.range}</span></div>
      <div class="stat"><span class="stat-label">Weight</span><span class="stat-value ${preview.totalWeight > preview.maxWeight ? 'error' : ''}">${preview.totalWeight}/${preview.maxWeight}</span></div>
      <div class="stat abilities">${abilitiesText}</div>
      <div class="stat error-msg">${errorText}</div>
    `;
  }

  private validateName(): boolean {
    const input = this.overlay.querySelector('#lab-name') as HTMLInputElement;
    const errorSpan = this.overlay.querySelector('.lab-name-error') as HTMLElement;
    const saveBtn = this.overlay.querySelector('.lab-save-btn') as HTMLButtonElement;
    const name = input.value.trim();

    let error = '';
    if (!name) {
      error = '';  // Don't show error for empty, just disable save
    } else if (isNameTaken(this.team, name, this.editingId)) {
      error = 'Name already exists';
    }

    errorSpan.textContent = error;
    input.classList.toggle('invalid', !!error);

    const preview = getDesignPreview(this.design);
    const canSave = name.length > 0 && !error && preview?.valid;
    saveBtn.disabled = !canSave;

    return !!canSave;
  }

  private save(): void {
    if (!this.validateName()) return;

    const name = (this.overlay.querySelector('#lab-name') as HTMLInputElement).value.trim();
    this.overlay.classList.add('hidden');
    this.callbacks?.onSave(name, this.design);
  }
}
