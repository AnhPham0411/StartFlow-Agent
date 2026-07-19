-- Additive identity/branch rollout for the NBA portal.
-- Existing users keep their BIGINT ids so call-list, feedback, note and audit FKs remain valid.

CREATE TABLE branches (
    id          BIGSERIAL PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO branches(id, code, name) VALUES
    (1, 'HN-HK',  'Hà Nội - Hoàn Kiếm'),
    (2, 'HP',     'Hải Phòng'),
    (3, 'HCM-BT', 'TP.HCM - Bình Thạnh'),
    (4, 'HN-DD',  'Hà Nội - Đống Đa'),
    (5, 'CT',     'Cần Thơ'),
    (6, 'HUE',    'Huế'),
    (7, 'DN',     'Đà Nẵng'),
    (8, 'NT',     'Nha Trang'),
    (9, 'BH',     'Biên Hòa'),
    (10, 'HCM-Q1','TP.HCM - Quận 1')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

SELECT setval(
    pg_get_serial_sequence('branches', 'id'),
    GREATEST(COALESCE((SELECT max(id) FROM branches), 1), 1),
    true
);

ALTER TABLE users
    ADD COLUMN keycloak_user_id TEXT,
    ADD COLUMN branch_id BIGINT,
    ADD COLUMN active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE users
    ADD CONSTRAINT users_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;

UPDATE users SET role = 'employee'::user_role WHERE role = 'sale'::user_role;
UPDATE users SET role = 'admin'::user_role, branch = NULL WHERE username IN ('user017', 'user028');
UPDATE users SET role = 'manager'::user_role
WHERE username IN ('user006', 'user007', 'user020', 'user023', 'user029');
UPDATE users SET branch_id = b.id
FROM branches b
WHERE users.role <> 'admin'::user_role AND users.branch = b.name;
UPDATE users SET branch_id = NULL WHERE role = 'admin'::user_role;

ALTER TABLE users
    ADD CONSTRAINT users_role_branch_check CHECK (
      (role = 'admin'::user_role AND branch_id IS NULL)
      OR (role IN ('manager'::user_role, 'employee'::user_role) AND branch_id IS NOT NULL)
    );

CREATE UNIQUE INDEX users_keycloak_user_id_uq
    ON users(keycloak_user_id) WHERE keycloak_user_id IS NOT NULL;
CREATE INDEX users_branch_active_idx ON users(branch_id, active);
CREATE INDEX users_role_active_idx ON users(role, active);
