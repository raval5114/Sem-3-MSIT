ALTER TABLE authorization_versions
    DROP CONSTRAINT authorization_versions_scope_type_check;

ALTER TABLE authorization_versions
    ADD CONSTRAINT authorization_versions_scope_type_check
        CHECK (scope_type IN ('USER', 'RESTAURANT', 'ROLE', 'FEATURE'));

ALTER TABLE authorization_versions
    ADD COLUMN row_version BIGINT NOT NULL DEFAULT 0;
