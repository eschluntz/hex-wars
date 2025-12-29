// ============================================================================
// HEX DOMINION - Lab Modal (HTML/DOM-based)
// ============================================================================

import { type DesignState } from './unit-designer.js';
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
import {
  getTechTreeState,
  computeTechLayout,
  purchaseTech,
  getTech,
  type TechNode,
  type TechPosition,
  TECH_TREE,
} from './tech-tree.js';
import { ResourceManager } from './resources.js';

export interface LabModalCallbacks {
  onSave: (name: string, design: DesignState) => void;
  onCancel: () => void;
  onPurchaseTech?: (techId: string) => void;
}

type LabTab = 'research' | 'designer';

export class LabModal {
  private overlay: HTMLDivElement;
  private design: DesignState = { chassisId: 'foot', weaponId: null, systemIds: [] };
  private team: string = '';
  private editingId?: string;
  private callbacks: LabModalCallbacks | null = null;
  private templates: UnitTemplate[] = [];
  private science: number = 0;
  private resources: ResourceManager | null = null;
  private currentTab: LabTab = 'research';
  private readOnly: boolean = false;

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
          <h2 class="lab-title">LAB</h2>
          <button class="lab-close" type="button">&times;</button>
        </div>

        <div class="lab-tabs">
          <button class="lab-tab active" data-tab="research">Research</button>
          <button class="lab-tab" data-tab="designer">Unit Designer</button>
        </div>

        <!-- RESEARCH TAB -->
        <div class="lab-tab-content lab-tab-research">
          <div class="lab-science-bar">
            <span class="science-icon">🔬</span>
            <span class="science-amount">0</span>
          </div>
          <div class="tech-tree-container">
            <div class="tech-tree-nodes">
              <svg class="tech-tree-lines"></svg>
            </div>
          </div>
          <div class="tech-tooltip"></div>
        </div>

        <!-- UNIT DESIGNER TAB -->
        <div class="lab-tab-content lab-tab-designer hidden">
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

