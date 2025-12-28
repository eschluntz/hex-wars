// ============================================================================
// HEX DOMINION - Lab UI Renderer
// ============================================================================
// Handles all rendering for the unit designer lab interface.

import { type UnitTemplate, isNameTaken } from './unit-templates.js';
import {
  type DesignState,
  getDesignPreview,
  getAvailableWeapons,
  getAvailableSystems,
  getResearchedChassis,
  getChassisDetails,
  getWeaponDetails,
  getSystemDetails,
} from './unit-designer.js';
import { type ChassisComponent } from './components.js';
import { type Building } from './building.js';

// ============================================================================
// Types
// ============================================================================

export type LabPhase = 'list' | 'designing';

export interface LabMenu {
  lab: Building;
  phase: LabPhase;
  design: DesignState;
  templates: UnitTemplate[];
  editingId?: string;
  nameInput: string;
  nameError: string | null;
  hoveredComponent: { type: 'chassis' | 'weapon' | 'system'; id: string; unavailableReason?: string } | null;
}

interface MenuButton {
  label: string;
  action: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Lab UI Renderer
// ============================================================================

export class LabUI {
  private ctx: CanvasRenderingContext2D;
  private canvasWidth: number;
  private canvasHeight: number;
  private menuButtons: MenuButton[] = [];
  private menuHighlightIndex: number = 0;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private currentTeam: string = '';

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.canvasWidth = ctx.canvas.width;
    this.canvasHeight = ctx.canvas.height;
  }

  // Update state before rendering
  update(
    canvasWidth: number,
    canvasHeight: number,
    mouseX: number,
    mouseY: number,
    menuHighlightIndex: number,
    currentTeam: string
  ): void {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;
    this.menuHighlightIndex = menuHighlightIndex;
    this.currentTeam = currentTeam;
  }

  // Get the menu buttons after rendering
  getMenuButtons(): MenuButton[] {
    return this.menuButtons;
  }

  // Main render entry point
  render(menu: LabMenu): void {
    if (menu.phase === 'list') {
      this.drawLabListPhase(menu);
    } else if (menu.phase === 'designing') {
      this.drawLabDesignPhase(menu);
    }
  }

