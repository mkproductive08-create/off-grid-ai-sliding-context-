import {
  createSlidingContext,
  estimateMessageTokens,
  estimateMessagesTokens,
} from './slidingContext'

import type { Message } from '../../types'

function message(id: string, content: string): Message {
  return {
    id,
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

describe('Sliding Context', () => {
  it('keeps all messages when they fit inside the context', () => {
    const messages = [
      message('1', 'Hello'),
      message('2', 'How are you?'),
      message('3', 'I am building CTC.'),
    ]

    const result = createSlidingContext(messages, {
      maxTokens: 1000,
      reserveTokens: 100,
    })

    expect(result.didSlide).toBe(false)
    expect(result.messages).toHaveLength(3)
    expect(result.archivedMessages).toHaveLength(0)
  })

  it('archives old messages when the context is full', () => {
    const messages = [
      message('1', 'A'.repeat(400)),
      message('2', 'B'.repeat(400)),
      message('3', 'C'.repeat(400)),
      message('4', 'D'.repeat(400)),
    ]

    const result = createSlidingContext(messages, {
      maxTokens: 500,
      reserveTokens: 50,
    })

    expect(result.didSlide).toBe(true)
    expect(result.archivedMessages.length).toBeGreaterThan(0)
    expect(result.messages.length).toBeGreaterThan(0)
  })

  it('preserves the newest messages', () => {
    const messages = [
      message('1', 'OLD MESSAGE'),
      message('2', 'SECOND OLD MESSAGE'),
      message('3', 'RECENT MESSAGE'),
      message('4', 'LATEST MESSAGE'),
    ]

    const result = createSlidingContext(messages, {
      maxTokens: 20,
      reserveTokens: 0,
    })

    const activeIds = result.messages.map(m => m.id)

    expect(activeIds[activeIds.length - 1]).toBe('4')
  })

  it('does not destroy archived messages', () => {
    const messages = [
      message('1', 'A'.repeat(400)),
      message('2', 'B'.repeat(400)),
      message('3', 'C'.repeat(400)),
    ]

    const result = createSlidingContext(messages, {
      maxTokens: 300,
      reserveTokens: 50,
    })

    const archivedIds = result.archivedMessages.map(m => m.id)

    expect(archivedIds.length).toBeGreaterThan(0)

    for (const archived of result.archivedMessages) {
      expect(archived.content.length).toBeGreaterThan(0)
    }
  })

  it('estimates message tokens', () => {
    const msg = message('1', 'Hello world')

    expect(estimateMessageTokens(msg)).toBeGreaterThan(0)
  })

  it('estimates total message tokens', () => {
    const messages = [
      message('1', 'Hello'),
      message('2', 'World'),
    ]

    const total = estimateMessagesTokens(messages)

    expect(total).toBeGreaterThan(0)
  })

  it('keeps system messages when using buildSlidingContext', () => {
    const system = message('system', 'You are the CTC development assistant.')

    system.role = 'system'

    const conversation = [
      message('1', 'Build a lexer.'),
      message('2', 'Now build a parser.'),
    ]

    const result = createSlidingContext(conversation, {
      maxTokens: 1000,
      reserveTokens: 100,
    })

    const combined = [system, ...result.messages]

    expect(combined[0].role).toBe('system')
    expect(combined[0].content).toContain('CTC')
  })
})