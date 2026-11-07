import { describe, expect, it } from 'vitest'
import { hskCharacterItems, hskWordItems } from '../dictionary/hskDictionary.ts'
import { audioSources, audioUrl, hasAudio } from './audio.ts'

describe('audio availability', () => {
  it('has recordings for common HSK words', () => {
    const thanks = hskWordItems.find((item) => item.entry.hanzi === '谢谢')!
    expect(hasAudio(thanks)).toBe(true)
  })

  it('does not offer audio for missing words or ambiguous readings', () => {
    const beijing = hskWordItems.find((item) => item.entry.hanzi === '北京')!
    const chang = hskWordItems.find((item) => item.entry.hanzi === '长')!
    const le = hskCharacterItems.find((item) => item.entry.hanzi === '了')!

    expect(hasAudio(beijing)).toBe(false)
    expect(hasAudio(chang)).toBe(false)
    expect(hasAudio(le)).toBe(false)
  })

  it('builds the static file URL from the hanzi', () => {
    expect(audioUrl('谢谢')).toContain('audio/cmn-%E8%B0%A2%E8%B0%A2.mp3')
  })

  it('uses syllables for a homograph and for a missing whole-word file', () => {
    const huan = hskWordItems.find(
      (item) => item.entry.hanzi === '还' && item.entry.pinyin === 'huán',
    )!
    const beijing = hskWordItems.find((item) => item.entry.hanzi === '北京')!

    expect(audioSources(huan)).toEqual([
      expect.stringContaining('audio/syllables/cmn-huan2.mp3'),
    ])
    expect(audioSources(beijing)).toEqual([
      expect.stringContaining('audio/syllables/cmn-bei3.mp3'),
      expect.stringContaining('audio/syllables/cmn-jing1.mp3'),
    ])
  })

  it('does not guess a character with several readings', () => {
    const le = hskCharacterItems.find((item) => item.entry.hanzi === '了')!
    expect(audioSources(le)).toEqual([])
  })
})
