"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { ReactNode } from "react";
import isEqual from "fast-deep-equal";

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig value={{ compare: isEqual }}>
        {children}
      </SWRConfig>
    </SessionProvider>
  );
}
