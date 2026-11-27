CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    from_address VARCHAR(64),
    to_address VARCHAR(64) NOT NULL,
    amount NUMERIC(20, 8) NOT NULL CHECK (amount > 0),
    public_key TEXT,
    signature TEXT,
    block_id BIGINT REFERENCES blocks(id) ON DELETE SET NULL,
    transaction_position INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT transactions_from_address_format_check
        CHECK (
            from_address IS NULL
            OR from_address ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT transactions_to_address_format_check
        CHECK (to_address ~ '^[0-9a-f]{64}$'),

    CONSTRAINT transactions_status_check
        CHECK (status IN ('pending', 'confirmed')),

    CONSTRAINT transactions_position_check
        CHECK (
            transaction_position IS NULL
            OR transaction_position >= 0
        )
);
