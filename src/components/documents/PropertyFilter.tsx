import { useEffect, useState } from "react";
import { propertiesApi } from "../../api/properties";
import type { Property } from "../../lib/propertyTypes";
import { Field, Select } from "../ui/ui";

/** Filter-bar select for document lists. Hidden when the member has no properties to filter by. */
export function PropertyFilter({ id, value, onChange }: { id: string; value: string; onChange: (propertyId: string | undefined) => void }) {
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    propertiesApi.list().then(setProperties).catch(() => undefined);
  }, []);

  if (properties.length === 0) return null;
  return (
    <Field label="Property" htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