    // Tab switching
    overlay.querySelectorAll('.lab-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab as LabTab;
        this.switchTab(tabName);
      });
    });

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

  open(
    team: string,
    templates: UnitTemplate[],
    callbacks: LabModalCallbacks,
    science: number = 0,
    resources?: ResourceManager,
    readOnly: boolean = false
  ): void {
    this.team = team;
    this.templates = templates;
    this.callbacks = callbacks;
    this.science = science;
    this.resources = resources ?? null;
    this.editingId = undefined;
    this.design = { chassisId: 'foot', weaponId: null, systemIds: [] };
    this.readOnly = readOnly;

    // Update title based on mode
    const title = this.overlay.querySelector('.lab-title') as HTMLElement;
    title.textContent = readOnly ? `${team.toUpperCase()}'S LAB (View Only)` : 'LAB';

    // Hide/show create new button based on mode
    const newBtn = this.overlay.querySelector('.lab-new-btn') as HTMLElement;
    newBtn.style.display = readOnly ? 'none' : '';

    // Add/remove read-only class for styling
    this.overlay.classList.toggle('read-only', readOnly);

    // Default to research tab
    this.switchTab('research');
    this.renderTemplateList();
    this.overlay.classList.remove('hidden');
  }

  private close(): void {
    this.overlay.classList.add('hidden');
    this.callbacks?.onCancel();
  }

  private switchTab(tab: LabTab): void {
    this.currentTab = tab;

    // Update tab button states
    this.overlay.querySelectorAll('.lab-tab').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tab);
    });

    // Show/hide tab content
    const researchTab = this.overlay.querySelector('.lab-tab-research') as HTMLElement;
    const designerTab = this.overlay.querySelector('.lab-tab-designer') as HTMLElement;

    if (tab === 'research') {
      researchTab.classList.remove('hidden');
      designerTab.classList.add('hidden');
      this.renderTechTree();
    } else {
      researchTab.classList.add('hidden');
      designerTab.classList.remove('hidden');
      this.showListPhase();
    }
  }

  // ============================================================================
  // RESEARCH TAB
  // ============================================================================

  private renderTechTree(): void {
    const scienceEl = this.overlay.querySelector('.science-amount') as HTMLElement;
    scienceEl.textContent = String(this.science);

    const container = this.overlay.querySelector('.tech-tree-nodes') as HTMLElement;
    const svgEl = this.overlay.querySelector('.tech-tree-lines') as SVGElement;

    // Clear only the node elements, preserve the SVG
    const existingNodes = container.querySelectorAll('.tech-node');
    existingNodes.forEach(node => node.remove());

    const nodes = getTechTreeState(this.team, this.science);
    const layout = computeTechLayout();

    // Constants for vertical layout
    const nodeWidth = 105;
    const nodeHeight = 50;
    const nodeGapX = 12;
    const tierGapY = 70;
    const paddingX = 20;
    const paddingY = 10;

    // Group layout by tier to find tier sizes
    const tierGroups: Record<number, typeof layout> = {};
    let maxTier = 0;
    for (const pos of layout) {
      if (!tierGroups[pos.tier]) tierGroups[pos.tier] = [];
      tierGroups[pos.tier]!.push(pos);
      maxTier = Math.max(maxTier, pos.tier);
    }

    // Find max tier width for centering
    let maxTierNodes = 0;
    for (const positions of Object.values(tierGroups)) {
      maxTierNodes = Math.max(maxTierNodes, positions.length);
    }
    const containerWidth = maxTierNodes * nodeWidth + (maxTierNodes - 1) * nodeGapX + paddingX * 2;

    // Build position map (vertical layout: tier = y, column = x, centered per tier)
    const positionMap: Record<string, { x: number; y: number }> = {};

    for (const [tierStr, positions] of Object.entries(tierGroups)) {
      const tier = parseInt(tierStr);
      const tierWidth = positions.length * nodeWidth + (positions.length - 1) * nodeGapX;
      const tierOffsetX = (containerWidth - tierWidth) / 2;

      // Sort by column within tier
      positions.sort((a, b) => a.column - b.column);

      for (let i = 0; i < positions.length; i++) {
        const x = tierOffsetX + i * (nodeWidth + nodeGapX);
        const y = paddingY + tier * (nodeHeight + tierGapY);
        positionMap[positions[i]!.techId] = { x, y };
      }
    }

    // Set container size (width enables margin: 0 auto centering)
    const containerHeight = paddingY * 2 + (maxTier + 1) * nodeHeight + maxTier * tierGapY;
    container.style.height = `${containerHeight}px`;
    container.style.width = `${containerWidth}px`;

    // Draw dependency lines (vertical: from bottom of parent to top of child)
    let svgContent = '';
    for (const node of nodes) {
      const tech = node.tech;
      const childPos = positionMap[tech.id]!;
      for (const prereq of tech.requires) {
        const parentPos = positionMap[prereq]!;
        // Line from bottom-center of parent to top-center of child
        const x1 = parentPos.x + nodeWidth / 2;
        const y1 = parentPos.y + nodeHeight;
        const x2 = childPos.x + nodeWidth / 2;
        const y2 = childPos.y;
        const midY = (y1 + y2) / 2;
        const lineClass = node.state === 'unlocked' ? 'line-unlocked' : 'line-locked';
        svgContent += `<path class="tech-line ${lineClass}" data-from="${prereq}" data-to="${tech.id}" d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}" />`;
      }
    }
    svgEl.innerHTML = svgContent;
    svgEl.style.width = `${containerWidth}px`;
    svgEl.style.height = `${containerHeight}px`;

    // Draw nodes
    for (const node of nodes) {
      const pos = positionMap[node.tech.id]!;
      const nodeEl = document.createElement('div');
      nodeEl.className = `tech-node tech-${node.state}`;
      nodeEl.dataset.techId = node.tech.id;
      nodeEl.style.left = `${pos.x}px`;
      nodeEl.style.top = `${pos.y}px`;
      nodeEl.style.width = `${nodeWidth}px`;
      nodeEl.style.height = `${nodeHeight}px`;

      const costText = node.state === 'unlocked' ? '✓' : `${node.tech.cost} 🔬`;

      nodeEl.innerHTML = `
        <div class="tech-name">${node.tech.name}</div>
        <div class="tech-cost">${costText}</div>
      `;

      // Click handler for available techs (only when not read-only)
      if (node.state === 'available' && !this.readOnly) {
        nodeEl.addEventListener('click', () => this.handleTechClick(node.tech.id));
      }

      // Hover tooltips
      nodeEl.addEventListener('mouseenter', () => this.showTechTooltip(node));
      nodeEl.addEventListener('mouseleave', () => this.hideTechTooltip());

      container.appendChild(nodeEl);
    }
  }

  private handleTechClick(techId: string): void {
    if (!this.resources) return;

    const result = purchaseTech(this.team, techId, this.resources);
    if (result.success) {
      // Update local science value
      this.science = this.resources.getResources(this.team).science;
      // Re-render the tree
      this.renderTechTree();
      // Notify callback
      this.callbacks?.onPurchaseTech?.(techId);
    } else {
      console.log('Failed to purchase tech:', result.error);
    }
  }

  private getAllDependencies(techId: string): Set<string> {
    const deps = new Set<string>();
    const tech = getTech(techId);
    for (const prereq of tech.requires) {
      deps.add(prereq);
      for (const subDep of this.getAllDependencies(prereq)) {
        deps.add(subDep);
      }
    }
    return deps;
  }

  private showTechTooltip(node: TechNode): void {
    const tooltip = this.overlay.querySelector('.tech-tooltip') as HTMLElement;
    let text = `${node.tech.name}: ${node.tech.description}`;
    text += ` | Unlocks: ${node.tech.unlocks}`;
    if (node.state === 'locked' && node.reason) {
      text += ` | ${node.reason}`;
    }
    tooltip.textContent = text;
    tooltip.classList.add('visible');

    // Highlight dependency tree
    const deps = this.getAllDependencies(node.tech.id);
    const container = this.overlay.querySelector('.tech-tree-nodes') as HTMLElement;
    const svgEl = this.overlay.querySelector('.tech-tree-lines') as SVGElement;

    // Highlight dependency nodes
    for (const nodeEl of container.querySelectorAll('.tech-node')) {
      const techId = (nodeEl as HTMLElement).dataset.techId;
      if (techId && deps.has(techId)) {
        nodeEl.classList.add('tech-dependency');
      }
    }

    // Highlight lines where both ends are in the dependency chain (including hovered tech)
    const allRelevant = new Set(deps);
    allRelevant.add(node.tech.id);
    for (const line of svgEl.querySelectorAll('.tech-line')) {
      const from = (line as SVGElement).dataset.from;
      const to = (line as SVGElement).dataset.to;
      if (from && to && allRelevant.has(from) && allRelevant.has(to)) {
        line.classList.add('line-dependency');
      }
    }
  }

  private hideTechTooltip(): void {
    const tooltip = this.overlay.querySelector('.tech-tooltip') as HTMLElement;
    tooltip.classList.remove('visible');
    tooltip.textContent = '';

    // Clear dependency highlights
    const container = this.overlay.querySelector('.tech-tree-nodes') as HTMLElement;
    const svgEl = this.overlay.querySelector('.tech-tree-lines') as SVGElement;

    for (const nodeEl of container.querySelectorAll('.tech-dependency')) {
      nodeEl.classList.remove('tech-dependency');
    }
    for (const line of svgEl.querySelectorAll('.line-dependency')) {
      line.classList.remove('line-dependency');
    }
  }

  // ============================================================================
  // UNIT DESIGNER TAB
  // ============================================================================

  private showListPhase(): void {
    this.overlay.querySelector('.lab-phase-list')!.classList.remove('hidden');
    this.overlay.querySelector('.lab-phase-design')!.classList.add('hidden');
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
    } else {
      this.editingId = undefined;
      this.design = { chassisId: 'foot', weaponId: null, systemIds: [] };
      (this.overlay.querySelector('#lab-name') as HTMLInputElement).value = '';
    }

    this.renderOptions();
    this.updateStats();
    this.validateName();
  }

  private renderTemplateList(): void {
    const container = this.overlay.querySelector('.lab-templates')!;
    container.innerHTML = '';

    for (const template of this.templates) {
      const el = document.createElement(this.readOnly ? 'div' : 'button');
      el.className = 'lab-template-btn' + (this.readOnly ? ' view-only' : '');
      el.innerHTML = `
        <span class="template-name">${template.name}</span>
        <span class="template-stats">Spd:${template.speed} Atk:${template.attack} Rng:${template.range}</span>
        <span class="template-cost">$${template.cost}</span>
      `;
      if (!this.readOnly) {
        el.addEventListener('click', () => this.showDesignPhase(template));
      }
      container.appendChild(el);
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
    label.addEventListener('mouseenter', () => this.showDesignerTooltip(group, value, available, reason));
    label.addEventListener('mouseleave', () => this.hideDesignerTooltip());

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

  private showDesignerTooltip(group: string, id: string, available: boolean, reason?: string): void {
    const tooltip = this.overlay.querySelector('.lab-tab-designer .lab-tooltip') as HTMLElement;

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
    if (!available && reason) text += ` | ${reason}`;

    tooltip.textContent = text;
    tooltip.classList.toggle('unavailable', !available);
  }

  private hideDesignerTooltip(): void {
    const tooltip = this.overlay.querySelector('.lab-tab-designer .lab-tooltip') as HTMLElement;
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
    if (preview.canCapture) abilities.push('Capture');
    if (preview.canBuild) abilities.push('Build');
    if (preview.armored) abilities.push('Armored');
    if (preview.armorPiercing) abilities.push('AP');

    const abilitiesText = abilities.length ? abilities.join(' ') : '-';
    const errorText = (!preview.valid && preview.error) ? `${preview.error}` : '';

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
