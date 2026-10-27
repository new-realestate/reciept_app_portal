import { useEffect, useState } from "react";
import { propertiesApi } from "../../api/properties";
import { rentersApi } from "../../api/renters";
import { useAccess } from "../../auth/AccessContext";
import type { Property, Tenancy, Unit } from "../../lib/propertyTypes";
import type { Customer, PropertyContext } from "../../lib/types";
import { Field, Select } from "../ui/ui";

/**
 * Optional link from a document to a property, unit or tenancy. Left empty, the
 * document is a general business transaction. When the customer is a tenant, their
 * current tenancies are offered first; picking one fills in the property and unit.
 * Parents should clear the value when the customer changes.
 */
export function PropertyContextPicker({
  customer,
  value,
  onChange,
}: {
  customer: Customer | null;
  value: PropertyContext;
  onChange: (next: PropertyContext) => void;
}) {
  const { can } = useAccess();
  const [enabled, setEnabled] = useState(Boolean(value.property_id || value.tenancy_id));
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);

  useEffect(() => {
    if (!enabled) return;
    propertiesApi.list({ status: "active" }).then(setProperties).catch(() => setProperties([]));
  }, [enabled]);

  const renterId = customer?.renter_id;
  useEffect(() => {
    setTenancies([]);
    if (!enabled || !renterId || !can("renters.manage")) return;
    rentersApi
      .get(renterId)
      .then((r) => setTenancies(r.tenancies.filter((t) => t.status === "active" || t.status === "draft")))
      .catch(() => setTenancies([])); // tenancies on properties the member can't see are simply not offered
  }, [enabled, renterId, can]);

  const propertyId = value.property_id ?? "";
  useEffect(() => {
    setUnits([]);
    if (!propertyId) return;
    propertiesApi
      .get(propertyId)
      .then((p) => setUnits(p.units.filter((u) => u.status !== "archived")))
      .catch(() => setUnits([]));
  }, [propertyId]);

  function toggle(on: boolean) {
    setEnabled(on);
    if (!on) onChange({ property_id: null, unit_id: null, tenancy_id: null });
  }

  function chooseTenancy(tenancyId: string) {
    const t = tenancies.find((x) => x.id === tenancyId);
    onChange(t ? { tenancy_id: t.id, property_id: t.property_id, unit_id: t.unit_id } : { ...value, tenancy_id: null });
  }

  return (
    <div className="stack">
      <label className="checkbox-row">
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
        <span>
          Link to a property
          <small>Optional. Leave unticked for general business transactions.</small>
        </span>
      </label>

      {enabled && (
        <div className="form-grid">
          {tenancies.length > 0 && (
            <Field label="Tenancy" htmlFor="ctx_tenancy" className="form-grid-full" hint="Picking a tenancy fills in the property and unit.">
              <Select id="ctx_tenancy" value={value.tenancy_id ?? ""} onChange={(e) => chooseTenancy(e.target.value)}>
                <option value="">Not for a specific tenancy</option>
                {tenancies.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.reference} — {t.property_name}
                    {t.unit_label ? `, ${t.unit_label}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Property" htmlFor="ctx_property">
            <Select
              id="ctx_property"
              value={propertyId}
              disabled={Boolean(value.tenancy_id)}
              onChange={(e) => onChange({ property_id: e.target.value || null, unit_id: null, tenancy_id: null })}
            >
              <option value="">{properties.length ? "Choose a property…" : "No properties available to you"}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unit" htmlFor="ctx_unit">
            <Select
              id="ctx_unit"
              value={value.unit_id ?? ""}
              disabled={!propertyId || Boolean(value.tenancy_id) || units.length === 0}
              onChange={(e) => onChange({ ...value, unit_id: e.target.value || null })}
            >
              <option value="">{units.length ? "Whole property" : "No units"}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
}

/** Strips empty values so the API receives only ids that were actually chosen. */
export function contextPayload(ctx: PropertyContext): PropertyContext {
  return {
    property_id: ctx.property_id || undefined,
    unit_id: ctx.unit_id || undefined,
    tenancy_id: ctx.tenancy_id || undefined,
  };
}
