import { describe, expect, it } from 'vitest'
import { createFakeFetch, jsonResponse } from '../../test/fakeFetch.ts'
import { getTranslationHint, gradeTranslation, loadAiStatus } from './ai.ts'

describe('loadAiStatus', () => {
  it('reads whether Workers AI is configured', async () => {
    const fake = createFakeFetch([
      ['/api/ai', jsonResponse({ available: true, model: '@cf/deepseek-ai/deepseek-v4.1-flash-1017' })],
    ])

    await expect(loadAiStatus(fake.fetch)).resolves.toEqual({
      available: true,
      model: '@cf/deepseek-ai/deepseek-v4.1-flash-1017',
    })
  })

  it('says unavailable when the Worker has no AI binding', async () => {
    const fake = createFakeFetch([['/api/ai', jsonResponse({ available: false })]])

    await expect(loadAiStatus(fake.fetch)).resolves.toEqual({ available: false })
  })

  it('fails when the endpoint fails', async () => {
    const fake = createFakeFetch([['/api/ai', jsonResponse({ error: 'nope' }, { status: 500 })]])

    await expect(loadAiStatus(fake.fetch)).rejects.toThrow('AI status request failed')
  })
})

describe('gradeTranslation', () => {
  it('returns the verdict, feedback and memory tip', async () => {
    const fake = createFakeFetch([
      [
        '/api/ai/grade',
        jsonResponse({
          verdict: 'partial',
          feedback: 'You missed the object.',
          memoryTip: '喜欢 is followed by what you like.',
        }),
      ],
    ])

    await expect(
      gradeTranslation(
        { chinese: '我喜欢猫。', reference: 'I like cats.', answer: 'I like.' },
        fake.fetch,
      ),
    ).resolves.toEqual({
      verdict: 'partial',
      feedback: 'You missed the object.',
      memoryTip: '喜欢 is followed by what you like.',
    })
  })

  it('sends the sentence, reference and answer', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init })
      return jsonResponse({ verdict: 'correct', feedback: 'Nice.', memoryTip: '' })
    }

    await gradeTranslation(
      { chinese: '我喜欢猫。', reference: 'I like cats.', answer: 'I like cats.' },
      fetchFn,
    )

    expect(calls[0]?.url).toBe('/api/ai/grade')
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      chinese: '我喜欢猫。',
      reference: 'I like cats.',
      answer: 'I like cats.',
    })
  })

  it('rejects a malformed verdict', async () => {
    const fake = createFakeFetch([
      ['/api/ai/grade', jsonResponse({ verdict: 'maybe', feedback: 'Hmm.' })],
    ])

    await expect(
      gradeTranslation({ chinese: '你好。', reference: 'Hello.', answer: 'Hello.' }, fake.fetch),
    ).rejects.toThrow('AI grade response is invalid')
  })
})

describe('getTranslationHint', () => {
  it('returns the hint and memory tip', async () => {
    const fake = createFakeFetch([
      [
        '/api/ai/hint',
        jsonResponse({ hint: 'Start with the subject.', memoryTip: '我 is the speaker.' }),
      ],
    ])

    await expect(
      getTranslationHint({ chinese: '我喝茶。', reference: 'I drink tea.' }, fake.fetch),
    ).resolves.toEqual({ hint: 'Start with the subject.', memoryTip: '我 is the speaker.' })
  })

  it('rejects a response without a hint', async () => {
    const fake = createFakeFetch([['/api/ai/hint', jsonResponse({ memoryTip: '...' })]])

    await expect(
      getTranslationHint({ chinese: '我喝茶。', reference: 'I drink tea.' }, fake.fetch),
    ).rejects.toThrow('AI hint response is invalid')
  })
})
