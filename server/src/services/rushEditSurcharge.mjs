/** Rush edit surcharge — per-use add-on; raises edit-ticket queue priority, not an add-on ticket target. */
export const RUSH_EDIT_SURCHARGE_CODE = "addon_rush_edit_surcharge";

export function isRushEditSurchargeAddon(addonRow) {
  return addonRow?.code === RUSH_EDIT_SURCHARGE_CODE;
}

export function projectOwnsRushEditSurcharge(addonsJson) {
  const codes = Array.isArray(addonsJson)
    ? addonsJson.filter((c) => typeof c === "string" && c.trim())
    : [];
  return codes.includes(RUSH_EDIT_SURCHARGE_CODE);
}
