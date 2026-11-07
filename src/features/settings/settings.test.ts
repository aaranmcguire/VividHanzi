import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../../test/memoryStorage.ts'
import { EXERCISE_TYPES } from '../practice/exerciseDefinitions.ts'
import { DEFAULT_SETTINGS, isListeningOnly, isSessionSize, loadSettings, saveSettings } from './settings.ts'

describe('saveSettings / loadSettings', () => {
  it('saves and loads settings', () => {
    const storage = memoryStorage()
    const settings = { sessionSize: 20, dailyGoal: 50, toneColors: false, toneNumbers: true, exerciseTypes: ['pinyin-choice', 'writing'], theme: 'dark', hskLevel: 3, aiHelp: false } as const
    saveSettings(settings, storage)

    expect(loadSettings(storage)).toEqual(settings)
  })

  it('uses the defaults with no saved settings', () => {
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS)
  })

  it('settings saved before tones existed take the default values', () => {
    const storage = memoryStorage({ 'hanzivocab.settings': JSON.stringify({ version: 1, sessionSize: 5 }) })
    expect(loadSettings(storage)).toEqual({ sessionSize: 5, dailyGoal: 20, toneColors: true, toneNumbers: false, exerciseTypes: EXERCISE_TYPES, theme: 'system', hskLevel: null, aiHelp: true })
  })

  it('adds sentence translation to version 1 settings that had every older type', () => {
    const older = EXERCISE_TYPES.filter((type) => type !== 'sentence')
    const storage = memoryStorage({
      'hanzivocab.settings': JSON.stringify({ version: 1, exerciseTypes: older }),
    })

    expect(loadSettings(storage).exerciseTypes).toEqual(EXERCISE_TYPES)
  })

  it('respects a version 2 choice to leave sentence translation off', () => {
    const older = EXERCISE_TYPES.filter((type) => type !== 'sentence')
    const storage = memoryStorage({
      'hanzivocab.settings': JSON.stringify({ version: 2, exerciseTypes: older }),
    })

    expect(loadSettings(storage).exerciseTypes).toEqual(older)
  })

  it('ignores invalid values', () => {
    const storage = memoryStorage({ 'hanzivocab.settings': JSON.stringify({ version: 1, sessionSize: 7, theme: 'sepia', hskLevel: 6 }) })
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })
})

describe('exercise types', () => {
  const load = (saved: object) =>
    loadSettings(memoryStorage({ 'hanzivocab.settings': JSON.stringify({ version: 1, ...saved }) })).exerciseTypes

  it('turns the old writing switch into the list: all types, without writing if it was off', () => {
    expect(load({ writingExercises: false })).toEqual(EXERCISE_TYPES.filter((type) => type !== 'writing'))
    expect(load({ writingExercises: true })).toEqual(EXERCISE_TYPES)
  })

  it('drops unknown types and keeps the usual order', () => {
    expect(load({ exerciseTypes: ['tone-choice', 'sing-along', 'flashcard'] })).toEqual(['flashcard', 'tone-choice'])
  })

  it('keeps writing alone, and falls back to all types if none is left', () => {
    expect(load({ exerciseTypes: ['writing'] })).toEqual(['writing'])
    expect(load({ exerciseTypes: [] })).toEqual(EXERCISE_TYPES)
  })
})

describe('isSessionSize', () => {
  it('only accepts the available options', () => {
    expect(isSessionSize(5)).toBe(true)
    expect(isSessionSize(7)).toBe(false)
    expect(isSessionSize('10')).toBe(false)
  })
})

describe('isListeningOnly', () => {
  it('is true only when every chosen type is a listening one', () => {
    expect(isListeningOnly(['listening-choice'])).toBe(true)
    expect(isListeningOnly(['listening-choice', 'listening-translate'])).toBe(true)
    expect(isListeningOnly(['listening-choice', 'flashcard'])).toBe(false)
    expect(isListeningOnly([])).toBe(false)
  })
})
