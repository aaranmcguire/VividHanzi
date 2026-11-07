import {
  agree,
  beFor,
  beForNoun,
  beForPrice,
  byTransport,
  capitalize,
  doFor,
  haveFor,
  mediaObject,
  mediaPlural,
  nounA,
  nounObject,
  nounPlural,
  nounThe,
  numberWord,
  object,
  placeAt,
  placeTo,
  possessive,
  roleFor,
  subject,
  subjectAtStart,
  timeWord,
  verbBase,
  verbIng,
} from './english.ts'
import type { BuiltSentence, SentenceBuildContext, SentenceWord } from './types.ts'

/**
 * A sentence frame. `requires` lists the fixed words that must be learned;
 * `build` picks the rest from the learned vocabulary. Returning undefined
 * means the pattern can't be built with what the user knows.
 */
export interface SentencePattern {
  id: string
  /** 1: short and simple; 2: more words; 3: more grammar. */
  difficulty: 1 | 2 | 3
  requires: readonly string[]
  build: (ctx: SentenceBuildContext) => BuiltSentence | undefined
}

/** Picks two different people, but not "I" and "we" or "you" and "you". */
function twoPeople(ctx: SentenceBuildContext): [SentenceWord, SentenceWord] | undefined {
  const first = ctx.pick('person')
  if (!first) return undefined
  const second = ctx.pick('person', {
    exclude: [first],
    where: (candidate) => !samePerspective(first, candidate),
  })
  return second ? [first, second] : undefined
}

/** Two pronouns from the same point of view ("I" and "we", "you" and "you") make odd sentences. */
function samePerspective(a: SentenceWord, b: SentenceWord): boolean {
  return a.lexeme.person === b.lexeme.person && (a.lexeme.person === 1 || a.lexeme.person === 2)
}

/** Picks two different things. */
function twoThings(ctx: SentenceBuildContext): [SentenceWord, SentenceWord] | undefined {
  const first = ctx.pick('thing')
  if (!first) return undefined
  const second = ctx.pick('thing', { exclude: [first] })
  return second ? [first, second] : undefined
}

/** 去家 is not Chinese: going home uses 回家 (its own pattern). */
function canGoTo(place: SentenceWord): boolean {
  return place.lexeme.id !== '家'
}

