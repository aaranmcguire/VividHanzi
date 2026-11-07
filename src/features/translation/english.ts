import type { SentenceWord } from './types.ts'

/** "book" → "a book", "apple" → "an apple", "tea" → "tea". */
export function nounA(word: SentenceWord): string {
  const { en, uncountable, pluralOnly } = word.lexeme
  if (uncountable || pluralOnly) return en
  return `${article(en)} ${en}`
}

/** "book" → "the book", "Beijing" → "Beijing", "clothes" → "the clothes". */
export function nounThe(word: SentenceWord): string {
  const { en, proper } = word.lexeme
  return proper ? en : `the ${en}`
}

/** "book" → "books", "clothes" → "clothes", "tea" → "tea". */
export function nounPlural(word: SentenceWord): string {
  const { en, uncountable, pluralOnly, plural } = word.lexeme
  if (uncountable || pluralOnly) return en
  return plural ?? pluralize(en)
}

/** A noun after a verb: "I eat apples", "I drink tea". */
export function nounObject(word: SentenceWord): string {
  return nounPlural(word)
}

/** The subject form: "I", "he", "my mother", "the teacher". */
export function subject(word: SentenceWord): string {
  // Roles are stored without an article ("teacher") because they also appear
  // as "a teacher"; as a subject they are definite.
  return word.lexeme.tags.includes('role') ? `the ${word.lexeme.en}` : word.lexeme.en
}

/** The subject form with a capital letter, for the start of a sentence. */
export function subjectAtStart(word: SentenceWord): string {
  return capitalize(subject(word))
}

/** The object form: "me", "him", "my mother", "the teacher". */
export function object(word: SentenceWord): string {
  return word.lexeme.object ?? word.lexeme.en
}

/** The possessive form: "my", "his", "my mother's". */
export function possessive(word: SentenceWord): string {
  return word.lexeme.possessive ?? `${word.lexeme.en}'s`
}

/** "am", "is" or "are". Things and places count as third person singular. */
export function beFor(word: SentenceWord): string {
  if (word.lexeme.person === 1 && !word.lexeme.pluralSubject) return 'am'
  if (word.lexeme.person === 2 || word.lexeme.pluralSubject) return 'are'
  return 'is'
}

/** "is" or "are" for a noun phrase: "the clothes are", "the book is". */
export function beForNoun(word: SentenceWord): string {
  return word.lexeme.pluralOnly ? 'are' : 'is'
}

/** "is" or "are" for "How much is/are the ...?" */
export function beForPrice(word: SentenceWord): string {
  return beForNoun(word)
}

/** "have" or "has". */
export function haveFor(word: SentenceWord): string {
  return isThirdSingular(word) ? 'has' : 'have'
}

/** "do" or "does". */
export function doFor(word: SentenceWord): string {
  return isThirdSingular(word) ? 'does' : 'do'
}

/** Third person singular (he, she, the teacher, a thing), but not I/you/we/they. */
export function isThirdSingular(word: SentenceWord): boolean {
  return word.lexeme.person !== 1 && word.lexeme.person !== 2 && !word.lexeme.pluralSubject
}

/** The verb that agrees with the subject: "I eat", "he eats". */
export function agree(subjectWord: SentenceWord, verb: SentenceWord): string {
  return isThirdSingular(subjectWord) ? verbThird(verb) : verbBase(verb)
}

export function verbBase(word: SentenceWord): string {
  return word.lexeme.en
}

export function verbThird(word: SentenceWord): string {
  return word.lexeme.third ?? addS(word.lexeme.en)
}

export function verbIng(word: SentenceWord): string {
  return word.lexeme.gerund ?? addIng(word.lexeme.en)
}

/** "at home", "in Beijing", "at the restaurant". */
export function placeAt(word: SentenceWord): string {
  return word.lexeme.at ?? `at ${nounThe(word)}`
}

/** "home", "to Beijing", "to the restaurant". */
export function placeTo(word: SentenceWord): string {
  return word.lexeme.to ?? `to ${nounThe(word)}`
}

/** "by taxi", "by bus". */
export function byTransport(word: SentenceWord): string {
  return word.lexeme.by ?? `by ${word.lexeme.en}`
}

/** "a teacher", "teachers": a role after "is/are". */
export function roleFor(subjectWord: SentenceWord, role: SentenceWord): string {
  return subjectWord.lexeme.pluralSubject ? nounPlural(role) : nounA(role)
}

/** "TV", "a movie": the object of "watch". */
export function mediaObject(word: SentenceWord): string {
  return nounA(word)
}

/** "TV", "movies": the object of "like watching". */
export function mediaPlural(word: SentenceWord): string {
  return nounPlural(word)
}

export function numberWord(word: SentenceWord): string {
  return word.lexeme.en
}

export function timeWord(word: SentenceWord): string {
  return word.lexeme.en
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

function pluralize(word: string): string {
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`
  return `${word}s`
}

function addS(word: string): string {
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`
  return `${word}s`
}

function addIng(word: string): string {
  if (/ie$/i.test(word)) return `${word.slice(0, -2)}ying`
  if (/e$/i.test(word) && !/ee$/i.test(word)) return `${word.slice(0, -1)}ing`
  return `${word}ing`
}
