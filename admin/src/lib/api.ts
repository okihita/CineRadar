/**
 * Shared API utilities for data fetching.
 */

/**
 * Standard SWR fetcher — parses JSON from a URL.
 */
export const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Typed SWR fetcher — parses JSON and validates HTTP status.
 */
export function createFetcher<T>(onError?: (res: Response) => Error) {
    return (url: string): Promise<T> =>
        fetch(url).then((res) => {
            if (!res.ok) throw onError ? onError(res) : new Error(`Request failed: ${res.status}`);
            return res.json() as Promise<T>;
        });
}
