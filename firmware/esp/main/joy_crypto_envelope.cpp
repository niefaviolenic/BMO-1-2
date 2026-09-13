#include "joy_crypto.h"
#include "mbedtls/base64.h"
#include "psa/crypto.h"
#include "esp_log.h"
#include <cstring>
#include <cstdlib>

static const char *TAG = "JOY_CRYPTO_ENV";

esp_err_t joy_crypto_base64url_decode(
    const char *src,
    uint8_t *dst,
    size_t dst_max,
    size_t *out_len)
{
    if (!src || !dst || !out_len) return ESP_ERR_INVALID_ARG;

    size_t src_len = strlen(src);
    if (src_len == 0) {
        *out_len = 0;
        return ESP_OK;
    }

    size_t rem = src_len % 4;
    size_t pad_len = (rem == 0) ? 0 : (4 - rem);
    if (rem == 1) {
        return ESP_ERR_INVALID_ARG;
    }

    size_t padded_len = src_len + pad_len;
    char *padded = (char *)malloc(padded_len + 1);
    if (!padded) return ESP_ERR_NO_MEM;

    for (size_t i = 0; i < src_len; i++) {
        if (src[i] == '-') padded[i] = '+';
        else if (src[i] == '_') padded[i] = '/';
        else padded[i] = src[i];
    }
    for (size_t i = 0; i < pad_len; i++) {
        padded[src_len + i] = '=';
    }
    padded[padded_len] = '\0';

    size_t decoded_len = 0;
    int ret = mbedtls_base64_decode(
        dst, dst_max, &decoded_len,
        (const unsigned char *)padded, padded_len
    );
    free(padded);

    if (ret != 0) {
        ESP_LOGE(TAG, "Base64 decode failed: ret=%d", ret);
        return ESP_FAIL;
    }

    *out_len = decoded_len;
    return ESP_OK;
}

esp_err_t joy_crypto_derive_session_key(
    const char *pop_base64url,
    const char *setup_nonce,
    uint8_t out_key[32])
{
    if (!pop_base64url || !setup_nonce || !out_key) return ESP_ERR_INVALID_ARG;

    // HKDF-SHA256:
    // 1. Extract: PRK = HMAC-SHA256(Salt = setup_nonce, IKM = pop_base64url)
    uint8_t prk[32] = {0};
    const char *ikm_fields[] = { pop_base64url };
    joy_crypto_raw_hmac((const uint8_t *)setup_nonce, strlen(setup_nonce), ikm_fields, 1, prk, 32);

    // 2. Expand: OKM = HMAC-SHA256(PRK, Info || 0x01)
    char info_buf[64];
    snprintf(info_buf, sizeof(info_buf), "%s%c", "joy-sec2-session-v1", 0x01);
    const char *info_fields[] = { info_buf };
    joy_crypto_raw_hmac(prk, 32, info_fields, 1, out_key, 32);

    return ESP_OK;
}

esp_err_t joy_crypto_decrypt_session_envelope(
    const uint8_t session_key[32],
    const uint8_t *iv, size_t iv_len,
    const uint8_t *ciphertext, size_t cipher_len,
    const uint8_t *tag, size_t tag_len,
    const char *aad, size_t aad_len,
    char *out_plaintext, size_t max_out)
{
    if (!session_key || !iv || !ciphertext || !tag || !out_plaintext) return ESP_ERR_INVALID_ARG;
    if (cipher_len >= max_out) return ESP_ERR_NO_MEM;

    psa_crypto_init();

    psa_key_attributes_t attr = psa_key_attributes_init();
    psa_set_key_usage_flags(&attr, PSA_KEY_USAGE_DECRYPT);
    psa_set_key_algorithm(&attr, PSA_ALG_GCM);
    psa_set_key_type(&attr, PSA_KEY_TYPE_AES);
    psa_set_key_bits(&attr, 256);

    mbedtls_svc_key_id_t key_id;
    psa_status_t status = psa_import_key(&attr, session_key, 32, &key_id);
    if (status != PSA_SUCCESS) {
        ESP_LOGE(TAG, "psa_import_key failed: %d", (int)status);
        return ESP_FAIL;
    }

    uint8_t *ct_with_tag = (uint8_t *)malloc(cipher_len + tag_len);
    if (!ct_with_tag) {
        psa_destroy_key(key_id);
        return ESP_ERR_NO_MEM;
    }
    memcpy(ct_with_tag, ciphertext, cipher_len);
    memcpy(ct_with_tag + cipher_len, tag, tag_len);

    size_t output_len = 0;
    status = psa_aead_decrypt(
        key_id,
        PSA_ALG_GCM,
        iv, iv_len,
        (const uint8_t *)aad, aad_len,
        ct_with_tag, cipher_len + tag_len,
        (uint8_t *)out_plaintext, max_out,
        &output_len
    );

    free(ct_with_tag);
    psa_destroy_key(key_id);

    if (status != PSA_SUCCESS) {
        ESP_LOGE(TAG, "psa_aead_decrypt failed: %d (Auth Tag mismatch)", (int)status);
        return ESP_ERR_INVALID_STATE;
    }

    out_plaintext[output_len] = '\0';
    return ESP_OK;
}

esp_err_t joy_crypto_encrypt_session_envelope(
    const uint8_t session_key[32],
    const uint8_t *iv, size_t iv_len,
    const char *plaintext, size_t plaintext_len,
    const char *aad, size_t aad_len,
    uint8_t *out_ciphertext, size_t max_cipher_out,
    size_t *out_cipher_len,
    uint8_t out_tag[16])
{
    if (!session_key || !iv || !plaintext || !out_ciphertext || !out_cipher_len || !out_tag) return ESP_ERR_INVALID_ARG;
    if (plaintext_len + 16 > max_cipher_out) return ESP_ERR_NO_MEM;

    psa_crypto_init();

    psa_key_attributes_t attr = psa_key_attributes_init();
    psa_set_key_usage_flags(&attr, PSA_KEY_USAGE_ENCRYPT);
    psa_set_key_algorithm(&attr, PSA_ALG_GCM);
    psa_set_key_type(&attr, PSA_KEY_TYPE_AES);
    psa_set_key_bits(&attr, 256);

    mbedtls_svc_key_id_t key_id;
    psa_status_t status = psa_import_key(&attr, session_key, 32, &key_id);
    if (status != PSA_SUCCESS) return ESP_FAIL;

    uint8_t *out_buf = (uint8_t *)malloc(plaintext_len + 16);
    if (!out_buf) {
        psa_destroy_key(key_id);
        return ESP_ERR_NO_MEM;
    }

    size_t output_length = 0;
    status = psa_aead_encrypt(
        key_id,
        PSA_ALG_GCM,
        iv, iv_len,
        (const uint8_t *)aad, aad_len,
        (const uint8_t *)plaintext, plaintext_len,
        out_buf, plaintext_len + 16,
        &output_length
    );

    psa_destroy_key(key_id);

    if (status != PSA_SUCCESS || output_length < 16) {
        free(out_buf);
        return ESP_FAIL;
    }

    size_t ct_len = output_length - 16;
    memcpy(out_ciphertext, out_buf, ct_len);
    memcpy(out_tag, out_buf + ct_len, 16);
    *out_cipher_len = ct_len;
    free(out_buf);
    return ESP_OK;
}
