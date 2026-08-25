'use client';

import { useEffect } from 'react';
import { useTelemetryStore } from '../stores/useTelemetryStore';

interface TelemetryUpdaterProps {
    latency: number;
    payloadSize: number;
}

export function TelemetryUpdater({ latency, payloadSize }: TelemetryUpdaterProps) {
    const { setTelemetry } = useTelemetryStore();

    useEffect(() => {
        setTelemetry({ latency, payloadSize });
    }, [latency, payloadSize, setTelemetry]);

    return null; // Side-effect only component
}
