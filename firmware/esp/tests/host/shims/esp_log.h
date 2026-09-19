#ifndef SHIM_ESP_LOG_H
#define SHIM_ESP_LOG_H

#include <cstdio>

#define ESP_LOGI(tag, fmt, ...) do { (void)(tag); } while(0)
#define ESP_LOGW(tag, fmt, ...) do { (void)(tag); } while(0)
#define ESP_LOGE(tag, fmt, ...) do { (void)(tag); } while(0)

#endif