  private drawLabListPhase(menu: LabMenu): void {
    const ctx = this.ctx;

    const buttonWidth = 200;
    const buttonHeight = 32;
    const padding = 10;
    const titleHeight = 30;

    const menuWidth = buttonWidth + padding * 2;
    const menuHeight = titleHeight + (menu.templates.length + 2) * (buttonHeight + padding) + padding;

    const menuX = (this.canvasWidth - menuWidth) / 2;
    const menuY = (this.canvasHeight - menuHeight) / 2;

    this.menuButtons = [];

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.strokeStyle = 'rgba(100, 149, 237, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#6495ED';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('UNIT DESIGNER', menuX + menuWidth / 2, menuY + padding + titleHeight / 2);

    let btnIndex = 0;

    // Template buttons with edit/delete
    for (let i = 0; i < menu.templates.length; i++) {
      const template = menu.templates[i]!;
      const btnY = menuY + padding + titleHeight + i * (buttonHeight + padding);
      const btnX = menuX + padding;

      const isMouseHovered = this.isPointInRect(
        this.lastMouseX, this.lastMouseY,
        btnX, btnY, buttonWidth, buttonHeight
      );
      const isKeyboardHighlighted = this.menuHighlightIndex === btnIndex;
      const isHighlighted = isMouseHovered || isKeyboardHighlighted;

      // Button background
      ctx.fillStyle = isHighlighted ? 'rgba(100, 149, 237, 0.3)' : 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, buttonWidth, buttonHeight, 4);
      ctx.fill();

      if (isKeyboardHighlighted) {
        ctx.strokeStyle = '#6495ED';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Template name and cost
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.name, btnX + 10, btnY + buttonHeight / 2);

      ctx.fillStyle = '#4caf50';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${template.cost}`, btnX + buttonWidth - 10, btnY + buttonHeight / 2);

      this.menuButtons.push({
        label: template.name,
        action: `edit_${template.id}`,
        x: btnX,
        y: btnY,
        width: buttonWidth,
        height: buttonHeight
      });

      btnIndex++;
    }

    // New Design button
    const newY = menuY + padding + titleHeight + menu.templates.length * (buttonHeight + padding);
    const newX = menuX + padding;

    const isNewHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, newX, newY, buttonWidth, buttonHeight);
    const isNewHighlighted = this.menuHighlightIndex === btnIndex;

    ctx.fillStyle = (isNewHovered || isNewHighlighted) ? 'rgba(76, 175, 80, 0.4)' : 'rgba(76, 175, 80, 0.2)';
    ctx.beginPath();
    ctx.roundRect(newX, newY, buttonWidth, buttonHeight, 4);
    ctx.fill();

    if (isNewHighlighted) {
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('+ Create New Design', newX + buttonWidth / 2, newY + buttonHeight / 2);

    this.menuButtons.push({
      label: 'New',
      action: 'new',
      x: newX,
      y: newY,
      width: buttonWidth,
      height: buttonHeight
    });

    btnIndex++;

    // Cancel button
    const cancelY = newY + buttonHeight + padding;
    const cancelX = menuX + padding;

    const isCancelHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, cancelX, cancelY, buttonWidth, buttonHeight);
    const isCancelHighlighted = this.menuHighlightIndex === btnIndex;

    ctx.fillStyle = (isCancelHovered || isCancelHighlighted) ? 'rgba(244, 67, 54, 0.3)' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(cancelX, cancelY, buttonWidth, buttonHeight, 4);
    ctx.fill();

    if (isCancelHighlighted) {
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = '#ff8888';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Close', cancelX + buttonWidth / 2, cancelY + buttonHeight / 2);

    this.menuButtons.push({
      label: 'Cancel',
      action: 'cancel',
      x: cancelX,
      y: cancelY,
      width: buttonWidth,
      height: buttonHeight
    });
  }

  private drawLabDesignPhase(menu: LabMenu): void {
    const ctx = this.ctx;

    const columnWidth = 140;
    const previewWidth = 160;
    const rowHeight = 28;
    const padding = 12;
    const titleHeight = 30;
    const sectionTitleHeight = 24;

    const chassisList = getResearchedChassis(this.currentTeam);
    const weaponAvail = getAvailableWeapons(menu.design.chassisId, menu.design.systemIds, this.currentTeam);
    const systemAvail = getAvailableSystems(menu.design.chassisId, menu.design.systemIds, menu.design.weaponId, this.currentTeam);

    const maxRows = Math.max(chassisList.length, weaponAvail.length + 1, systemAvail.length + 1);
    const contentHeight = sectionTitleHeight + maxRows * rowHeight;

    const tooltipHeight = 50;
    const previewHeight = 80;
    const nameInputHeight = 50;
    const saveButtonHeight = 40;

    const menuWidth = columnWidth * 3 + previewWidth + padding * 5;
    const menuHeight = titleHeight + padding * 2 + contentHeight + tooltipHeight + previewHeight + nameInputHeight + saveButtonHeight + padding * 5;

    const menuX = (this.canvasWidth - menuWidth) / 2;
    const menuY = (this.canvasHeight - menuHeight) / 2;

    this.menuButtons = [];

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.strokeStyle = 'rgba(100, 149, 237, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#6495ED';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleText = menu.editingId ? 'EDIT DESIGN' : 'NEW DESIGN';
    ctx.fillText(titleText, menuX + menuWidth / 2, menuY + padding + titleHeight / 2);

    // Close button
    const closeX = menuX + menuWidth - 30;
    const closeY = menuY + 8;
    const isCloseHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, closeX, closeY, 22, 22);

    ctx.fillStyle = isCloseHovered ? 'rgba(244, 67, 54, 0.5)' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(closeX, closeY, 22, 22, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('X', closeX + 11, closeY + 12);

    this.menuButtons.push({
      label: 'Close',
      action: 'cancel',
      x: closeX,
      y: closeY,
      width: 22,
      height: 22
    });

    const contentY = menuY + titleHeight + padding * 2;

    // Draw columns
    this.drawChassisColumn(ctx, menuX + padding, contentY, columnWidth, chassisList, menu.design.chassisId, menu);
    this.drawWeaponColumn(ctx, menuX + padding + columnWidth + padding, contentY, columnWidth, weaponAvail, menu.design.weaponId, menu);
    this.drawSystemColumn(ctx, menuX + padding + (columnWidth + padding) * 2, contentY, columnWidth, systemAvail, menu.design.systemIds, menu);

    // Preview panel (right side)
    const previewX = menuX + padding + (columnWidth + padding) * 3;
    const previewY = contentY;
    this.drawDesignPreviewPanel(ctx, previewX, previewY, previewWidth, contentHeight, menu.design);

    // Tooltip area
    const tooltipY = contentY + contentHeight + padding;
    this.drawTooltipArea(ctx, menuX + padding, tooltipY, menuWidth - padding * 2, tooltipHeight, menu.hoveredComponent);

    // Stats preview bar
    const statsY = tooltipY + tooltipHeight + padding;
    this.drawStatsPreview(ctx, menuX + padding, statsY, menuWidth - padding * 2, previewHeight, menu.design);

    // Name input row
    const nameY = statsY + previewHeight + padding;
    this.drawNameInput(ctx, menuX + padding, nameY, menuWidth - padding * 2, nameInputHeight, menu);

    // Save button
    const saveY = nameY + nameInputHeight + padding;
    const preview = getDesignPreview(menu.design);
    const nameTrimmed2 = menu.nameInput.trim();
    const isDuplicate2 = nameTrimmed2.length > 0 && this.currentTeam && isNameTaken(this.currentTeam, nameTrimmed2, menu.editingId);
    const canSave = (preview?.valid ?? false) && nameTrimmed2.length > 0 && !isDuplicate2;
    this.drawSaveButton(ctx, menuX + padding, saveY, menuWidth - padding * 2, saveButtonHeight - padding, canSave);
  }

  private drawNameInput(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    menu: LabMenu
  ): void {
    const nameTrimmed = menu.nameInput.trim();
    const isDuplicate = nameTrimmed.length > 0 && this.currentTeam && isNameTaken(this.currentTeam, nameTrimmed, menu.editingId);
    const hasError = menu.nameError !== null || isDuplicate;

    // Label
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('NAME:', x, y + 10);

    // Input field
    const inputX = x + 50;
    const inputWidth = width - 50;
    const inputHeight = 28;
    const inputY = y + height / 2 - inputHeight / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(inputX, inputY, inputWidth, inputHeight, 4);
    ctx.fill();

    ctx.strokeStyle = hasError ? '#f44336' : '#6495ED';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Input text with cursor
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayText = menu.nameInput + (Date.now() % 1000 < 500 ? '|' : '');
    ctx.fillText(displayText, inputX + 10, inputY + inputHeight / 2);

    // Error message
    const errorMsg = isDuplicate ? 'Name already exists' : menu.nameError;
    if (errorMsg) {
      ctx.fillStyle = '#f44336';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(errorMsg, x + width, y + 10);
    }
  }

  private drawSaveButton(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    canSave: boolean
  ): void {
    const isHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, y, width, height);

    if (!canSave) {
      ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
    } else {
      ctx.fillStyle = isHovered ? 'rgba(76, 175, 80, 0.5)' : 'rgba(76, 175, 80, 0.3)';
    }
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    ctx.fillStyle = canSave ? '#ffffff' : '#666666';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SAVE DESIGN', x + width / 2, y + height / 2);

    if (canSave) {
      this.menuButtons.push({
        label: 'Save',
        action: 'confirm_name',
        x, y, width, height
      });
    }
  }

  private drawChassisColumn(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number,
    chassisList: ChassisComponent[],
    selectedId: string | null,
    menu: LabMenu
  ): void {
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHASSIS', x, y + 12);

    const rowHeight = 28;
    let offsetY = y + 24;

    for (const chassis of chassisList) {
      const isSelected = chassis.id === selectedId;
      const isHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

      ctx.fillStyle = isSelected ? 'rgba(100, 149, 237, 0.4)' : isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
      ctx.fill();

      // Radio button
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? '#6495ED' : '#666666';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#6495ED';
        ctx.fill();
      }

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(chassis.name, x + 26, offsetY + rowHeight / 2 - 1);

      // Cost
      ctx.fillStyle = '#888888';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${chassis.baseCost}`, x + width - 6, offsetY + rowHeight / 2 - 1);