export const SENTENCE_PATTERNS: readonly SentencePattern[] = [
  // --- Level 1: greetings and short statements ------------------------------
  {
    id: 'hello',
    difficulty: 1,
    requires: ['你好'],
    build: (ctx) => ctx.make([ctx.fixed('你好'), '！'], 'Hello!'),
  },
  {
    id: 'thanks',
    difficulty: 1,
    requires: ['谢谢'],
    build: (ctx) => ctx.make([ctx.fixed('谢谢'), '！'], 'Thank you!'),
  },
  {
    id: 'goodbye',
    difficulty: 1,
    requires: ['再见'],
    build: (ctx) => ctx.make([ctx.fixed('再见'), '！'], 'Goodbye!'),
  },
  {
    id: 'name',
    difficulty: 1,
    requires: ['你', '叫', '什么', '名字'],
    build: (ctx) =>
      ctx.make(
        [ctx.fixed('你'), ctx.fixed('叫'), ctx.fixed('什么'), ctx.fixed('名字'), '？'],
        'What is your name?',
      ),
  },
  {
    id: 'this-is-thing',
    difficulty: 1,
    requires: ['这', '是'],
    build: (ctx) => {
      const thing = ctx.pick('thing', { where: (candidate) => !candidate.lexeme.pluralOnly })
      if (!thing) return undefined
      return ctx.make(
        [ctx.fixed('这'), ctx.fixed('是'), thing, '。'],
        `This is ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'that-is-thing',
    difficulty: 1,
    requires: ['那', '是'],
    build: (ctx) => {
      const thing = ctx.pick('thing', { where: (candidate) => !candidate.lexeme.pluralOnly })
      if (!thing) return undefined
      return ctx.make(
        [ctx.fixed('那'), ctx.fixed('是'), thing, '。'],
        `That is ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'this-is-person',
    difficulty: 1,
    requires: ['这', '是'],
    build: (ctx) => {
      const person = ctx.pick('person', {
        where: (candidate) =>
          candidate.lexeme.pluralSubject !== true &&
          !candidate.lexeme.tags.includes('pronoun') &&
          !candidate.lexeme.tags.includes('family'),
      })
      if (!person) return undefined
      return ctx.make(
        [ctx.fixed('这'), ctx.fixed('是'), person, '。'],
        `This is ${subject(person)}.`,
      )
    },
  },
  {
    id: 'this-is-my-family',
    difficulty: 1,
    requires: ['这', '是', '我', '的'],
    build: (ctx) => {
      const family = ctx.pick('family')
      if (!family) return undefined
      return ctx.make(
        [ctx.fixed('这'), ctx.fixed('是'), ctx.fixed('我'), ctx.fixed('的'), family, '。'],
        `This is ${subject(family)}.`,
      )
    },
  },
  {
    id: 'person-is-role',
    difficulty: 1,
    requires: ['是'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const role = ctx.pick('role', { exclude: person ? [person] : [] })
      if (!person || !role) return undefined
      return ctx.make(
        [person, ctx.fixed('是'), role, '。'],
        `${subjectAtStart(person)} ${beFor(person)} ${roleFor(person, role)}.`,
      )
    },
  },
  {
    id: 'pronoun-is-family',
    difficulty: 1,
    requires: ['是', '我', '的'],
    build: (ctx) => {
      const person = ctx.pick('pronoun', { where: (candidate) => candidate.lexeme.person === 3 })
      if (!person) return undefined
      const family = ctx.pick('family', {
        where: (candidate) =>
          !person.lexeme.gender ||
          !candidate.lexeme.gender ||
          person.lexeme.gender === candidate.lexeme.gender,
      })
      if (!family) return undefined
      return ctx.make(
        [person, ctx.fixed('是'), ctx.fixed('我'), ctx.fixed('的'), family, '。'],
        `${subjectAtStart(person)} ${beFor(person)} ${subject(family)}.`,
      )
    },
  },
  {
    id: 'person-is-chinese',
    difficulty: 1,
    requires: ['是', '中国', '人'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('是'), ctx.fixed('中国'), ctx.fixed('人'), '。'],
        `${subjectAtStart(person)} ${beFor(person)} Chinese.`,
      )
    },
  },
  {
    id: 'person-from-place',
    difficulty: 1,
    requires: ['是', '人'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const place = ctx.pick('origin')
      if (!person || !place) return undefined
      return ctx.make(
        [person, ctx.fixed('是'), place, ctx.fixed('人'), '。'],
        `${subjectAtStart(person)} ${beFor(person)} from ${place.lexeme.en}.`,
      )
    },
  },
  {
    id: 'person-is-adjective',
    difficulty: 1,
    requires: ['很'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const adjective = ctx.pick('personAdjective')
      if (!person || !adjective) return undefined
      return ctx.make(
        [person, ctx.fixed('很'), adjective, '。'],
        `${subjectAtStart(person)} ${beFor(person)} ${adjective.lexeme.en}.`,
      )
    },
  },
  {
    id: 'thing-is-adjective',
    difficulty: 1,
    requires: ['很'],
    build: (ctx) => {
      const thing = ctx.pick('thing')
      const adjective = ctx.pick('thingAdjective')
      if (!thing || !adjective) return undefined
      return ctx.make(
        [thing, ctx.fixed('很'), adjective, '。'],
        `${capitalize(nounThe(thing))} ${beForNoun(thing)} ${adjective.lexeme.en}.`,
      )
    },
  },
  {
    id: 'possessive-thing-is-adjective',
    difficulty: 1,
    requires: ['的', '很'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const thing = ctx.pick('thing')
      const adjective = ctx.pick('thingAdjective')
      if (!person || !thing || !adjective) return undefined
      return ctx.make(
        [person, ctx.fixed('的'), thing, ctx.fixed('很'), adjective, '。'],
        `${capitalize(possessive(person))} ${thing.lexeme.en} ${beForNoun(thing)} ${adjective.lexeme.en}.`,
      )
    },
  },
  {
    id: 'i-intransitive',
    difficulty: 1,
    requires: ['我'],
    build: (ctx) => {
      const verb = ctx.pick('intransitive')
      if (!verb) return undefined
      return ctx.make([ctx.fixed('我'), verb, '。'], `I ${verbBase(verb)}.`)
    },
  },
  {
    id: 'i-eat',
    difficulty: 1,
    requires: ['我', '吃'],
    build: (ctx) => {
      const food = ctx.pick('food')
      if (!food) return undefined
      return ctx.make(
        [ctx.fixed('我'), ctx.fixed('吃'), food, '。'],
        `I eat ${nounObject(food)}.`,
      )
    },
  },
  {
    id: 'i-drink',
    difficulty: 1,
    requires: ['我', '喝'],
    build: (ctx) => {
      const drink = ctx.pick('drink')
      if (!drink) return undefined
      return ctx.make(
        [ctx.fixed('我'), ctx.fixed('喝'), drink, '。'],
        `I drink ${nounObject(drink)}.`,
      )
    },
  },
  {
    id: 'i-buy',
    difficulty: 1,
    requires: ['我', '买'],
    build: (ctx) => {
      const thing = ctx.pick('buyable')
      if (!thing) return undefined
      return ctx.make(
        [ctx.fixed('我'), ctx.fixed('买'), thing, '。'],
        `I buy ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'i-read',
    difficulty: 1,
    requires: ['我', '读'],
    build: (ctx) => {
      const reading = ctx.pick('reading')
      if (!reading) return undefined
      return ctx.make(
        [ctx.fixed('我'), ctx.fixed('读'), reading, '。'],
        `I read ${nounA(reading)}.`,
      )
    },
  },
  {
    id: 'i-watch',
    difficulty: 1,
    requires: ['我', '看'],
    build: (ctx) => {
      const media = ctx.pick('media')
      if (!media) return undefined
      return ctx.make(
        [ctx.fixed('我'), ctx.fixed('看'), media, '。'],
        `I watch ${mediaObject(media)}.`,
      )
    },
  },
  {
    id: 'i-write',
    difficulty: 1,
    requires: ['我', '写'],
    build: (ctx) => {
      const thing = ctx.pick('writeable')
      if (!thing) return undefined
      return ctx.make(
        [ctx.fixed('我'), ctx.fixed('写'), thing, '。'],
        `I write ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'person-likes-thing',
    difficulty: 1,
    requires: ['喜欢'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const thing = ctx.pick('thing')
      if (!person || !thing) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, thing, '。'],
        `${subjectAtStart(person)} ${agree(person, like)} ${nounPlural(thing)}.`,
      )
    },
  },
  {
    id: 'person-loves-thing',
    difficulty: 1,
    requires: ['爱'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const thing = ctx.pick('thing')
      if (!person || !thing) return undefined
      const love = ctx.fixed('爱')
      return ctx.make(
        [person, love, thing, '。'],
        `${subjectAtStart(person)} ${agree(person, love)} ${nounPlural(thing)}.`,
      )
    },
  },
  {
    id: 'person-likes-verb',
    difficulty: 1,
    requires: ['喜欢'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, verb, '。'],
        `${subjectAtStart(person)} ${agree(person, like)} ${verbIng(verb)}.`,
      )
    },
  },
  {
    id: 'person-wants-verb',
    difficulty: 1,
    requires: ['想'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      const want = ctx.fixed('想')
      return ctx.make(
        [person, want, verb, '。'],
        `${subjectAtStart(person)} ${agree(person, want)} to ${verbBase(verb)}.`,
      )
    },
  },
  {
    id: 'person-can-verb',
    difficulty: 1,
    requires: ['会'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('会'), verb, '。'],
        `${subjectAtStart(person)} can ${verbBase(verb)}.`,
      )
    },
  },
  {
    id: 'person-wants-thing',
    difficulty: 1,
    requires: ['要'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const thing = ctx.pick('buyable')
      if (!person || !thing) return undefined
      const want = ctx.fixed('要')
      return ctx.make(
        [person, want, thing, '。'],
        `${subjectAtStart(person)} ${agree(person, want)} ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'person-is-at-place',
    difficulty: 1,
    requires: ['在'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const place = ctx.pick('place')
      if (!person || !place) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), place, '。'],
        `${subjectAtStart(person)} ${beFor(person)} ${placeAt(place)}.`,
      )
    },
  },
  {
    id: 'person-goes-to-place',
    difficulty: 1,
    requires: ['去'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const place = ctx.pick('place', { where: canGoTo })
      if (!person || !place) return undefined
      const go = ctx.fixed('去')
      return ctx.make(
        [person, go, place, '。'],
        `${subjectAtStart(person)} ${agree(person, go)} ${placeTo(place)}.`,
      )
    },
  },
  {
    id: 'person-goes-home',
    difficulty: 1,
    requires: ['回', '家'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      const returnHome = ctx.fixed('回')
      return ctx.make(
        [person, returnHome, ctx.fixed('家'), '。'],
        `${subjectAtStart(person)} ${agree(person, returnHome)} home.`,
      )
    },
  },
  {
    id: 'person-wants-to-go-home',
    difficulty: 2,
    requires: ['想', '回', '家'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      const want = ctx.fixed('想')
      return ctx.make(
        [person, want, ctx.fixed('回'), ctx.fixed('家'), '。'],
        `${subjectAtStart(person)} ${agree(person, want)} to go home.`,
      )
    },
  },
  {
    id: 'person-has-thing',
    difficulty: 1,
    requires: ['有'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const thing = ctx.pick('thing')
      if (!person || !thing) return undefined
      return ctx.make(
        [person, ctx.fixed('有'), thing, '。'],
        `${subjectAtStart(person)} ${haveFor(person)} ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'place-has-thing',
    difficulty: 1,
    requires: ['有'],
    build: (ctx) => {
      const place = ctx.pick('place')
      const thing = ctx.pick('thing')
      if (!place || !thing) return undefined
      return ctx.make(
        [place, ctx.fixed('有'), thing, '。'],
        `There ${beForNoun(thing)} ${nounA(thing)} ${placeAt(place)}.`,
      )
    },
  },
  {
    id: 'person-not-adjective',
    difficulty: 1,
    requires: ['不'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const adjective = ctx.pick('personAdjective')
      if (!person || !adjective) return undefined
      return ctx.make(
        [person, ctx.fixed('不'), adjective, '。'],
        `${subjectAtStart(person)} ${beFor(person)} not ${adjective.lexeme.en}.`,
      )
    },
  },
  {
    id: 'person-not-verb',
    difficulty: 1,
    requires: ['不'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('不'), verb, '。'],
        `${subjectAtStart(person)} ${doFor(person)}n't ${verbBase(verb)}.`,
      )
    },
  },
  {
    id: 'person-did-not-verb',
    difficulty: 1,
    requires: ['没'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('没'), verb, '。'],
        `${subjectAtStart(person)} didn't ${verbBase(verb)}.`,
      )
    },
  },
  {
    id: 'do-you-verb',
    difficulty: 1,
    requires: ['你', '吗'],
    build: (ctx) => {
      const verb = ctx.pick('actionVerb')
      if (!verb) return undefined
      return ctx.make(
        [ctx.fixed('你'), verb, ctx.fixed('吗'), '？'],
        `Do you ${verbBase(verb)}?`,
      )
    },
  },
  {
    id: 'are-you-adjective',
    difficulty: 1,
    requires: ['你', '吗'],
    build: (ctx) => {
      const adjective = ctx.pick('personAdjective')
      if (!adjective) return undefined
      return ctx.make(
        [ctx.fixed('你'), adjective, ctx.fixed('吗'), '？'],
        `Are you ${adjective.lexeme.en}?`,
      )
    },
  },
  {
    id: 'how-much',
    difficulty: 1,
    requires: ['多少', '钱'],
    build: (ctx) => {
      const thing = ctx.pick('thing')
      if (!thing) return undefined
      return ctx.make(
        [thing, ctx.fixed('多少'), ctx.fixed('钱'), '？'],
        `How much ${beForPrice(thing)} ${nounThe(thing)}?`,
      )
    },
  },
  {
    id: 'person-lives-at-place',
    difficulty: 1,
    requires: ['住', '在'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const place = ctx.pick('residence')
      if (!person || !place) return undefined
      const live = ctx.fixed('住')
      return ctx.make(
        [person, live, ctx.fixed('在'), place, '。'],
        `${subjectAtStart(person)} ${agree(person, live)} ${placeAt(place)}.`,
      )
    },
  },
  {
    id: 'today-is-weather',
    difficulty: 1,
    requires: ['今天', '很'],
    build: (ctx) => {
      const adjective = ctx.pick('weatherAdjective')
      if (!adjective) return undefined
      return ctx.make(
        [ctx.fixed('今天'), ctx.fixed('很'), adjective, '。'],
        `It is ${adjective.lexeme.en} today.`,
      )
    },
  },
  {
    id: 'today-weather-is',
    difficulty: 1,
    requires: ['今天', '天气', '很'],
    build: (ctx) => {
      const adjective = ctx.pick('weatherAdjective')
      if (!adjective) return undefined
      return ctx.make(
        [ctx.fixed('今天'), ctx.fixed('天气'), ctx.fixed('很'), adjective, '。'],
        `The weather is ${adjective.lexeme.en} today.`,
      )
    },
  },
  {
    id: 'person-gives-thing',
    difficulty: 1,
    requires: ['给'],
    build: (ctx) => {
      const people = twoPeople(ctx)
      const thing = ctx.pick('thing')
      if (!people || !thing) return undefined
      const [person, other] = people
      const give = ctx.fixed('给')
      return ctx.make(
        [person, give, other, thing, '。'],
        `${subjectAtStart(person)} ${agree(person, give)} ${object(other)} ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'person-works-at-place',
    difficulty: 1,
    requires: ['在'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const place = ctx.pick('place')
      const verb = ctx.pick('atPlace')
      if (!person || !place || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), place, verb, '。'],
        `${subjectAtStart(person)} ${agree(person, verb)} ${placeAt(place)}.`,
      )
    },
  },
  {
    id: 'person-also-verb',
    difficulty: 1,
    requires: ['也'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('也'), verb, '。'],
        `${subjectAtStart(person)} also ${agree(person, verb)}.`,
      )
    },
  },
  {
    id: 'food-is-delicious',
    difficulty: 1,
    requires: ['好吃'],
    build: (ctx) => {
      const food = ctx.pick('food')
      if (!food) return undefined
      return ctx.make(
        [food, ctx.fixed('很'), ctx.fixed('好吃'), '。'],
        `${capitalize(nounThe(food))} ${beForNoun(food)} delicious.`,
      )
    },
  },
  {
    id: 'person-likes-eating',
    difficulty: 1,
    requires: ['喜欢', '吃'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const food = ctx.pick('food')
      if (!person || !food) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, ctx.fixed('吃'), food, '。'],
        `${subjectAtStart(person)} ${agree(person, like)} eating ${nounObject(food)}.`,
      )
    },
  },
  {
    id: 'person-likes-drinking',
    difficulty: 1,
    requires: ['喜欢', '喝'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const drink = ctx.pick('drink')
      if (!person || !drink) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, ctx.fixed('喝'), drink, '。'],
        `${subjectAtStart(person)} ${agree(person, like)} drinking ${nounObject(drink)}.`,
      )
    },
  },
  {
    id: 'person-likes-watching',
    difficulty: 1,
    requires: ['喜欢', '看'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const media = ctx.pick('media')
      if (!person || !media) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, ctx.fixed('看'), media, '。'],
        `${subjectAtStart(person)} ${agree(person, like)} watching ${mediaPlural(media)}.`,
      )
    },
  },
  {
    id: 'person-likes-reading',
    difficulty: 1,
    requires: ['喜欢', '读', '书'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, ctx.fixed('读'), ctx.fixed('书'), '。'],
        `${subjectAtStart(person)} ${agree(person, like)} reading books.`,
      )
    },
  },
  {
    id: 'person-likes-singing',
    difficulty: 1,
    requires: ['喜欢', '唱歌'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, ctx.fixed('唱歌'), '。'],
        `${subjectAtStart(person)} ${agree(person, like)} singing.`,
      )
    },
  },
  {
    id: 'person-likes-dancing',
    difficulty: 1,
    requires: ['喜欢', '跳舞'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, ctx.fixed('跳舞'), '。'],
        `${subjectAtStart(person)} ${agree(person, like)} dancing.`,
      )
    },
  },
  {
    id: 'person-likes-swimming',
    difficulty: 1,
    requires: ['喜欢', '游泳'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, ctx.fixed('游泳'), '。'],
        `${subjectAtStart(person)} ${agree(person, like)} swimming.`,
      )
    },
  },
  {
    id: 'person-likes-running',
    difficulty: 1,
    requires: ['喜欢', '跑步'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, like, ctx.fixed('跑步'), '。'],
        `${subjectAtStart(person)} ${agree(person, like)} running.`,
      )
    },
  },
  {
    id: 'person-is-studying-chinese',
    difficulty: 1,
    requires: ['在', '学习', '汉语'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), ctx.fixed('学习'), ctx.fixed('汉语'), '。'],
        `${subjectAtStart(person)} ${beFor(person)} studying Chinese.`,
      )
    },
  },
  {
    id: 'person-is-working',
    difficulty: 1,
    requires: ['在', '工作'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), ctx.fixed('工作'), '。'],
        `${subjectAtStart(person)} ${beFor(person)} working.`,
      )
    },
  },
  {
    id: 'person-is-sleeping',
    difficulty: 1,
    requires: ['在', '睡觉'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), ctx.fixed('睡觉'), '。'],
        `${subjectAtStart(person)} ${beFor(person)} sleeping.`,
      )
    },
  },
  {
    id: 'person-is-reading',
    difficulty: 1,
    requires: ['在', '看', '书'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), ctx.fixed('看'), ctx.fixed('书'), '。'],
        `${subjectAtStart(person)} ${beFor(person)} reading a book.`,
      )
    },
  },
  {
    id: 'person-is-watching-tv',
    difficulty: 1,
    requires: ['在', '看', '电视'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), ctx.fixed('看'), ctx.fixed('电视'), '。'],
        `${subjectAtStart(person)} ${beFor(person)} watching TV.`,
      )
    },
  },
  {
    id: 'person-is-calling',
    difficulty: 1,
    requires: ['在', '打电话'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), ctx.fixed('打电话'), '。'],
        `${subjectAtStart(person)} ${beFor(person)} making a phone call.`,
      )
    },
  },

  // --- Level 2: longer sentences and more grammar ---------------------------
  {
    id: 'person-is-role-question',
    difficulty: 2,
    requires: ['是', '吗'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const role = ctx.pick('role', { exclude: person ? [person] : [] })
      if (!person || !role) return undefined
      return ctx.make(
        [person, ctx.fixed('是'), role, ctx.fixed('吗'), '？'],
        `${capitalize(beFor(person))} ${subject(person)} ${roleFor(person, role)}?`,
      )
    },
  },
  {
    id: 'person-is-not-role',
    difficulty: 2,
    requires: ['不', '是'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const role = ctx.pick('role', { exclude: person ? [person] : [] })
      if (!person || !role) return undefined
      return ctx.make(
        [person, ctx.fixed('不'), ctx.fixed('是'), role, '。'],
        `${subjectAtStart(person)} ${beFor(person)} not ${roleFor(person, role)}.`,
      )
    },
  },
  {
    id: 'person-does-not-have',
    difficulty: 2,
    requires: ['没', '有'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const thing = ctx.pick('thing')
      if (!person || !thing) return undefined
      return ctx.make(
        [person, ctx.fixed('没'), ctx.fixed('有'), thing, '。'],
        `${subjectAtStart(person)} ${doFor(person)}n't have ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'place-does-not-have',
    difficulty: 2,
    requires: ['没', '有'],
    build: (ctx) => {
      const place = ctx.pick('place')
      const thing = ctx.pick('thing')
      if (!place || !thing) return undefined
      return ctx.make(
        [place, ctx.fixed('没'), ctx.fixed('有'), thing, '。'],
        `There ${beForNoun(thing)} no ${nounA(thing)} ${placeAt(place)}.`,
      )
    },
  },
  {
    id: 'person-wants-to-go',
    difficulty: 2,
    requires: ['想', '去'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const place = ctx.pick('place', { where: canGoTo })
      if (!person || !place) return undefined
      const want = ctx.fixed('想')
      return ctx.make(
        [person, want, ctx.fixed('去'), place, '。'],
        `${subjectAtStart(person)} ${agree(person, want)} to go ${placeTo(place)}.`,
      )
    },
  },
  {
    id: 'person-wants-to-buy',
    difficulty: 2,
    requires: ['想', '买'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const thing = ctx.pick('buyable')
      if (!person || !thing) return undefined
      const want = ctx.fixed('想')
      return ctx.make(
        [person, want, ctx.fixed('买'), thing, '。'],
        `${subjectAtStart(person)} ${agree(person, want)} to buy ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'person-wants-to-eat',
    difficulty: 2,
    requires: ['想', '吃'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const food = ctx.pick('food')
      if (!person || !food) return undefined
      const want = ctx.fixed('想')
      return ctx.make(
        [person, want, ctx.fixed('吃'), food, '。'],
        `${subjectAtStart(person)} ${agree(person, want)} to eat ${nounObject(food)}.`,
      )
    },
  },
  {
    id: 'person-wants-to-drink',
    difficulty: 2,
    requires: ['想', '喝'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const drink = ctx.pick('drink')
      if (!person || !drink) return undefined
      const want = ctx.fixed('想')
      return ctx.make(
        [person, want, ctx.fixed('喝'), drink, '。'],
        `${subjectAtStart(person)} ${agree(person, want)} to drink ${nounObject(drink)}.`,
      )
    },
  },
  {
    id: 'person-thinks-thing-is',
    difficulty: 2,
    requires: ['觉得', '很'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const thing = ctx.pick('thing')
      const adjective = ctx.pick('thingAdjective')
      if (!person || !thing || !adjective) return undefined
      const think = ctx.fixed('觉得')
      return ctx.make(
        [person, think, thing, ctx.fixed('很'), adjective, '。'],
        `${subjectAtStart(person)} ${agree(person, think)} ${nounThe(thing)} ${beForNoun(thing)} ${adjective.lexeme.en}.`,
      )
    },
  },
  {
    id: 'person-knows-person',
    difficulty: 2,
    requires: ['认识'],
    build: (ctx) => {
      const people = twoPeople(ctx)
      if (!people) return undefined
      const [person, other] = people
      const know = ctx.fixed('认识')
      return ctx.make(
        [person, know, other, '。'],
        `${subjectAtStart(person)} ${agree(person, know)} ${object(other)}.`,
      )
    },
  },
  {
    id: 'person-helps-person',
    difficulty: 2,
    requires: ['帮助'],
    build: (ctx) => {
      const people = twoPeople(ctx)
      if (!people) return undefined
      const [person, other] = people
      const help = ctx.fixed('帮助')
      return ctx.make(
        [person, help, other, '。'],
        `${subjectAtStart(person)} ${agree(person, help)} ${object(other)}.`,
      )
    },
  },
  {
    id: 'person-hopes-to-verb',
    difficulty: 2,
    requires: ['希望'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      const hope = ctx.fixed('希望')
      return ctx.make(
        [person, hope, verb, '。'],
        `${subjectAtStart(person)} ${agree(person, hope)} to ${verbBase(verb)}.`,
      )
    },
  },
  {
    id: 'person-invites-person-to-eat',
    difficulty: 2,
    requires: ['请', '吃'],
    build: (ctx) => {
      const people = twoPeople(ctx)
      const food = ctx.pick('food')
      if (!people || !food) return undefined
      const [person, other] = people
      const invite = ctx.fixed('请')
      return ctx.make(
        [person, invite, other, ctx.fixed('吃'), food, '。'],
        `${subjectAtStart(person)} ${agree(person, invite)} ${object(other)} to eat ${nounObject(food)}.`,
      )
    },
  },
  {
    id: 'person-gives-person-thing',
    difficulty: 2,
    requires: ['送'],
    build: (ctx) => {
      const people = twoPeople(ctx)
      const thing = ctx.pick('thing')
      if (!people || !thing) return undefined
      const [person, other] = people
      const give = ctx.fixed('送')
      return ctx.make(
        [person, give, other, thing, '。'],
        `${subjectAtStart(person)} ${agree(person, give)} ${object(other)} ${nounA(thing)}.`,
      )
    },
  },
  {
    id: 'person-calls-person',
    difficulty: 2,
    requires: ['打电话', '给'],
    build: (ctx) => {
      const people = twoPeople(ctx)
      if (!people) return undefined
      const [person, other] = people
      const call = ctx.fixed('打电话')
      return ctx.make(
        [person, call, ctx.fixed('给'), other, '。'],
        `${subjectAtStart(person)} ${agree(person, call)} ${object(other)}.`,
      )
    },
  },
  {
    id: 'what-is-person-doing',
    difficulty: 2,
    requires: ['在', '做', '什么'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), ctx.fixed('做'), ctx.fixed('什么'), '？'],
        `What ${beFor(person)} ${subject(person)} doing?`,
      )
    },
  },
  {
    id: 'when-does-person-verb',
    difficulty: 2,
    requires: ['什么', '时候'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('什么'), ctx.fixed('时候'), verb, '？'],
        `When ${doFor(person)} ${subject(person)} ${verbBase(verb)}?`,
      )
    },
  },
  {
    id: 'why-does-person-verb',
    difficulty: 2,
    requires: ['为什么'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('为什么'), verb, '？'],
        `Why ${doFor(person)} ${subject(person)} ${verbBase(verb)}?`,
      )
    },
  },
  {
    id: 'how-does-person-get-to-place',
    difficulty: 2,
    requires: ['怎么', '去'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const place = ctx.pick('place', { where: canGoTo })
      if (!person || !place) return undefined
      return ctx.make(
        [person, ctx.fixed('怎么'), ctx.fixed('去'), place, '？'],
        `How ${doFor(person)} ${subject(person)} get ${placeTo(place)}?`,
      )
    },
  },
  {
    id: 'does-person-want-to-verb',
    difficulty: 2,
    requires: ['要', '吗'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('要'), verb, ctx.fixed('吗'), '？'],
        `${capitalize(doFor(person))} ${subject(person)} want to ${verbBase(verb)}?`,
      )
    },
  },
  {
    id: 'person-is-verbing',
    difficulty: 2,
    requires: ['正在'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('progressive')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('正在'), verb, '。'],
        `${subjectAtStart(person)} ${beFor(person)} ${verbIng(verb)}.`,
      )
    },
  },
  {
    id: 'person-is-verbing-at',
    difficulty: 2,
    requires: ['在'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('progressive')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('在'), verb, '。'],
        `${subjectAtStart(person)} ${beFor(person)} ${verbIng(verb)}.`,
      )
    },
  },
  {
    id: 'person-all-verb',
    difficulty: 2,
    requires: ['都'],
    build: (ctx) => {
      const person = ctx.pick('person', { where: (candidate) => candidate.lexeme.pluralSubject === true })
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('都'), verb, '。'],
        `${subjectAtStart(person)} all ${verbBase(verb)}.`,
      )
    },
  },
  {
    id: 'person-good-at-verb',
    difficulty: 2,
    requires: ['很', '会'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('很'), ctx.fixed('会'), verb, '。'],
        `${subjectAtStart(person)} ${beFor(person)} good at ${verbIng(verb)}.`,
      )
    },
  },
  {
    id: 'person-likes-thing-most',
    difficulty: 2,
    requires: ['最', '喜欢'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const thing = ctx.pick('thing')
      if (!person || !thing) return undefined
      const like = ctx.fixed('喜欢')
      return ctx.make(
        [person, ctx.fixed('最'), like, thing, '。'],
        `${subjectAtStart(person)} ${agree(person, like)} ${nounPlural(thing)} the most.`,
      )
    },
  },
  {
    id: 'thing-is-more-expensive',
    difficulty: 2,
    requires: ['比', '贵'],
    build: (ctx) => {
      const things = twoThings(ctx)
      if (!things) return undefined
      const [thing, other] = things
      return ctx.make(
        [thing, ctx.fixed('比'), other, ctx.fixed('贵'), '。'],
        `${capitalize(nounThe(thing))} ${beForNoun(thing)} more expensive than ${nounThe(other)}.`,
      )
    },
  },
  {
    id: 'person-is-taller',
    difficulty: 2,
    requires: ['比', '高'],
    build: (ctx) => {
      const people = twoPeople(ctx)
      if (!people) return undefined
      const [person, other] = people
      return ctx.make(
        [person, ctx.fixed('比'), other, ctx.fixed('高'), '。'],
        `${subjectAtStart(person)} ${beFor(person)} taller than ${object(other)}.`,
      )
    },
  },
  {
    id: 'how-does-person-feel',
    difficulty: 2,
    requires: ['觉得', '怎么样'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('觉得'), ctx.fixed('怎么样'), '？'],
        `How ${doFor(person)} ${subject(person)} feel?`,
      )
    },
  },
  {
    id: 'how-is-person-health',
    difficulty: 2,
    requires: ['身体', '怎么样'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('身体'), ctx.fixed('怎么样'), '？'],
        `How is ${possessive(person)} health?`,
      )
    },
  },
  {
    id: 'how-old-is-person',
    difficulty: 2,
    requires: ['多', '大', '了'],
    build: (ctx) => {
      const person = ctx.pick('person')
      if (!person) return undefined
      return ctx.make(
        [person, ctx.fixed('多'), ctx.fixed('大'), ctx.fixed('了'), '？'],
        `How old ${beFor(person)} ${subject(person)}?`,
      )
    },
  },
  {
    id: 'what-time-does-person-verb',
    difficulty: 2,
    requires: ['几', '点'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const verb = ctx.pick('actionVerb')
      if (!person || !verb) return undefined
      return ctx.make(
        [person, ctx.fixed('几'), ctx.fixed('点'), verb, '？'],
        `What time ${doFor(person)} ${subject(person)} ${verbBase(verb)}?`,
      )
    },
  },
  {
    id: 'person-has-number-things',
    difficulty: 2,
    requires: ['有'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const number = ctx.pick('number')
      const thing = ctx.pick('thing', {
        where: (candidate) => {
          const measure = candidate.lexeme.measure
          return (
            measure !== undefined &&
            !candidate.lexeme.uncountable &&
            !candidate.lexeme.pluralOnly &&
            ctx.has(measure)
          )
        },
      })
      const measure = thing?.lexeme.measure
      if (!person || !number || !thing || !measure) return undefined
      return ctx.make(
        [person, ctx.fixed('有'), number, ctx.fixed(measure), thing, '。'],
        `${subjectAtStart(person)} ${haveFor(person)} ${numberWord(number)} ${nounPlural(thing)}.`,
      )
    },
  },
  {
    id: 'what-time-is-it',
    difficulty: 2,
    requires: ['现在', '点'],
    build: (ctx) => {
      // 两点 is the natural reading; 二点 is avoided
      const number = ctx.pick('number', { where: (candidate) => candidate.lexeme.id !== '二' })
      if (!number) return undefined
      return ctx.make(
        [ctx.fixed('现在'), number, ctx.fixed('点'), '。'],
        `It is ${numberWord(number)} o'clock now.`,
      )
    },
  },
  {
    id: 'time-i-verb',
    difficulty: 2,
    requires: ['我'],
    build: (ctx) => {
      const time = ctx.pick('time', {
        where: (candidate) => candidate.lexeme.id !== '昨天' && candidate.lexeme.id !== '去年',
      })
      const verb = ctx.pick('intransitive')
      if (!time || !verb) return undefined
      return ctx.make(
        [time, ctx.fixed('我'), verb, '。'],
        `I ${verbBase(verb)} ${timeWord(time)}.`,
      )
    },
  },

  // --- Level 3: comparisons, clauses and longer questions -------------------
  {
    id: 'person-and-person-are-friends',
    difficulty: 3,
    requires: ['和', '是', '朋友'],
    build: (ctx) => {
      const first = ctx.pick('pronoun', { where: (candidate) => candidate.lexeme.pluralSubject !== true })
      if (!first) return undefined
      const second = ctx.pick('pronoun', {
        exclude: [first],
        where: (candidate) =>
          candidate.lexeme.pluralSubject !== true && !samePerspective(first, candidate),
      })
      if (!second) return undefined
      // "He and I", "You and I": English puts the other person first
      const pair =
        first.lexeme.person === 1 && second.lexeme.person !== 1
          ? `${capitalize(subject(second))} and ${subject(first)}`
          : `${capitalize(subject(first))} and ${subject(second)}`
      return ctx.make(
        [first, ctx.fixed('和'), second, ctx.fixed('是'), ctx.fixed('朋友'), '。'],
        `${pair} are friends.`,
      )
    },
  },
  {
    id: 'person-takes-transport-to-place',
    difficulty: 3,
    requires: ['坐', '去'],
    build: (ctx) => {
      const person = ctx.pick('person')
      const place = ctx.pick('place', { where: canGoTo })
      if (!person || !place) return undefined
      // Planes and boats only make sense for far-away places like China;
      // taxis, buses and bicycles don't for a whole country.
      const longDistance = place.lexeme.tags.includes('origin')
      const transport = ctx.pick('transport', {
        where: (candidate) =>
          longDistance
            ? candidate.lexeme.id === '飞机' || candidate.lexeme.id === '船'
            : candidate.lexeme.id !== '飞机' && candidate.lexeme.id !== '船',
      })
      if (!transport) return undefined
      const go = ctx.fixed('去')
      return ctx.make(
        [person, ctx.fixed('坐'), transport, go, place, '。'],
        `${subjectAtStart(person)} ${agree(person, go)} ${placeTo(place)} ${byTransport(transport)}.`,
      )
    },
  },
]
