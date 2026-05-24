import { describe, expect, it } from "vitest";
import {
  addonFulfillmentCaption,
  addonFulfillmentStatusLabel,
  submitTicketUrlForAddon,
} from "./addonUtilizationDisplay";

describe("addonUtilizationDisplay", () => {
  it("labels fulfillment statuses for the dashboard", () => {
    expect(addonFulfillmentStatusLabel("not_used")).toBe("Not Used");
    expect(addonFulfillmentStatusLabel("in_progress")).toBe("In Progress");
    expect(addonFulfillmentStatusLabel("setup_completed")).toBe("Setup Completed");
  });

  it("builds submit-ticket deep links", () => {
    expect(submitTicketUrlForAddon("proj_1", "addon_db_id")).toBe(
      "/ticket?category=addon&projectId=proj_1&subscriptionAddonId=addon_db_id",
    );
  });

  it("describes not-used add-ons", () => {
    expect(
      addonFulfillmentCaption(
        {
          status: "not_used",
          tracksFulfillment: true,
          activeTicketId: null,
          activeTicketSubject: null,
        },
        "proj_1",
      ),
    ).toContain("open a support request");
  });
});
