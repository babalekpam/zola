// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT

/**
 * True on a real deployment. Replit Autoscale sets REPLIT_DEPLOYMENT; other
 * hosts set NODE_ENV=production. Local dev and preview sandboxes are neither,
 * and several security controls (fail-closed quota, HSTS, secure cookies,
 * strict CORS) key off this so dev stays convenient and prod stays safe.
 */
export function isDeployed(): boolean {
  return process.env.NODE_ENV === "production" || !!process.env.REPLIT_DEPLOYMENT;
}
