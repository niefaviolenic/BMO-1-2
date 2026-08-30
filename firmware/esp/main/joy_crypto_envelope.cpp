#include "joy_crypto.h"
#include "mbedtls/base64.h"
#include "mbedtls/gcm.h"
#include "mbedtls/hkdf.h"
#include "mbedtls/md.h"
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
        // Invalid base64 length
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

    const mbedtls_md_info_t *md = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    if (!md) return ESP_FAIL;

    // HKDF-SHA256: IKM = pop_base64url, Salt = setup_nonce, Info = "joy-sec2-session-v1"
    int ret = mbedtls_hkdf(
        md,
        (const unsigned char *)setup_nonce, strlen(setup_nonce),
        (const unsigned char *)pop_base64url, strlen(pop_base64url),
        (const unsigned char *)"joy-sec2-session-v1", strlen("joy-sec2-session-v1"),
        out_key, 32
    );

    return ret == 0 ? ESP_OK : ESP_FAIL;
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

    mbedtls_gcm_context gcm;
    mbedtls_gcm_init(&gcm);

    int ret = mbedtls_gcm_setkey(&gcm, MBEDTLS_CIPHER_ID_AES, session_key, 256);
    if (ret != 0) {
        mbedtls_gcm_free(&gcm);
        return ESP_FAIL;
    }

    ret = mbedtls_gcm_auth_decrypt(
        &gcm,
        cipher_len,
        iv, iv_len,
        (const unsigned char *)aad, aad_len,
        tag, tag_len,
        ciphertext,
        (unsigned char *)out_plaintext
    );

    mbedtls_gcm_free(&gcm);

    if (ret != 0) {
        ESP_LOGE(TAG, "AES-GCM Auth Decrypt failed: ret=-0x%04x (Auth Tag mismatch)", -ret);
        return ESP_ERR_INVALID_STATE;
    }

    out_plaintext[cipher_len] = '\0';
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
    if (plaintext_len > max_cipher_out) return ESP_ERR_NO_MEM;

    mbedtls_gcm_context gcm;
    mbedtls_gcm_init(&gcm);

    int ret = mbedtls_gcm_setkey(&gcm, MBEDTLS_CIPHER_ID_AES, session_key, 256);
    if (ret != 0) {
        mbedtls_gcm_free(&gcm);
        return ESP_FAIL;
    }

    ret = mbedtls_gcm_crypt_and_tag(
        &gcm,
        MBEDTLS_GCM_ENCRYPT,
        plaintext_len,
        iv, iv_len,
        (const unsigned char *)aad, aad_len,
        (const unsigned char *)plaintext,
        out_ciphertext,
        16,
        out_tag
    );

    mbedtls_gcm_free(&gcm);

    if (ret != 0) {
        ESP_LOGE(TAG, "AES-GCM Encrypt failed: ret=-0x%04x", -ret);
        return ESP_FAIL;
    }

    *out_cipher_len = plaintext_len;
    return ESP_OK;
}
