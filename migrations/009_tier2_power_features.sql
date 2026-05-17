CREATE TABLE IF NOT EXISTS digital_keys (
    digital_key_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    guest_id INT NOT NULL,
    room_id INT NOT NULL,
    access_code VARCHAR(6) NOT NULL,
    qr_payload VARCHAR(255) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'Active',
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    UNIQUE KEY uq_digital_key_booking (booking_id),
    UNIQUE KEY uq_digital_key_code (access_code),
    KEY idx_digital_key_guest (guest_id),
    KEY idx_digital_key_room (room_id)
);

CREATE TABLE IF NOT EXISTS room_housekeeping (
    room_id INT PRIMARY KEY,
    cleaning_status VARCHAR(24) NOT NULL DEFAULT 'Clean',
    assigned_to VARCHAR(120) NULL,
    last_cleaned_at DATETIME NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS housekeeping_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    status VARCHAR(24) NOT NULL,
    staff_name VARCHAR(120) NULL,
    note VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_housekeeping_room (room_id)
);

CREATE TABLE IF NOT EXISTS pricing_rules (
    rule_key VARCHAR(80) PRIMARY KEY,
    rule_value DECIMAL(10,2) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO pricing_rules (rule_key, rule_value) VALUES
('surge_threshold', 80),
('surge_multiplier', 1.25),
('weekend_multiplier', 1.15),
('season_multiplier', 1.10),
('season_enabled', 0);

CREATE TABLE IF NOT EXISTS guest_reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    guest_id INT NOT NULL,
    overall_rating TINYINT NOT NULL,
    cleanliness_rating TINYINT NOT NULL,
    dining_rating TINYINT NOT NULL,
    staff_rating TINYINT NOT NULL,
    title VARCHAR(160) NULL,
    comment TEXT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    moderated_at DATETIME NULL,
    UNIQUE KEY uq_review_booking (booking_id),
    KEY idx_review_status (status),
    KEY idx_review_guest (guest_id)
);
