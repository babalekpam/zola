// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useSyncExternalStore } from "react";
import { runtime, type RuntimeState } from "@/lib/webcontainer/runtime";

export function useRuntimeState(): RuntimeState {
  return useSyncExternalStore(
    (fn) => runtime.subscribe(fn),
    () => runtime.state,
  );
}
