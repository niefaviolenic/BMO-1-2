#ifndef SHIM_FREERTOS_H
#define SHIM_FREERTOS_H

#include <cstdint>

typedef int portMUX_TYPE;
#define portMUX_INITIALIZER_UNLOCKED 0

inline void portENTER_CRITICAL(portMUX_TYPE *) {}
inline void portEXIT_CRITICAL(portMUX_TYPE *) {}

#endif // SHIM_FREERTOS_H
