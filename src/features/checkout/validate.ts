import type { Address } from '../../domain/types.ts';

export const EMPTY_ADDRESS: Address = { name: '', line1: '', city: '', region: '', postalCode: '', country: '' };

export const SAMPLE_ADDRESS: Address = {
  name: 'Sample Shopper',
  line1: '1 Example Street',
  city: 'Sampleton',
  region: '',
  postalCode: '00000',
  country: 'Exampleland',
};

export const ADDRESS_FIELDS: { key: keyof Address; label: string; max: number; required: boolean }[] = [
  { key: 'name', label: 'Name', max: 80, required: true },
  { key: 'line1', label: 'Street address', max: 120, required: true },
  { key: 'city', label: 'City', max: 60, required: true },
  { key: 'region', label: 'State or region (optional)', max: 60, required: false },
  { key: 'postalCode', label: 'Postal code', max: 20, required: true },
  { key: 'country', label: 'Country', max: 60, required: true },
];

export function trimAddress(address: Address): Address {
  return Object.fromEntries(Object.entries(address).map(([k, v]) => [k, v.trim()])) as unknown as Address;
}

export function addressErrors(address: Address): Partial<Record<keyof Address, string>> {
  const errors: Partial<Record<keyof Address, string>> = {};
  for (const field of ADDRESS_FIELDS) {
    const value = address[field.key].trim();
    if (field.required && !value) errors[field.key] = `Enter ${field.label.toLowerCase()}.`;
    else if (value.length > field.max) errors[field.key] = `Use at most ${field.max} characters.`;
  }
  return errors;
}