      this.menuButtons.push({
        label: chassis.name,
        action: `chassis_${chassis.id}`,
        x, y: offsetY, width, height: rowHeight
      });

      // Track hover for tooltip
      if (isHovered) {
        menu.hoveredComponent = { type: 'chassis', id: chassis.id };
      }

      offsetY += rowHeight;
    }
  }

  private drawWeaponColumn(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number,
    weaponAvail: ReturnType<typeof getAvailableWeapons>,
    selectedId: string | null,
    menu: LabMenu
  ): void {
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('WEAPON', x, y + 12);

    const rowHeight = 28;
    let offsetY = y + 24;

    // None option
    const noneSelected = selectedId === null;
    const noneHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

    ctx.fillStyle = noneSelected ? 'rgba(100, 149, 237, 0.4)' : noneHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
    ctx.strokeStyle = noneSelected ? '#6495ED' : '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (noneSelected) {
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#6495ED';
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('None', x + 26, offsetY + rowHeight / 2 - 1);

    this.menuButtons.push({
      label: 'None',
      action: 'weapon_none',
      x, y: offsetY, width, height: rowHeight
    });

    offsetY += rowHeight;

    for (const { weapon, available, reason } of weaponAvail) {
      const isSelected = weapon.id === selectedId;
      const isHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

      if (!available) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
      } else {
        ctx.fillStyle = isSelected ? 'rgba(100, 149, 237, 0.4)' : isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      }
      ctx.beginPath();
      ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
      ctx.fill();

      // Radio button
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
      ctx.strokeStyle = !available ? '#444444' : isSelected ? '#6495ED' : '#666666';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#6495ED';
        ctx.fill();
      }

      // Name
      ctx.fillStyle = available ? '#ffffff' : '#555555';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(weapon.name, x + 26, offsetY + rowHeight / 2 - 1);

      // Cost
      ctx.fillStyle = available ? '#888888' : '#444444';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${weapon.cost}`, x + width - 6, offsetY + rowHeight / 2 - 1);

      if (available) {
        this.menuButtons.push({
          label: weapon.name,
          action: `weapon_${weapon.id}`,
          x, y: offsetY, width, height: rowHeight
        });
      }

      // Track hover for tooltip
      if (isHovered) {
        menu.hoveredComponent = { type: 'weapon', id: weapon.id, unavailableReason: available ? undefined : reason };
      }

      offsetY += rowHeight;
    }
  }

  private drawSystemColumn(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number,
    systemAvail: ReturnType<typeof getAvailableSystems>,
    selectedIds: string[],
    menu: LabMenu
  ): void {
    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SYSTEMS', x, y + 12);

    const rowHeight = 28;
    let offsetY = y + 24;

    // "None" option
    const noneSelected = selectedIds.length === 0;
    const noneHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

    ctx.fillStyle = noneSelected ? 'rgba(100, 149, 237, 0.4)' : noneHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
    ctx.strokeStyle = noneSelected ? '#6495ED' : '#666666';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (noneSelected) {
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#6495ED';
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('None', x + 26, offsetY + rowHeight / 2 - 1);

    this.menuButtons.push({
      label: 'None',
      action: 'system_none',
      x, y: offsetY, width, height: rowHeight
    });

    offsetY += rowHeight;

    for (const { system, available, reason } of systemAvail) {
      const isSelected = selectedIds.includes(system.id);
      const isHovered = this.isPointInRect(this.lastMouseX, this.lastMouseY, x, offsetY, width, rowHeight);

      if (!available && !isSelected) {
        ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
      } else {
        ctx.fillStyle = isSelected ? 'rgba(100, 149, 237, 0.4)' : isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      }
      ctx.beginPath();
      ctx.roundRect(x, offsetY, width, rowHeight - 2, 4);
      ctx.fill();

      // Radio button
      ctx.beginPath();
      ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 6, 0, Math.PI * 2);
      ctx.strokeStyle = (!available && !isSelected) ? '#444444' : isSelected ? '#6495ED' : '#666666';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x + 14, offsetY + rowHeight / 2 - 1, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#6495ED';
        ctx.fill();
      }

      // Name
      ctx.fillStyle = (available || isSelected) ? '#ffffff' : '#555555';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(system.name, x + 26, offsetY + rowHeight / 2 - 1);

      // Cost
      ctx.fillStyle = (available || isSelected) ? '#888888' : '#444444';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${system.cost}`, x + width - 6, offsetY + rowHeight / 2 - 1);

      if (available || isSelected) {
        this.menuButtons.push({
          label: system.name,
          action: `system_${system.id}`,
          x, y: offsetY, width, height: rowHeight
        });
      }

      // Track hover for tooltip
      if (isHovered) {
        const unavailableReason = (!available && !isSelected) ? reason : undefined;
        menu.hoveredComponent = { type: 'system', id: system.id, unavailableReason };
      }

      offsetY += rowHeight;
    }
  }

  private drawDesignPreviewPanel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    design: DesignState
  ): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PREVIEW', x + width / 2, y + 12);

    // Placeholder for unit visual
    ctx.fillStyle = 'rgba(100, 149, 237, 0.2)';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(100, 149, 237, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Show chassis type indicator
    if (design.chassisId) {
      ctx.fillStyle = '#6495ED';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = design.chassisId === 'foot' ? '🚶' : design.chassisId === 'wheels' ? '🚗' : '🛡️';
      ctx.fillText(icon, x + width / 2, y + height / 2);
    } else {
      ctx.fillStyle = '#666666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select chassis', x + width / 2, y + height / 2);
    }
  }

  private drawTooltipArea(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    hoveredComponent: { type: 'chassis' | 'weapon' | 'system'; id: string; unavailableReason?: string } | null
  ): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    if (!hoveredComponent) {
      ctx.fillStyle = '#555555';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Hover over a component for details', x + width / 2, y + height / 2);
      return;
    }

    let details;
    if (hoveredComponent.type === 'chassis') {
      details = getChassisDetails(hoveredComponent.id);
    } else if (hoveredComponent.type === 'weapon') {
      details = getWeaponDetails(hoveredComponent.id);
    } else {
      details = getSystemDetails(hoveredComponent.id);
    }

    // Name
    ctx.fillStyle = hoveredComponent.unavailableReason ? '#888888' : '#ffffff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(details.name, x + 10, y + 8);

    // Cost or unavailable indicator
    if (hoveredComponent.unavailableReason) {
      ctx.fillStyle = '#f44336';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText('UNAVAILABLE', x + width - 10, y + 8);
    } else {
      ctx.fillStyle = '#4caf50';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`$${details.cost}`, x + width - 10, y + 8);
    }

    // Stats
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(details.stats.join(' | '), x + 10, y + 26);

    // Unavailable reason (replaces abilities line when unavailable)
    if (hoveredComponent.unavailableReason) {
      ctx.fillStyle = '#ff9800';
      ctx.fillText(hoveredComponent.unavailableReason, x + 10, y + 40);
    } else if (details.abilities || details.requirements) {
      let line = '';
      if (details.abilities) line += details.abilities.join(', ');
      if (details.requirements) {
        if (line) line += ' | ';
        line += details.requirements;
      }
      ctx.fillStyle = '#ffb74d';
      ctx.fillText(line, x + 10, y + 40);
    }
  }

  private drawStatsPreview(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    design: DesignState
  ): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();

    const preview = getDesignPreview(design);

    if (!preview) {
      ctx.fillStyle = '#555555';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select components to see stats', x + width / 2, y + height / 2);
      return;
    }

    const padding = 15;
    const statWidth = (width - padding * 2) / 5;

    // Stats row
    const stats = [
      { label: 'COST', value: `$${preview.cost}`, color: '#4caf50' },
      { label: 'SPEED', value: `${preview.speed}`, color: '#2196f3' },
      { label: 'ATTACK', value: `${preview.attack}`, color: '#f44336' },
      { label: 'RANGE', value: `${preview.range}`, color: '#ff9800' },
      { label: 'WEIGHT', value: `${preview.totalWeight}/${preview.maxWeight}`, color: preview.totalWeight > preview.maxWeight ? '#f44336' : '#9e9e9e' },
    ];

    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i]!;
      const sx = x + padding + i * statWidth;

      ctx.fillStyle = '#666666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(stat.label, sx + statWidth / 2, y + 10);

      ctx.fillStyle = stat.color;
      ctx.font = 'bold 18px Arial';
      ctx.fillText(stat.value, sx + statWidth / 2, y + 26);
    }

    // Abilities row
    const abilities: string[] = [];
    if (preview.canCapture) abilities.push('📍 Capture');
    if (preview.canBuild) abilities.push('🔧 Build');
    if (preview.armored) abilities.push('🛡️ Armored');
    if (preview.armorPiercing) abilities.push('💥 AP');

    if (abilities.length > 0) {
      ctx.fillStyle = '#ffb74d';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(abilities.join('   '), x + width / 2, y + 58);
    }

    // Validation error
    if (!preview.valid && preview.error) {
      ctx.fillStyle = '#f44336';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`⚠️ ${preview.error}`, x + width / 2, y + 58);
    }
  }

  private isPointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }
}
