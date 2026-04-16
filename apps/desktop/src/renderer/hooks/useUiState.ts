/** useUiState — persistent UI state hook using localStorage. */

import { useState, useCallback, useEffect } from 'react';

interface UiState {
  panelLayout: Record<string, boolean>; // panelId -> collapsed
  lastActiveProject: string | null;
  lastActiveEnvironment: string | null;
  leftRailSection: string;
  leftRailCollapsed: boolean;
}

const STORAGE_KEY = 'vibeflow-ui-state';

const DEFAULT_STATE: UiState = {
  panelLayout: {},
  lastActiveProject: null,
  lastActiveEnvironment: null,
  leftRailSection: 'missions',
  leftRailCollapsed: false,
};

function loadState(): UiState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_STATE };
}

function saveState(state: Partial<UiState>) {
  try {
    const existing = loadState();
    const merged = { ...existing, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage errors
  }
}

export function useUiState() {
  const [state, setState] = useState<UiState>(loadState);

  useEffect(() => {
    // Load on mount
    setState(loadState());
  }, []);

  const update = useCallback((partial: Partial<UiState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      saveState(partial);
      return next;
    });
  }, []);

  const setPanelCollapsed = useCallback(
    (panelId: string, collapsed: boolean) => {
      update({ panelLayout: { ...state.panelLayout, [panelId]: collapsed } });
    },
    [state.panelLayout, update]
  );

  const setLeftRailSection = useCallback(
    (section: string) => {
      update({ leftRailSection: section });
    },
    [update]
  );

  const setLeftRailCollapsed = useCallback(
    (collapsed: boolean) => {
      update({ leftRailCollapsed: collapsed });
    },
    [update]
  );

  const setLastActiveProject = useCallback(
    (projectId: string | null) => {
      update({ lastActiveProject: projectId });
    },
    [update]
  );

  const setLastActiveEnvironment = useCallback(
    (envId: string | null) => {
      update({ lastActiveEnvironment: envId });
    },
    [update]
  );

  return {
    state,
    update,
    setPanelCollapsed,
    setLeftRailSection,
    setLeftRailCollapsed,
    setLastActiveProject,
    setLastActiveEnvironment,
  };
}
