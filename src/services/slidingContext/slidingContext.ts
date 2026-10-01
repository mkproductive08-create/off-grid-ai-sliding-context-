import { Message } from '../../types'

export interface SlidingContextConfig {
  maxTokens: number
  reserveTokens: number
  recentTokens: number
}

export interface SlidingContextResult {
  messages: Message[]
  archivedMessages: Message[]
  estimatedTokens: number
  didSlide: boolean
}

const DEFAULT_CONFIG: SlidingContextConfig = {
  maxTokens: 2048,
  reserveTokens: 512,
  recentTokens: 1024,
}

/**
 * Estimates tokens without requiring access to the native tokenizer.
 *
 * This is intentionally conservative. The native LLM tokenizer will remain
 * the final authority when the context is actually submitted.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0

  // Rough approximation for mixed natural language/code.
  return Math.ceil(text.length / 4)
}

export function estimateMessageTokens(message: Message): number {
  return estimateTokens(message.content) + 4
}

export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce(
    (total, message) => total + estimateMessageTokens(message),
    0,
  )
}

/**
 * Keeps the newest messages inside the active context window.
 *
 * Older messages are returned separately so a future memory/compression
 * layer can preserve their important information instead of deleting them.
 */
export function createSlidingContext(
  messages: Message[],
  config: Partial<SlidingContextConfig> = {},
): SlidingContextResult {
  const settings = {
    ...DEFAULT_CONFIG,
    ...config,
  }

  const availableTokens = Math.max(
    1,
    settings.maxTokens - settings.reserveTokens,
  )

  const totalTokens = estimateMessagesTokens(messages)

  if (totalTokens <= availableTokens) {
    return {
      messages,
      archivedMessages: [],
      estimatedTokens: totalTokens,
      didSlide: false,
    }
  }

  const activeMessages: Message[] = []
  const archivedMessages: Message[] = []

  let activeTokens = 0

  // Always walk backwards so the newest messages are preserved.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    const messageTokens = estimateMessageTokens(message)

    if (
      activeTokens + messageTokens <= availableTokens ||
      activeMessages.length === 0
    ) {
      activeMessages.unshift(message)
      activeTokens += messageTokens
    } else {
      archivedMessages.unshift(message)
    }
  }

  return {
    messages: activeMessages,
    archivedMessages,
    estimatedTokens: activeTokens,
    didSlide: archivedMessages.length > 0,
  }
}

/**
 * Builds the context that should be sent to the model.
 *
 * `systemMessages` are kept outside the sliding conversation window.
 */
export function buildSlidingContext(
  systemMessages: Message[],
  conversationMessages: Message[],
  config: Partial<SlidingContextConfig> = {},
): SlidingContextResult {
  const result = createSlidingContext(conversationMessages, config)

  return {
    ...result,
    messages: [...systemMessages, ...result.messages],
  }
}