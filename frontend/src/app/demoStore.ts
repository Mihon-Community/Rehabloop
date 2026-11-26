import { createContext, useContext } from 'react';
import type { Role } from '../types';

export interface DemoState {
  /** Display-only selection. The backend verifies role and assignment; UI never authorises. */
  role: Role;
  setRole: (role: Role) => void;
  consentGiven: boolean;
  setConsentGiven: (value: boolean) => void;
  cameraMode: 'review' | 'camera';
  setCameraMode: (mode: 'review' | 'camera') => void;
  selectedProtocolId: string;
  setSelectedProtocolId: (id: string) => void;
  sessionId: string;
  setSessionId: (id: string) => void;
}

export const DemoContext = createContext<DemoState | null>(null);

export function useDemo(): DemoState {
  const value = useContext(DemoContext);
  if (!value) throw new Error('useDemo must be used inside <DemoProvider>');
  return value;
}
