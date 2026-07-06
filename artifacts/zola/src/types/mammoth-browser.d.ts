// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
declare module "mammoth/mammoth.browser" {
  interface ExtractResult {
    value: string;
    messages: unknown[];
  }
  interface Input {
    arrayBuffer: ArrayBuffer;
  }
  const mammoth: {
    extractRawText(input: Input): Promise<ExtractResult>;
  };
  export default mammoth;
}
