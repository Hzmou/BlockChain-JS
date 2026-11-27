CREATE INDEX IF NOT EXISTS transactions_block_idx
    ON transactions (block_id);

CREATE INDEX IF NOT EXISTS transactions_status_idx
    ON transactions (status);

CREATE INDEX IF NOT EXISTS transactions_from_address_idx
    ON transactions (from_address);

CREATE INDEX IF NOT EXISTS transactions_to_address_idx
    ON transactions (to_address);
