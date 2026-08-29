export { API_CONFIG, API_ORIGIN, API_V1_BASE_URL } from './config';
export {
  apiRequest,
  configureHttpAuth,
  type HttpAuthBridge,
  type HttpRequestOptions,
} from './http-client';
export {
  configureMobileWebSocket,
  connectMobileWebSocket,
  disconnectMobileWebSocket,
  subscribeMobileWebSocket,
  normalizeMobileInboundEvent,
  isDeviceStatusEvent,
  isScheduleStatusEvent,
  isIntegrationStatusEvent,
  isWhatsAppNotificationEvent,
  type ChatMessageEvent,
  type ChatThinkingEvent,
  type ChatTitleUpdatedEvent,
  type DeviceStatusEvent,
  type IntegrationStatusEvent,
  type NotificationEvent,
  type MobileInboundEvent,
  type MobileWebSocketAuth,
  type ScheduleStatusEvent,
  type WhatsAppNotificationEvent,
} from './mobile-websocket';
export { ApiError, isApiError, isAuthenticationFailed } from './types';
