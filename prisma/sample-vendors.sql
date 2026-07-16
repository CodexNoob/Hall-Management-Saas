BEGIN;

INSERT INTO public.vendors (
  id,
  organization_id,
  name,
  description,
  category,
  contact_name,
  email,
  phone,
  status,
  rating,
  notes,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  organization.id,
  sample.name,
  sample.description,
  sample.category,
  sample.contact_name,
  sample.email,
  sample.phone,
  'Active',
  sample.rating,
  'Sample vendor record for UI demonstration.',
  NOW(),
  NOW()
FROM public.organizations AS organization
CROSS JOIN (
  VALUES
    ('Gourmet Delights Catering', 'Full-service kosher catering', 'Catering', 'Sarah Gold', 'sarah@gourmet-delights.example', '718-555-0142', 4.6),
    ('Linen Touch', 'Table linens and event rentals', 'Linens', 'Michael Levine', 'michael@linen-touch.example', '718-555-0198', 4.4),
    ('Blossom & Bloom', 'Floral design and centerpieces', 'Flowers', 'Rachel Green', 'rachel@blossom-bloom.example', '718-555-0233', 4.9),
    ('Premier Party Rentals', 'Furniture, decor, and equipment rentals', 'Rentals', 'David Cohen', 'david@premier-rentals.example', '718-555-0177', 4.3),
    ('AV Pro Solutions', 'Audio, lighting, and presentation systems', 'AV Services', 'Jason Patel', 'jason@av-pro.example', '718-555-0288', 4.5),
    ('Sweet Endings Bakery', 'Desserts, pastries, and custom cakes', 'Bakery', 'Avi Stern', 'avi@sweet-endings.example', '718-555-0204', 4.7)
) AS sample(name, description, category, contact_name, email, phone, rating)
WHERE organization.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.vendors AS existing
    WHERE existing.organization_id = organization.id
  );

COMMIT;
