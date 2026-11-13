INSERT INTO blocks (
    block_index,
    timestamp,
    hash,
    previous_hash,
    nonce
)
VALUES (
    0,
    '01/01/2024',
    '04b7ad971d000a8088cc66a1c1d5b4ea0bb6f3cd1426f8fe7b1ad1fe6686834d',
    '0',
    0
)
ON CONFLICT (block_index) DO NOTHING;
