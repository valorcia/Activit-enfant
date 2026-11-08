"use client";
import { Select } from "@/components/ui/input";
import { groupByAudience, SITE_STATUS_LABELS, type Site } from "@/lib/universes/sites";
import { PRESETS } from "@/lib/universes/presets";

/** Liste déroulante des univers de la boutique, groupés par audience, avec leur statut. */
export function UniverseSelect({ sites, value, onChange, id, allowAuto, disabled }: { sites: Site[]; value: string | null | undefined; onChange: (slug: string | null) => void; id?: string; allowAuto?: boolean; disabled?: boolean }) {
  const groups = groupByAudience(sites);
  return (
    <Select id={id} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      {allowAuto && <option value="">Automatique (selon le brief)</option>}
      {groups.map((g) => (
        <optgroup key={g.audience} label={g.audience}>
          {g.sites.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name} — {PRESETS[s.preset].label}{s.status !== "ACTIVE" ? ` (${SITE_STATUS_LABELS[s.status]})` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
