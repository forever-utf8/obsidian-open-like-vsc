"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => OpenLikeVSC
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var PREVIEW_ATTR = "data-vsc-preview";
var TAB_HANDLER_ATTR = "data-vsc-handler";
var OpenLikeVSC = class extends import_obsidian.Plugin {
  /** The current "preview" leaf — can be replaced by the next single-click. */
  previewLeaf = null;
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onload() {
    this.registerDomEvent(document, "click", this.onDocumentClick, true);
    this.registerDomEvent(document, "dblclick", this.onDocumentDblClick, true);
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.syncTabHandlers())
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.cleanupPreviewLeaf())
    );
    this.syncTabHandlers();
  }
  onunload() {
    document.querySelectorAll(`[${PREVIEW_ATTR}]`).forEach((el) => {
      el.removeAttribute(PREVIEW_ATTR);
    });
  }
  // ── File-explorer event interception ──────────────────────────────────────
  /**
   * Single click: open immediately, no timer delay.
   * When part of a double-click the second click is effectively a no-op
   * (file is already open → just focuses), and the dblclick handler pins it.
   */
  onDocumentClick = (e) => {
    const file = this.fileFromEvent(e);
    if (!file) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    void this.handleSingleClick(file);
  };
  /**
   * Double click: the browser fires click→click→dblclick in sequence.
   * By the time dblclick fires the file is already open (from the first click),
   * so we only need to pin the existing leaf.
   */
  onDocumentDblClick = (e) => {
    const file = this.fileFromEvent(e);
    if (!file) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    void this.handleDoubleClick(file);
  };
  // ── Click handlers ─────────────────────────────────────────────────────────
  /**
   * Single-click: VS Code preview behaviour.
   * - If the file is already open somewhere, just focus that leaf.
   * - Otherwise open in the current preview leaf (replacing its content),
   *   or create a new tab and mark it as preview.
   */
  async handleSingleClick(file) {
    const { existing, previewAlive } = this.gatherLeafInfo(file);
    if (existing) {
      this.app.workspace.setActiveLeaf(existing, { focus: true });
      return;
    }
    if (this.previewLeaf && previewAlive) {
      await this.previewLeaf.openFile(file);
      this.applyPreviewStyle(this.previewLeaf, true);
    } else {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
      this.setAsPreview(leaf);
    }
  }
  /**
   * Double-click: pin whatever leaf already has the file open.
   * (The two preceding click events have already opened the file as preview.)
   */
  async handleDoubleClick(file) {
    const { existing, previewAlive } = this.gatherLeafInfo(file);
    if (existing) {
      if (this.previewLeaf === existing) this.clearPreview();
      this.app.workspace.setActiveLeaf(existing, { focus: true });
      return;
    }
    if (this.previewLeaf && previewAlive) {
      const leaf = this.previewLeaf;
      await leaf.openFile(file);
      this.clearPreview();
    } else {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
    }
  }
  // ── Tab double-click: convert preview → pinned ───────────────────────────
  syncTabHandlers() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const tabEl = this.tabHeaderEl(leaf);
      if (!tabEl || tabEl.getAttribute(TAB_HANDLER_ATTR)) return;
      tabEl.setAttribute(TAB_HANDLER_ATTR, "true");
      tabEl.addEventListener(
        "dblclick",
        (e) => {
          e.stopImmediatePropagation();
          e.preventDefault();
          if (this.previewLeaf === leaf) this.clearPreview();
        },
        true
        /* capture */
      );
    });
  }
  // ── Preview-state helpers ──────────────────────────────────────────────────
  setAsPreview(leaf) {
    if (this.previewLeaf && this.previewLeaf !== leaf) {
      this.applyPreviewStyle(this.previewLeaf, false);
    }
    this.previewLeaf = leaf;
    this.applyPreviewStyle(leaf, true);
  }
  clearPreview() {
    if (!this.previewLeaf) return;
    this.applyPreviewStyle(this.previewLeaf, false);
    this.previewLeaf = null;
  }
  applyPreviewStyle(leaf, preview) {
    const tabEl = this.tabHeaderEl(leaf);
    if (!tabEl) return;
    if (preview) {
      tabEl.setAttribute(PREVIEW_ATTR, "");
    } else {
      tabEl.removeAttribute(PREVIEW_ATTR);
    }
  }
  // ── Utilities ──────────────────────────────────────────────────────────────
  /**
   * Single pass over all leaves: finds an existing leaf for `file` AND checks
   * whether previewLeaf is still alive — avoids two separate iterations.
   */
  gatherLeafInfo(file) {
    let existing = null;
    let previewAlive = false;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof import_obsidian.FileView && leaf.view.file === file) {
        existing = leaf;
      }
      if (leaf === this.previewLeaf) previewAlive = true;
    });
    return { existing, previewAlive };
  }
  cleanupPreviewLeaf() {
    if (!this.previewLeaf) return;
    let alive = false;
    this.app.workspace.iterateAllLeaves((l) => {
      if (l === this.previewLeaf) alive = true;
    });
    if (!alive) this.previewLeaf = null;
  }
  fileFromEvent(e) {
    const titleEl = e.target.closest(".nav-file-title");
    if (!titleEl) return null;
    const path = titleEl.getAttribute("data-path");
    if (!path) return null;
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof import_obsidian.TFile ? file : null;
  }
  tabHeaderEl(leaf) {
    return leaf.tabHeaderEl ?? null;
  }
};
