import { useEffect, useState } from 'react';

/**
 * Simple elapsed seconds timer for loading skeletons.
 * Starts at 0, increments every second, cleans up on unmount.
 */
export function useElapsedTimer(): number {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        let seconds = 0;
        const interval = setInterval(() => {
            seconds += 1;
            setElapsed(seconds);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return elapsed;
}
