#ifndef JOY_CRYPTO_H
#define JOY_CRYPTO_H

#include <cstdint>
#include <cstddef>

#ifdef __cplusplus
extern "C" {
#endif

void joy_crypto_base64url_encode(const uint8_t *src, size_t src_len, char *dst, size_t dst_max);

void joy_crypto_canonical_hmac(
    const uint8_t *key,
    size_t key_len,
    const char **fields,
    size_t field_count,
    char *out_base64url,
    size_t max_out);

bool joy_crypto_verify_canonical_hmac(
    const uint8_t *key,
    size_t key_len,
    const char **fields,
    size_t field_count,
    const char *expected_base64url);

void joy_crypto_sha256_hex(const char *input, char *out_hex, size_t max_out);

void joy_crypto_derive_sec2_pop(
    const uint8_t *root_secret,
    const char *provisioning_ref,
    const char *setup_nonce,
    char *out_pop,
    size_t max_out);

bool joy_crypto_verify_secure_start(
    const uint8_t *root_secret,
    const char *hardware_id,
    const char *provisioning_ref,
    const char *setup_nonce,
    uint32_t reset_epoch,
    const char *session_id,
    const char *reservation_id,
    const char *proof);

void joy_crypto_create_physical_proof(
    const uint8_t *root_secret,
    const char *hardware_id,
    const char *provisioning_ref,
    const char *setup_nonce,
    uint32_t reset_epoch,
    const char *session_id,
    const char *challenge,
    const char *confirmation_nonce,
    char *out_proof,
    size_t max_out);

void joy_crypto_create_commit_proof(
    const uint8_t *root_secret,
    const char *hardware_id,
    const char *setup_nonce,
    uint32_t reset_epoch,
    const char *reservation_id,
    const char *commit_nonce,
    char *out_proof,
    size_t max_out);

void joy_crypto_create_finalize_proof(
    const uint8_t *mfg_secret,
    const char *hardware_id,
    const char *reservation_id,
    const char *claim_token,
    uint32_t reset_epoch,
    const char *finalize_nonce,
    const char *firmware_version,
    const char *hardware_revision,
    char *out_proof,
    size_t max_out);

void joy_crypto_create_reset_proof(
    const uint8_t *root_secret,
    const char *hardware_id,
    const char *provisioning_ref,
    uint32_t prev_epoch,
    uint32_t new_epoch,
    const char *reset_type,
    const char *reset_nonce,
    char *out_proof,
    size_t max_out);

#ifdef __cplusplus
}
#endif

#endif // JOY_CRYPTO_H
