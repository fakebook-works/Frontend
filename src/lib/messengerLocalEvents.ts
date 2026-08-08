import type { MessengerMessageDto } from '../api/types'

/**
 * Keeps Messenger surfaces in this tab synchronized when a message originates
 * outside their own composer, such as sharing a post from the Home feed.
 */
export const MESSENGER_MESSAGE_SENT_EVENT = 'fakebook:message-sent'

export function publishMessengerMessageSent(message: MessengerMessageDto) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<MessengerMessageDto>(MESSENGER_MESSAGE_SENT_EVENT, { detail: message }))
}
