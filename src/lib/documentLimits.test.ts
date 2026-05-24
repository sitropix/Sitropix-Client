import { describe, expect, it } from "vitest";
import {
  DOCUMENT_MAX_BYTES,
  SUPPORT_TICKET_MAX_ATTACHMENTS,
  filterFilesWithinLimits,
} from "@/lib/documentLimits";

describe("filterFilesWithinLimits", () => {
  it("rejects files over max bytes", () => {
    const big = new File([new Uint8Array(DOCUMENT_MAX_BYTES + 1)], "big.pdf", {
      type: "application/pdf",
    });
    const { accepted, rejected } = filterFilesWithinLimits([big], [], {
      maxCount: SUPPORT_TICKET_MAX_ATTACHMENTS,
    });
    expect(accepted).toHaveLength(0);
    expect(rejected[0]).toMatch(/big\.pdf/);
  });

  it("caps total count", () => {
    const files = Array.from({ length: 3 }, (_, i) =>
      new File(["x"], `f${i}.txt`, { type: "text/plain" }),
    );
    const existing = Array.from({ length: 4 }, (_, i) =>
      new File(["y"], `e${i}.txt`, { type: "text/plain" }),
    );
    const { accepted } = filterFilesWithinLimits(files, existing, {
      maxCount: SUPPORT_TICKET_MAX_ATTACHMENTS,
    });
    expect(accepted).toHaveLength(SUPPORT_TICKET_MAX_ATTACHMENTS);
  });
});
