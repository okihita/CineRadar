import { create } from 'zustand';

interface TelemetryState {
    latency: number | null;
    payloadSize: number | null;
    elapsed: number;
    status: 'idle' | 'crunching' | 'completed' | 'error';
    
    setTelemetry: (data: { latency: number; payloadSize: number }) => void;
    setElapsed: (seconds: number) => void;
    setStatus: (status: TelemetryState['status']) => void;
    reset: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
    latency: null,
    payloadSize: null,
    elapsed: 0,
    status: 'idle',

    setTelemetry: (data) => set({ 
        latency: data.latency, 
        payloadSize: data.payloadSize, 
        status: 'completed' 
    }),
    setElapsed: (seconds) => set({ elapsed: seconds }),
    setStatus: (status) => set({ status }),
    reset: () => set({ latency: null, payloadSize: null, elapsed: 0, status: 'idle' }),
}));
