-- The legacy profile bundle contains operational zone categories that differ
-- from the original geo taxonomy. Keep both sets so existing and seeded data
-- remain valid without lossy remapping.
ALTER TYPE zone_type ADD VALUE IF NOT EXISTS 'RESIDENTIAL';
ALTER TYPE zone_type ADD VALUE IF NOT EXISTS 'COMMERCIAL_HUB';
ALTER TYPE zone_type ADD VALUE IF NOT EXISTS 'INDUSTRIAL_ZONE';
ALTER TYPE zone_type ADD VALUE IF NOT EXISTS 'SUBURBAN_TRADE';
ALTER TYPE zone_type ADD VALUE IF NOT EXISTS 'RESIDENTIAL_DENSE';
ALTER TYPE zone_type ADD VALUE IF NOT EXISTS 'CBD_PREMIUM';

ALTER TYPE geo_match_method ADD VALUE IF NOT EXISTS 'gis_spatial_engine';
