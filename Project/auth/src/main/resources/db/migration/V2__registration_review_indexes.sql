CREATE UNIQUE INDEX uk_pending_registration_owner_email
    ON restaurant_registrations (lower(owner_email))
    WHERE status = 'PENDING';

CREATE UNIQUE INDEX uk_pending_registration_restaurant_name
    ON restaurant_registrations (lower(restaurant_name))
    WHERE status = 'PENDING';
