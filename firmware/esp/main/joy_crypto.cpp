#include "joy_crypto.h"

#include <cstring>
#include <cstdio>
#include "mbedtls/md.h"
#include "mbedtls/base64.h"

void joy_crypto_base64url_encode(const uint8_t *src, size_t src_len, char *dst, size_t dst_max)
{
    size_t out_len = 0;
    mbedtls_base64_encode(reinterpret_cast<unsigned char *>(dst), dst_max, &out_len, src, src_len);
    dst[out_len] = '\0';

    // Convert standard Base64 to base64url
    for (size_t i = 0; i < out_len; i++) {
        if (dst[i] == '+') dst[i] = '-';
        else if (dst[i] == '/') dst[i] = '_';
        else if (dst[i] == '=') {
            dst[i] = '\0';
            break;
        }
    }
}

void joy_crypto_canonical_hmac(
    const uint8_t *key,
    size_t key_len,
    const char **fields,
    size_t field_count,
    char *out_base64url,
    size_t max_out)
{
    uint8_t hmac_res[32] = {0};
    const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    if (!info) {
        if (max_out > 0) out_base64url[0] = '\0';
        return;
    }

    uint8_t k_pad[64] = {0};
    if (key_len > 64) {
        mbedtls_md(info, key, key_len, k_pad);
    } else {
        memcpy(k_pad, key, key_len);
    }

    uint8_t k_ipad[64];
    uint8_t k_opad[64];
    for (int i = 0; i < 64; i++) {
        k_ipad[i] = k_pad[i] ^ 0x36;
        k_opad[i] = k_pad[i] ^ 0x5c;
    }

    uint8_t inner_hash[32] = {0};
    mbedtls_md_context_t ctx;
    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, info, 0);
    mbedtls_md_starts(&ctx);
    mbedtls_md_update(&ctx, k_ipad, 64);
    for (size_t i = 0; i < field_count; i++) {
        if (i > 0) {
            mbedtls_md_update(&ctx, reinterpret_cast<const unsigned char *>("\n"), 1);
        }
        if (fields[i] != nullptr) {
            mbedtls_md_update(&ctx, reinterpret_cast<const unsigned char *>(fields[i]), strlen(fields[i]));
        }
    }
    mbedtls_md_finish(&ctx, inner_hash);

    mbedtls_md_starts(&ctx);
    mbedtls_md_update(&ctx, k_opad, 64);
    mbedtls_md_update(&ctx, inner_hash, 32);
    mbedtls_md_finish(&ctx, hmac_res);
    mbedtls_md_free(&ctx);

    joy_crypto_base64url_encode(hmac_res, sizeof(hmac_res), out_base64url, max_out);
}
bool joy_crypto_verify_canonical_hmac(
    const uint8_t *key,
    size_t key_len,
    const char **fields,
    size_t field_count,
    const char *expected_base64url)
{
    if (!expected_base64url) return false;
    char computed[64] = {0};
    joy_crypto_canonical_hmac(key, key_len, fields, field_count, computed, sizeof(computed));
    return (strcmp(computed, expected_base64url) == 0);
}

void joy_crypto_sha256_hex(const char *input, char *out_hex, size_t max_out)
{
    uint8_t hash[32] = {0};
    const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    if (info && input) {
        mbedtls_md(info, reinterpret_cast<const unsigned char *>(input), strlen(input), hash);
    }

    for (int i = 0; i < 32 && (size_t)(i * 2 + 2) < max_out; i++) {
        snprintf(out_hex + i * 2, max_out - i * 2, "%02x", hash[i]);
    }
}

void joy_crypto_derive_sec2_pop(
    const uint8_t *root_secret,
    const char *provisioning_ref,
    const char *setup_nonce,
    char *out_pop,
    size_t max_out)
{
    const char *fields[] = {
        "joy-sec2-v1",
        provisioning_ref,
        setup_nonce,
    };
    joy_crypto_canonical_hmac(root_secret, 32, fields, 3, out_pop, max_out);
}

bool joy_crypto_verify_secure_start(
    const uint8_t *root_secret,
    const char *hardware_id,
    const char *provisioning_ref,
    const char *setup_nonce,
    uint32_t reset_epoch,
    const char *session_id,
    const char *reservation_id,
    const char *proof)
{
    char epoch_str[16];
    snprintf(epoch_str, sizeof(epoch_str), "%lu", (unsigned long)reset_epoch);

    const char *fields[] = {
        "joy-secure-start-v1",
        hardware_id,
        provisioning_ref,
        setup_nonce,
        epoch_str,
        session_id,
        reservation_id,
    };
    return joy_crypto_verify_canonical_hmac(root_secret, 32, fields, 7, proof);
}

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
    size_t max_out)
{
    char epoch_str[16];
    snprintf(epoch_str, sizeof(epoch_str), "%lu", (unsigned long)reset_epoch);

    const char *fields[] = {
        "joy-physical-confirm-v1",
        hardware_id,
        provisioning_ref,
        setup_nonce,
        epoch_str,
        session_id,
        challenge,
        confirmation_nonce,
    };
    joy_crypto_canonical_hmac(root_secret, 32, fields, 8, out_proof, max_out);
}

void joy_crypto_create_commit_proof(
    const uint8_t *root_secret,
    const char *hardware_id,
    const char *setup_nonce,
    uint32_t reset_epoch,
    const char *reservation_id,
    const char *commit_nonce,
    char *out_proof,
    size_t max_out)
{
    char epoch_str[16];
    snprintf(epoch_str, sizeof(epoch_str), "%lu", (unsigned long)reset_epoch);

    const char *fields[] = {
        "joy-claim-commit-v1",
        hardware_id,
        setup_nonce,
        epoch_str,
        reservation_id,
        commit_nonce,
    };
    joy_crypto_canonical_hmac(root_secret, 32, fields, 6, out_proof, max_out);
}

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
    size_t max_out)
{
    char claim_sha256[65] = {0};
    joy_crypto_sha256_hex(claim_token, claim_sha256, sizeof(claim_sha256));

    char epoch_str[16];
    snprintf(epoch_str, sizeof(epoch_str), "%lu", (unsigned long)reset_epoch);

    const char *fields[] = {
        "joy-device-finalize-v1",
        hardware_id,
        reservation_id,
        claim_sha256,
        epoch_str,
        finalize_nonce,
        firmware_version,
        hardware_revision,
    };
    joy_crypto_canonical_hmac(mfg_secret, 32, fields, 8, out_proof, max_out);
}

void joy_crypto_create_reset_proof(
    const uint8_t *root_secret,
    const char *hardware_id,
    const char *provisioning_ref,
    uint32_t prev_epoch,
    uint32_t new_epoch,
    const char *reset_type,
    const char *reset_nonce,
    char *out_proof,
    size_t max_out)
{
    char prev_epoch_str[16];
    char new_epoch_str[16];
    snprintf(prev_epoch_str, sizeof(prev_epoch_str), "%lu", (unsigned long)prev_epoch);
    snprintf(new_epoch_str, sizeof(new_epoch_str), "%lu", (unsigned long)new_epoch);

    const char *fields[] = {
        "joy-device-reset-v1",
        hardware_id,
        provisioning_ref,
        prev_epoch_str,
        new_epoch_str,
        reset_type,
        reset_nonce,
    };
    joy_crypto_canonical_hmac(root_secret, 32, fields, 7, out_proof, max_out);
}
