import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/AppProviders.tsx'
import { AppRoutes } from '../../app/AppRoutes.tsx'
import { LOCAL_BACKEND } from '../../features/backend/config.ts'
import { addItem, createCustomSet } from '../../features/customSets/customSets.ts'
import { loadCustomSets, saveCustomSets } from '../../features/customSets/storage.ts'
import { hskDictionary } from '../../features/dictionary/hskDictionary.ts'
import { getStudyItem } from '../../features/dictionary/studyItem.ts'
import type { KeyValueStorage } from '../../lib/storage.ts'
import { createChunkLoader } from '../../test/dictionaryChunks.ts'
import { memoryStorage } from '../../test/memoryStorage.ts'
import { paragraphWithText } from '../../test/text.ts'

function renderAt(path: string, storage: KeyValueStorage = memoryStorage()) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders storage={storage} loadChunk={createChunkLoader()} backend={LOCAL_BACKEND}>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
}

type User = ReturnType<typeof userEvent.setup>

async function createSet(user: User, name: string) {
  await user.click(screen.getByRole('link', { name: 'Create custom set' }))
  await user.type(screen.getByLabelText('Name'), name)
  await user.click(screen.getByRole('button', { name: 'Create' }))
}

async function addWord(user: User, query: string, hanzi: string) {
  const search = screen.getByRole('searchbox', { name: 'Search' })
  await user.clear(search)
  await user.type(search, query)
  await user.click(await screen.findByRole('button', { name: new RegExp(`^Add ${hanzi} \\(`) }))
}

function getVocabulary() {
  return screen.getByRole('region', { name: 'Vocabulary' })
}

