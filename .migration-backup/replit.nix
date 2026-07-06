# Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
  ];
}
