#include "network.h"

#include "esp_log.h"

static const char *NETWORK_TAG = "NETWORK";

static EventGroupHandle_t network_events = NULL;

static EventGroupHandle_t get_network_events()
{
    if (network_events == NULL)
    {
        network_init();
    }

    return network_events;
}

void network_init(void)
{
    if (network_events != NULL)
    {
        return;
    }

    network_events = xEventGroupCreate();
    if (network_events == NULL)
    {
        ESP_LOGE(NETWORK_TAG, "Failed to create network event group");
    }
}

void network_set_wifi_connected(bool connected)
{
    EventGroupHandle_t events = get_network_events();
    if (events == NULL)
    {
        return;
    }

    if (connected)
    {
        xEventGroupSetBits(events, NETWORK_WIFI_CONNECTED_BIT);
    }
    else
    {
        xEventGroupClearBits(
            events,
            NETWORK_WIFI_CONNECTED_BIT | NETWORK_GOT_IP_BIT | NETWORK_BACKEND_CONNECTED_BIT);
    }
}

void network_set_got_ip(bool got_ip)
{
    EventGroupHandle_t events = get_network_events();
    if (events == NULL)
    {
        return;
    }

    if (got_ip)
    {
        xEventGroupSetBits(events, NETWORK_WIFI_CONNECTED_BIT | NETWORK_GOT_IP_BIT);
    }
    else
    {
        xEventGroupClearBits(events, NETWORK_GOT_IP_BIT | NETWORK_BACKEND_CONNECTED_BIT);
    }
}

void network_set_backend_connected(bool connected)
{
    EventGroupHandle_t events = get_network_events();
    if (events == NULL)
    {
        return;
    }

    if (connected)
    {
        EventBits_t bits = xEventGroupGetBits(events);
        if ((bits & (NETWORK_WIFI_CONNECTED_BIT | NETWORK_GOT_IP_BIT)) ==
            (NETWORK_WIFI_CONNECTED_BIT | NETWORK_GOT_IP_BIT))
        {
            xEventGroupSetBits(events, NETWORK_BACKEND_CONNECTED_BIT);
        }
        else
        {
            xEventGroupClearBits(events, NETWORK_BACKEND_CONNECTED_BIT);
        }
    }
    else
    {
        xEventGroupClearBits(events, NETWORK_BACKEND_CONNECTED_BIT);
    }
}

bool network_is_wifi_connected(void)
{
    EventGroupHandle_t events = get_network_events();
    if (events == NULL)
    {
        return false;
    }

    return (xEventGroupGetBits(events) & NETWORK_WIFI_CONNECTED_BIT) != 0;
}

bool network_has_ip(void)
{
    EventGroupHandle_t events = get_network_events();
    if (events == NULL)
    {
        return false;
    }

    return (xEventGroupGetBits(events) & NETWORK_GOT_IP_BIT) != 0;
}

bool network_is_backend_connected(void)
{
    EventGroupHandle_t events = get_network_events();
    if (events == NULL)
    {
        return false;
    }

    return (xEventGroupGetBits(events) & NETWORK_BACKEND_CONNECTED_BIT) != 0;
}

EventBits_t network_wait_for_bits(EventBits_t bits, TickType_t timeout_ticks)
{
    EventGroupHandle_t events = get_network_events();
    if (events == NULL)
    {
        return 0;
    }

    return xEventGroupWaitBits(events, bits, pdFALSE, pdTRUE, timeout_ticks);
}

EventBits_t network_wait_for_got_ip(TickType_t timeout_ticks)
{
    return network_wait_for_bits(NETWORK_GOT_IP_BIT, timeout_ticks);
}
