import { useState, type ReactNode } from 'react';
import { DemoContext } from './demoStore';

/** In-memory demo session state. Role is cosmetic; no credentials are stored. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<'patient' | 'clinician'>('patient');
  const [consentGiven, setConsentGiven] = useState(false);
  const [cameraMode, setCameraMode] = useState<'review' | 'camera'>('review');
  const [selectedProtocolId, setSelectedProtocolId] = useState('protocol-demo-1');
  const [sessionId, setSessionId] = useState('session-demo-1');

  return (
    <DemoContext.Provider
      value={{
        role,
        setRole,
        consentGiven,
        setConsentGiven,
        cameraMode,
        setCameraMode,
        selectedProtocolId,
        setSelectedProtocolId,
        sessionId,
        setSessionId,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
