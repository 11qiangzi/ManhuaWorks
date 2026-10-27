-- ============================================================
-- ManhuaWorks asset-service Migration 0004
-- Reference Images: unified multi-angle reference image storage
-- ============================================================
-- Used by all 6 creation modules for character/scene/product consistency
-- Supports: character, scene, product, style entity types
-- Image types: front, side_left, side_right, three_quarter, back,
--              full_body, close_up, detail, full_scene, atmosphere, style_ref
-- ============================================================

-- Reference Images table
CREATE TABLE IF NOT EXISTS reference_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  entity_type VARCHAR(20) NOT NULL
    CHECK (entity_type IN ('character', 'scene', 'product', 'style')),
  entity_id VARCHAR(200) NOT NULL,  -- character name / scene name / product name
  image_url TEXT NOT NULL,
  image_type VARCHAR(30) NOT NULL DEFAULT 'front'
    CHECK (image_type IN ('front', 'side_left', 'side_right', 'three_quarter', 'back', 'full_body', 'close_up', 'detail', 'full_scene', 'atmosphere', 'style_ref')),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ref_images_project ON reference_images (project_id);
CREATE INDEX IF NOT EXISTS idx_ref_images_entity  ON reference_images (project_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ref_images_type    ON reference_images (entity_type);

-- Auto-update updated_at trigger (reuse existing function if available)
DROP TRIGGER IF EXISTS trg_reference_images_updated_at ON reference_images;
CREATE TRIGGER trg_reference_images_updated_at
    BEFORE UPDATE ON reference_images
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============================================================
-- Done
-- ============================================================
-- Run:
--   psql $DATABASE_URL -f services/asset-service/src/db/migrations/0004_reference_images.sql
-- ============================================================
