// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./use-auth";
import { useOrganizations, type Organization } from "./use-organizations";

const STORAGE_KEY = "loop_active_org";

interface ActiveOrgContextValue {
  organizations: Organization[];
  activeOrg: Organization | null;
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
  loading: boolean;
}

const ActiveOrgContext = createContext<ActiveOrgContextValue>({
  organizations: [],
  activeOrg: null,
  activeOrgId: null,
  setActiveOrgId: () => {},
  loading: true,
});

export function ActiveOrgProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: organizations, isLoading } = useOrganizations();
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const orgs = useMemo(() => organizations ?? [], [organizations]);

  // Keep the active workspace valid: default to the personal workspace (or the
  // first one) whenever the stored id is missing or no longer accessible.
  useEffect(() => {
    if (!user || orgs.length === 0) return;
    const valid = activeOrgId && orgs.some((o) => o.id === activeOrgId);
    if (!valid) {
      const fallback = orgs.find((o) => o.personal) ?? orgs[0];
      setActiveOrgIdState(fallback.id);
      localStorage.setItem(STORAGE_KEY, fallback.id);
    }
  }, [user, orgs, activeOrgId]);

  function setActiveOrgId(id: string) {
    setActiveOrgIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const activeOrg = useMemo(
    () => orgs.find((o) => o.id === activeOrgId) ?? null,
    [orgs, activeOrgId],
  );

  return (
    <ActiveOrgContext.Provider
      value={{
        organizations: orgs,
        activeOrg,
        activeOrgId: activeOrg?.id ?? null,
        setActiveOrgId,
        loading: isLoading,
      }}
    >
      {children}
    </ActiveOrgContext.Provider>
  );
}

export function useActiveOrg() {
  return useContext(ActiveOrgContext);
}
