/** UNIVERSUM / modules/ui/selects.js — modulo estratto conservando la logica originale. */
(function () {
  'use strict';

  const UI = window.UniversumUI;


  UI.initSciFiSelects = function () {
    const cleanupBySelect = new WeakMap();
    let activeMenu = null;
    let activeWrap = null;

    function closeMenu() {
      if (activeMenu) activeMenu.classList.remove('open');
      if (activeWrap) activeWrap.classList.remove('open');
      activeMenu = null;
      activeWrap = null;
    }

    function enhanceSelect(sel) {
      if (!sel || sel.dataset.uniEnhanced === '1') return;
      // Il selettore nativo resta accessibile nella Panoramica stretta e scorrevole.
      if (sel.hasAttribute('data-choice') && window.matchMedia('(max-width: 640px)').matches) return;
      sel.dataset.uniEnhanced = '1';

      const wrap = document.createElement('div');
      wrap.className = 'uni-select-wrap';
      if (sel.style.width) wrap.style.width = sel.style.width;

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'uni-select-trigger';
      trigger.disabled = sel.disabled;

      const menu = document.createElement('div');
      menu.className = 'uni-select-menu';
      document.body.appendChild(menu);

      const syncFromSelect = () => {
        const chosen = sel.options[sel.selectedIndex];
        trigger.textContent = chosen ? chosen.textContent : '';
        trigger.disabled = sel.disabled;
        menu.innerHTML = '';

        Array.from(sel.options).forEach((opt, idx) => {
          const item = document.createElement('div');
          item.className = 'uni-select-option' +
            (idx === sel.selectedIndex ? ' selected' : '') +
            (opt.disabled ? ' disabled' : '');
          item.textContent = opt.textContent;
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (opt.disabled) return;
            sel.selectedIndex = idx;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            syncFromSelect();
            closeMenu();
          });
          menu.appendChild(item);
        });
      };

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sel.disabled) return;
        const wasOpen = menu.classList.contains('open');
        closeMenu();
        if (wasOpen) return;

        syncFromSelect();
        const rect = trigger.getBoundingClientRect();
        const maxMenuWidth = window.innerWidth - 16;
        const menuWidth = Math.min(maxMenuWidth, Math.max(rect.width, 180));
        menu.style.width = `${menuWidth}px`;
        menu.style.left = `${Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.left))}px`;

        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 220 && rect.top > 240) {
          menu.style.top = 'auto';
          menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
        } else {
          menu.style.bottom = 'auto';
          menu.style.top = `${rect.bottom + 6}px`;
        }

        menu.classList.add('open');
        wrap.classList.add('open');
        activeMenu = menu;
        activeWrap = wrap;
      });

      sel.style.display = 'none';
      sel.parentNode.insertBefore(wrap, sel.nextSibling);
      wrap.appendChild(trigger);
      syncFromSelect();

      const optObserver = new MutationObserver(syncFromSelect);
      optObserver.observe(sel, { childList: true, subtree: true, attributes: true });
      cleanupBySelect.set(sel, () => {
        optObserver.disconnect();
        if (activeMenu === menu) closeMenu();
        menu.remove();
        wrap.remove();
        delete sel.dataset.uniEnhanced;
        cleanupBySelect.delete(sel);
      });
    }

    const scanAll = () => {
      document.querySelectorAll('select').forEach(enhanceSelect);
    };

    document.addEventListener('click', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', (e) => {
      if (activeMenu && e.target !== activeMenu && !activeMenu.contains(e.target)) {
        closeMenu();
      }
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    function visitSelects(nodes, visit) {
      for (const node of nodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches('select')) visit(node);
        else node.querySelectorAll('select').forEach(visit);
      }
    }
    const domObserver = new MutationObserver(records => {
      for (const record of records) {
        visitSelects(record.removedNodes, sel => { if (!sel.isConnected) cleanupBySelect.get(sel)?.(); });
        visitSelects(record.addedNodes, sel => { if (sel.isConnected) enhanceSelect(sel); });
      }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
    scanAll();
  };


  document.addEventListener('DOMContentLoaded', () => {
    UI.initSciFiSelects();
  });
})();