describe('Custom sets', () => {
  it('creates a set and goes to its page, where vocabulary from the dictionary is added', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/custom', storage)
    expect(screen.getByText("You haven't created any sets yet.")).toBeInTheDocument()

    await createSet(user, 'My Chinese')
    expect(screen.getByRole('heading', { level: 1, name: 'My Chinese' })).toBeInTheDocument()
    expect(screen.getByText(/This set is empty/)).toBeInTheDocument()

    await addWord(user, 'apple', '苹果')
    await addWord(user, 'jichang', '机场')
    await addWord(user, '学习', '学习')

    expect(within(getVocabulary()).getAllByRole('listitem')).toHaveLength(3)
    const [saved] = loadCustomSets(storage)
    expect(saved).toMatchObject({ name: 'My Chinese', itemIds: ['word:苹果', 'word:机场', 'word:学习'] })
    // The set only stores ids: the dictionary word stays the same
    expect(getStudyItem(hskDictionary, 'word:苹果')?.entry.meanings.en[0]).toBe('apple')
  })

  it('adds non-HSK words from the full dictionary and opens their entry', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/custom', storage)
    await createSet(user, 'Zoo')

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'penguin')
    await user.click(await screen.findByRole('button', { name: 'Add 企鹅 (qǐ é) to this set' }))

    expect(loadCustomSets(storage)[0]?.itemIds).toEqual(['word:企鹅'])
    const vocabulary = getVocabulary()
    expect(within(vocabulary).getByText('penguin')).toBeInTheDocument()

    await user.click(within(vocabulary).getByRole('link', { name: /企鹅/ }))
    expect(await screen.findByRole('heading', { level: 1, name: '企鹅' })).toBeInTheDocument()
    // Full entry: meaning and its characters (also non-HSK), without an HSK level
    expect(screen.getByText('penguin')).toBeInTheDocument()
    const characters = screen.getByRole('heading', { name: 'Characters' }).parentElement!
    expect(within(characters).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/characters/%E4%BC%81',
      '/characters/%E9%B9%85',
    ])
    expect(screen.queryByText(/^HSK \d/)).not.toBeInTheDocument()
  })

  it('on reload, loads the set\'s non-HSK words from the full dictionary', async () => {
    const storage = memoryStorage()
    saveCustomSets([addItem(createCustomSet({ name: 'Zoo', description: '' }, 'custom-zoo', new Date()), 'word:企鹅')], storage)
    renderAt('/study/sets/custom-zoo', storage)

    expect(screen.getByRole('status')).toHaveTextContent('Loading from the dictionary…')
    expect(await within(await screen.findByRole('region', { name: 'Vocabulary' })).findByText('penguin')).toBeInTheDocument()
  })

  it('does not allow adding the same item twice', async () => {
    const user = userEvent.setup()
    renderAt('/study/custom')
    await createSet(user, 'Mine')
    await addWord(user, 'apple', '苹果')

    const results = screen.getByRole('list', { name: 'Results' })
    expect(within(results).queryByRole('button', { name: 'Add 苹果 (píng guǒ) to this set' })).not.toBeInTheDocument()
    expect(within(results).getByText('In set')).toBeInTheDocument()
  })

  it('removes an item from the set without touching the dictionary', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/custom', storage)
    await createSet(user, 'Mine')
    await addWord(user, 'apple', '苹果')

    await user.click(within(getVocabulary()).getByRole('button', { name: 'Remove 苹果 from this set' }))

    expect(loadCustomSets(storage)[0]?.itemIds).toEqual([])
    expect(getStudyItem(hskDictionary, 'word:苹果')).toBeDefined()
  })

  it('renames the set and rejects an empty name', async () => {
    const user = userEvent.setup()
    renderAt('/study/custom')
    await createSet(user, 'Mine')

    await user.click(screen.getByRole('button', { name: 'Edit name and description' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Give the set a name.')

    await user.type(screen.getByLabelText('Name'), 'Travel to Beijing')
    await user.type(screen.getByLabelText('Description (optional)'), 'Words for my trip')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Travel to Beijing' })).toBeInTheDocument()
    expect(screen.getByText('Words for my trip')).toBeInTheDocument()
  })

  it('deletes the set after confirming and returns to the list', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/custom', storage)
    await createSet(user, 'Mine')

    await user.click(screen.getByRole('button', { name: 'Delete set' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Yes, delete set' }))

    expect(screen.getByText("You haven't created any sets yet.")).toBeInTheDocument()
    expect(loadCustomSets(storage)).toEqual([])
  })

  it('adds, edits and deletes a custom meaning without changing the dictionary one', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/custom', storage)
    await createSet(user, 'Travel')
    await addWord(user, 'jichang', '机场')

    await user.click(within(getVocabulary()).getByRole('button', { name: 'Add my meaning' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Write a meaning, or cancel.')
    await user.type(screen.getByLabelText('My meaning for 机场'), 'airport when travelling')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(within(getVocabulary()).getByText('airport when travelling')).toBeInTheDocument()

    await user.click(within(getVocabulary()).getByRole('button', { name: 'Edit my meaning' }))
    await user.clear(screen.getByLabelText('My meaning for 机场'))
    await user.type(screen.getByLabelText('My meaning for 机场'), 'airport')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(loadCustomSets(storage)[0]?.meanings).toEqual({ 'word:机场': 'airport' })
    expect(getStudyItem(hskDictionary, 'word:机场')?.entry.meanings.en).not.toContain('airport when travelling')

    await user.click(within(getVocabulary()).getByRole('button', { name: 'Delete my meaning' }))
    expect(loadCustomSets(storage)[0]?.meanings).toEqual({})
  })

  it('from the set, the dictionary entry is the usual one and also shows the set notes', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    renderAt('/study/custom')
    await createSet(user, 'Travel')
    await addWord(user, 'apple', '苹果')
    await user.click(within(getVocabulary()).getByRole('button', { name: 'Add my meaning' }))
    await user.type(screen.getByLabelText('My meaning for 苹果'), 'apple for the supermarket')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.click(within(getVocabulary()).getByRole('link', { name: 'Open 苹果 in the dictionary' }))

    // The official entry is still there, with the dictionary meaning
    const meanings = screen.getByRole('heading', { name: 'Meanings' }).parentElement!
    expect(within(meanings).getByText('apple')).toBeInTheDocument()
    // And separately, the set notes
    expect(screen.getByRole('heading', { name: 'My notes in Travel' })).toBeInTheDocument()
    expect(screen.getByText('apple for the supermarket')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Travel' })).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('adds, edits and deletes a custom sentence by writing only the Chinese', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/custom', storage)
    await createSet(user, 'Travel')
    await addWord(user, 'jichang', '机场')

    await user.click(within(getVocabulary()).getByRole('button', { name: 'Add a sentence' }))
    await user.type(screen.getByLabelText('Sentence in Chinese'), 'hello')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The sentence needs at least one Chinese character.')

    await user.clear(screen.getByLabelText('Sentence in Chinese'))
    await user.type(screen.getByLabelText('Sentence in Chinese'), '我在机场等你。')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await within(getVocabulary()).findByRole('button', { name: 'Edit sentence 我在机场等你。' })).toBeInTheDocument()
    expect(loadCustomSets(storage)[0]?.sentences).toMatchObject([{ chinese: '我在机场等你。', itemId: 'word:机场' }])

    await user.click(within(getVocabulary()).getByRole('button', { name: 'Edit sentence 我在机场等你。' }))
    await user.clear(screen.getByLabelText('Sentence in Chinese'))
    await user.type(screen.getByLabelText('Sentence in Chinese'), '机场很大。')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await within(getVocabulary()).findByRole('button', { name: 'Delete sentence 机场很大。' })).toBeInTheDocument()

    await user.click(within(getVocabulary()).getByRole('button', { name: 'Delete sentence 机场很大。' }))
    expect(loadCustomSets(storage)[0]?.sentences).toEqual([])
  })

  it('generates the sentence pinyin on save and lets you pick the reading of an uncertain character', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/custom', storage)
    await createSet(user, 'My Chinese')
    await addWord(user, '学习', '学习')

    await user.click(within(getVocabulary()).getByRole('button', { name: 'Add a sentence' }))
    await user.type(screen.getByLabelText('Sentence in Chinese'), '我每天学习中文。')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await within(getVocabulary()).findByText(paragraphWithText('wǒ měi tiān xué xí zhōng wén。'))).toBeInTheDocument()
    const [sentence] = loadCustomSets(storage)[0]!.sentences
    expect(sentence?.tokens.map((token) => token.tone ?? '-').join('')).toBe('3312212-')

    await user.click(within(getVocabulary()).getByRole('button', { name: 'Add a sentence' }))
    await user.type(screen.getByLabelText('Sentence in Chinese'), '他长大了。')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.click(within(getVocabulary()).getByRole('button', { name: 'Add a sentence' }))
    await user.type(screen.getByLabelText('Sentence in Chinese'), '他长得很高。')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await user.selectOptions(await screen.findByLabelText('Pronunciation of 长'), 'zhǎng')
    const saved = loadCustomSets(storage)[0]!.sentences[2]!
    expect(saved.tokens[1]).toEqual({ text: '长', pinyin: 'zhǎng', tone: 3 })
    // The dictionary does not change: 长 still has its two readings
    expect(getStudyItem(hskDictionary, 'char:长')?.entry.pinyin).toEqual(['cháng', 'zhǎng'])
  })
  it('imports a set pasted from an AI as JSON, leaving out words not in the dictionary', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/custom', storage)
    await user.click(screen.getByRole('link', { name: 'Import set' }))
    expect((screen.getByRole('textbox', { name: 'Make it with AI' }) as HTMLTextAreaElement).value).toContain('"words"')

    const json = '{"name": "Zoo and fruit", "description": "From an AI", "words": [{"hanzi": "苹果"}, {"hanzi": "企鹅", "pinyin": "qi3 e2"}, {"hanzi": "火龙果"}]}'
    await user.click(screen.getByRole('textbox', { name: 'Paste the set' }))
    await user.paste(json)
    await user.click(screen.getByRole('button', { name: 'Check words' }))

    expect(await screen.findByText('2 of 3 words found in the dictionary')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Words to import' })).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText(/left out: 火龙果/)).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Zoo and fruit')

    await user.click(screen.getByRole('button', { name: 'Create set with 2 words' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Zoo and fruit' })).toBeInTheDocument()
    expect(loadCustomSets(storage)[0]).toMatchObject({ description: 'From an AI', itemIds: ['word:苹果', 'word:企鹅'] })
  })

  it('imports a plain list, asking for the name', async () => {
    const user = userEvent.setup()
    const storage = memoryStorage()
    renderAt('/study/custom/import', storage)
    await user.type(screen.getByRole('textbox', { name: 'Paste the set' }), '机场{Enter}学习')
    await user.click(screen.getByRole('button', { name: 'Check words' }))
    await user.type(await screen.findByLabelText('Name'), 'Travel')
    await user.click(screen.getByRole('button', { name: 'Create set with 2 words' }))
    expect(loadCustomSets(storage)[0]).toMatchObject({ name: 'Travel', itemIds: ['word:机场', 'word:学习'] })
  })
})
