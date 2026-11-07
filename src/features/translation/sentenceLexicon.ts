import type { SentenceLexeme, SentenceTag } from './types.ts'

/**
 * The words the sentence builder knows how to use, with the English forms
 * its translations need. It is deliberately a subset of HSK 1-4: a sentence
 * only uses words the user has learned, and only words whose grammar and
 * translation fit a pattern. Adding a word here makes it available in
 * sentences as soon as the user learns it.
 *
 * The hanzi, pinyin and meanings are not copied: they come from the
 * dictionary by `id`.
 */
function lex(id: string, en: string, tags: readonly SentenceTag[], extra: Partial<SentenceLexeme> = {}): SentenceLexeme {
  return { id, en, tags, ...extra }
}

export const SENTENCE_LEXICON: readonly SentenceLexeme[] = [
  // --- People ---------------------------------------------------------------
  lex('我', 'I', ['person', 'pronoun'], { person: 1, object: 'me', possessive: 'my' }),
  lex('你', 'you', ['person', 'pronoun'], { person: 2, object: 'you', possessive: 'your' }),
  lex('您', 'you', ['person', 'pronoun'], { person: 2, object: 'you', possessive: 'your' }),
  lex('他', 'he', ['person', 'pronoun'], {
    person: 3,
    gender: 'm',
    object: 'him',
    possessive: 'his',
  }),
  lex('她', 'she', ['person', 'pronoun'], {
    person: 3,
    gender: 'f',
    object: 'her',
    possessive: 'her',
  }),
  lex('我们', 'we', ['person', 'pronoun'], {
    person: 1,
    pluralSubject: true,
    object: 'us',
    possessive: 'our',
  }),
  lex('老师', 'teacher', ['person', 'role'], {
    person: 3,
    object: 'the teacher',
    possessive: "the teacher's",
  }),
  lex('学生', 'student', ['person', 'role'], {
    person: 3,
    object: 'the student',
    possessive: "the student's",
  }),
  lex('医生', 'doctor', ['person', 'role'], {
    person: 3,
    object: 'the doctor',
    possessive: "the doctor's",
  }),
  lex('服务员', 'waiter', ['person', 'role'], {
    person: 3,
    object: 'the waiter',
    possessive: "the waiter's",
  }),
  lex('朋友', 'my friend', ['person', 'family'], {
    person: 3,
    object: 'my friend',
    possessive: "my friend's",
  }),
  lex('爸爸', 'my father', ['person', 'family'], {
    person: 3,
    gender: 'm',
    object: 'my father',
    possessive: "my father's",
  }),
  lex('妈妈', 'my mother', ['person', 'family'], {
    person: 3,
    gender: 'f',
    object: 'my mother',
    possessive: "my mother's",
  }),
  lex('哥哥', 'my older brother', ['person', 'family'], {
    person: 3,
    gender: 'm',
    object: 'my older brother',
    possessive: "my older brother's",
  }),
  lex('姐姐', 'my older sister', ['person', 'family'], {
    person: 3,
    gender: 'f',
    object: 'my older sister',
    possessive: "my older sister's",
  }),
  lex('弟弟', 'my younger brother', ['person', 'family'], {
    person: 3,
    gender: 'm',
    object: 'my younger brother',
    possessive: "my younger brother's",
  }),
  lex('妹妹', 'my younger sister', ['person', 'family'], {
    person: 3,
    gender: 'f',
    object: 'my younger sister',
    possessive: "my younger sister's",
  }),
  lex('儿子', 'my son', ['person', 'family'], {
    person: 3,
    gender: 'm',
    object: 'my son',
    possessive: "my son's",
  }),
  lex('女儿', 'my daughter', ['person', 'family'], {
    person: 3,
    gender: 'f',
    object: 'my daughter',
    possessive: "my daughter's",
  }),
  lex('同学', 'my classmate', ['person', 'family'], {
    person: 3,
    object: 'my classmate',
    possessive: "my classmate's",
  }),
  lex('孩子', 'the child', ['person'], {
    person: 3,
    object: 'the child',
    possessive: "the child's",
  }),
  lex('男人', 'the man', ['person'], {
    person: 3,
    gender: 'm',
    object: 'the man',
    possessive: "the man's",
  }),
  lex('女人', 'the woman', ['person'], {
    person: 3,
    gender: 'f',
    object: 'the woman',
    possessive: "the woman's",
  }),
  lex('妻子', 'my wife', ['person', 'family'], {
    person: 3,
    gender: 'f',
    object: 'my wife',
    possessive: "my wife's",
  }),
  lex('丈夫', 'my husband', ['person', 'family'], {
    person: 3,
    gender: 'm',
    object: 'my husband',
    possessive: "my husband's",
  }),

  // --- Places ---------------------------------------------------------------
  lex('家', 'home', ['place', 'residence'], { at: 'at home', to: 'home' }),
  lex('学校', 'school', ['place', 'residence'], { at: 'at school', to: 'to school' }),
  lex('饭馆', 'restaurant', ['place'], { at: 'at the restaurant', to: 'to the restaurant' }),
  lex('商店', 'shop', ['place'], { at: 'at the shop', to: 'to the shop' }),
  lex('医院', 'hospital', ['place'], { at: 'at the hospital', to: 'to the hospital' }),
  lex('北京', 'Beijing', ['place', 'origin', 'residence'], {
    at: 'in Beijing',
    to: 'to Beijing',
    proper: true,
  }),
  lex('中国', 'China', ['place', 'origin', 'residence'], {
    at: 'in China',
    to: 'to China',
    proper: true,
  }),
  lex('火车站', 'train station', ['place'], {
    at: 'at the train station',
    to: 'to the train station',
  }),
  lex('机场', 'airport', ['place'], { at: 'at the airport', to: 'to the airport' }),
  lex('教室', 'classroom', ['place'], { at: 'in the classroom', to: 'to the classroom' }),
  lex('房间', 'room', ['place'], { at: 'in the room', to: 'to the room' }),
  lex('公司', 'company', ['place'], { at: 'at the company', to: 'to the company' }),
  lex('图书馆', 'library', ['place'], { at: 'at the library', to: 'to the library' }),
  lex('公园', 'park', ['place'], { at: 'in the park', to: 'to the park' }),

  // --- Things ---------------------------------------------------------------
  lex('书', 'book', ['thing', 'buyable', 'reading'], { measure: '本' }),
  lex('杯子', 'cup', ['thing', 'buyable'], { measure: '个' }),
  lex('电脑', 'computer', ['thing', 'buyable'], { measure: '个' }),
  lex('手机', 'phone', ['thing', 'buyable'], { measure: '个' }),
  lex('手表', 'watch', ['thing', 'buyable'], { measure: '个' }),
  lex('桌子', 'table', ['thing', 'buyable'], { measure: '张' }),
  lex('椅子', 'chair', ['thing', 'buyable'], { measure: '个' }),
  lex('门', 'door', ['thing', 'buyable'], { measure: '个' }),
  lex('狗', 'dog', ['thing', 'buyable'], { measure: '只' }),
  lex('猫', 'cat', ['thing', 'buyable'], { measure: '只' }),
  lex('报纸', 'newspaper', ['thing', 'buyable', 'reading'], { measure: '张' }),
  lex('票', 'ticket', ['thing', 'buyable'], { measure: '张' }),
  lex('名字', 'name', ['writeable'], { measure: '个' }),
  lex('字', 'character', ['writeable'], { measure: '个' }),
  lex('课', 'lesson', ['thing'], { measure: '个' }),
  lex('路', 'road', ['thing'], { measure: '条' }),
  lex('事情', 'matter', ['thing'], { measure: '件' }),
  lex('问题', 'question', ['thing'], { measure: '个' }),
  lex('题', 'question', ['thing'], { measure: '个' }),
  lex('颜色', 'color', ['thing'], { measure: '个' }),
  lex('眼睛', 'eye', ['thing'], { measure: '只' }),
  lex('药', 'medicine', ['thing', 'buyable'], { uncountable: true }),
  lex('生日', 'birthday', ['thing'], { measure: '个' }),
  lex('东西', 'something', ['buyable'], { uncountable: true }),
  lex('衣服', 'clothes', ['thing', 'buyable'], { pluralOnly: true, measure: '件' }),
  lex('电视', 'TV', ['media'], { uncountable: true }),
  lex('电影', 'movie', ['media'], { measure: '部' }),

  // Abstract nouns: they fit "there is" and "is important", but not "I buy".
  lex('身体', 'health', ['thing'], { uncountable: true }),
  lex('时间', 'time', ['thing'], { uncountable: true }),
  lex('雪', 'snow', ['thing'], { uncountable: true }),

  // --- Food -----------------------------------------------------------------
  lex('米饭', 'rice', ['food'], { uncountable: true }),
  lex('菜', 'vegetables', ['food'], { uncountable: true }),
  lex('苹果', 'apple', ['food', 'buyable'], { measure: '个' }),
  lex('水果', 'fruit', ['food', 'buyable'], { uncountable: true }),
  lex('鸡蛋', 'egg', ['food', 'buyable'], { measure: '个' }),
  lex('羊肉', 'lamb', ['food', 'buyable'], { uncountable: true }),
  lex('鱼', 'fish', ['food', 'buyable'], { uncountable: true }),
  lex('西瓜', 'watermelon', ['food', 'buyable'], { measure: '个' }),
  lex('面条', 'noodles', ['food', 'buyable'], { uncountable: true }),
  lex('蛋糕', 'cake', ['food', 'buyable'], { measure: '个' }),
  lex('饺子', 'dumplings', ['food', 'buyable'], { pluralOnly: true }),

  // --- Drinks ---------------------------------------------------------------
  lex('茶', 'tea', ['drink', 'buyable'], { uncountable: true }),
  lex('水', 'water', ['drink', 'buyable'], { uncountable: true }),
  lex('咖啡', 'coffee', ['drink', 'buyable'], { uncountable: true }),
  lex('牛奶', 'milk', ['drink', 'buyable'], { uncountable: true }),
  lex('啤酒', 'beer', ['drink', 'buyable'], { uncountable: true }),
  lex('果汁', 'juice', ['drink', 'buyable'], { uncountable: true }),

  // --- Transport ------------------------------------------------------------
  lex('出租车', 'taxi', ['transport'], { by: 'by taxi' }),
  lex('公共汽车', 'bus', ['transport'], { by: 'by bus' }),
  lex('飞机', 'plane', ['transport'], { by: 'by plane' }),
  lex('自行车', 'bicycle', ['transport'], { by: 'by bicycle' }),
  lex('船', 'boat', ['transport'], { by: 'by boat' }),
  lex('地铁', 'subway', ['transport'], { by: 'by subway' }),

  // --- Adjectives -----------------------------------------------------------
  lex('大', 'big', ['adjective', 'thingAdjective']),
  lex('小', 'small', ['adjective', 'thingAdjective']),
  lex('好', 'good', ['adjective', 'personAdjective', 'thingAdjective']),
  lex('冷', 'cold', ['adjective', 'personAdjective', 'thingAdjective', 'weatherAdjective']),
  lex('热', 'hot', ['adjective', 'personAdjective', 'thingAdjective', 'weatherAdjective']),
  lex('高兴', 'happy', ['adjective', 'personAdjective']),
  lex('漂亮', 'pretty', ['adjective', 'personAdjective', 'thingAdjective']),
  lex('新', 'new', ['adjective', 'thingAdjective']),
  lex('高', 'tall', ['adjective', 'personAdjective', 'thingAdjective']),
  lex('忙', 'busy', ['adjective', 'personAdjective']),
  lex('累', 'tired', ['adjective', 'personAdjective']),
  lex('贵', 'expensive', ['adjective', 'thingAdjective']),
  lex('便宜', 'cheap', ['adjective', 'thingAdjective']),
  lex('远', 'far', ['adjective', 'thingAdjective']),
  lex('近', 'near', ['adjective', 'thingAdjective']),
  lex('长[cháng]', 'long', ['adjective', 'thingAdjective']),
  lex('短', 'short', ['adjective', 'thingAdjective']),
  lex('白', 'white', ['adjective', 'thingAdjective']),
  lex('黑', 'black', ['adjective', 'thingAdjective']),
  lex('红', 'red', ['adjective', 'thingAdjective']),
  lex('快乐', 'happy', ['adjective', 'personAdjective']),
  lex('好吃', 'delicious', ['adjective', 'thingAdjective']),
  lex('晴', 'sunny', ['adjective', 'weatherAdjective']),
  lex('阴', 'cloudy', ['adjective', 'weatherAdjective']),
  lex('难', 'difficult', ['adjective', 'thingAdjective']),
  lex('容易', 'easy', ['adjective', 'thingAdjective']),
  lex('干净', 'clean', ['adjective', 'thingAdjective']),
  lex('安静', 'quiet', ['adjective', 'thingAdjective']),
  lex('简单', 'simple', ['adjective', 'thingAdjective']),
  lex('重要', 'important', ['adjective', 'thingAdjective']),
  lex('健康', 'healthy', ['adjective', 'personAdjective']),

  // --- Time -----------------------------------------------------------------
  lex('今天', 'today', ['time']),
  lex('明天', 'tomorrow', ['time']),
  lex('昨天', 'yesterday', ['time']),
  lex('现在', 'now', ['time']),
  lex('上午', 'in the morning', ['time']),
  lex('下午', 'in the afternoon', ['time']),
  lex('晚上', 'in the evening', ['time']),
  lex('早上', 'in the morning', ['time']),
  lex('中午', 'at noon', ['time']),
  lex('去年', 'last year', ['time']),

  // --- Numbers --------------------------------------------------------------
  lex('一', 'one', ['number']),
  lex('二', 'two', ['number']),
  lex('三', 'three', ['number']),
  lex('四', 'four', ['number']),
  lex('五', 'five', ['number']),
  lex('六', 'six', ['number']),
  lex('七', 'seven', ['number']),
  lex('八', 'eight', ['number']),
  lex('九', 'nine', ['number']),
  lex('十', 'ten', ['number']),
  lex('两', 'two', ['number']),

  // --- Verbs ----------------------------------------------------------------
  lex('吃', 'eat', ['verb', 'actionVerb', 'atPlace', 'progressive'], { third: 'eats', gerund: 'eating' }),
  lex('喝', 'drink', ['verb', 'actionVerb', 'atPlace', 'progressive'], { third: 'drinks', gerund: 'drinking' }),
  lex('看', 'watch', ['verb', 'actionVerb', 'progressive'], { third: 'watches', gerund: 'watching' }),
  lex('读', 'read', ['verb', 'actionVerb', 'atPlace', 'progressive'], { third: 'reads', gerund: 'reading' }),
  lex('写', 'write', ['verb', 'actionVerb', 'progressive'], { third: 'writes', gerund: 'writing' }),
  lex('买', 'buy', ['verb', 'actionVerb'], { third: 'buys', gerund: 'buying' }),
  lex('卖', 'sell', ['verb', 'actionVerb'], { third: 'sells', gerund: 'selling' }),
  lex('去', 'go', ['verb', 'actionVerb'], { third: 'goes', gerund: 'going' }),
  lex('来', 'come', ['verb', 'actionVerb'], { third: 'comes', gerund: 'coming' }),
  lex('回', 'return', ['verb'], { third: 'returns', gerund: 'returning' }),
  lex('住', 'live', ['verb', 'actionVerb'], { third: 'lives', gerund: 'living' }),
  lex('坐', 'sit', ['verb', 'actionVerb'], { third: 'sits', gerund: 'sitting' }),
  lex('走', 'walk', ['verb', 'actionVerb'], { third: 'walks', gerund: 'walking' }),
  lex('开', 'drive', ['verb'], { third: 'drives', gerund: 'driving' }),
  lex('做', 'do', ['verb'], { third: 'does', gerund: 'doing' }),
  lex('工作', 'work', ['verb', 'actionVerb', 'intransitive', 'atPlace', 'progressive'], {
    third: 'works',
    gerund: 'working',
  }),
  lex('学习', 'study', ['verb', 'actionVerb', 'intransitive', 'atPlace', 'progressive'], {
    third: 'studies',
    gerund: 'studying',
  }),
  lex('睡觉', 'sleep', ['verb', 'actionVerb', 'intransitive', 'atPlace', 'progressive'], {
    third: 'sleeps',
    gerund: 'sleeping',
  }),
  lex('说话', 'speak', ['verb', 'actionVerb', 'intransitive', 'progressive'], {
    third: 'speaks',
    gerund: 'speaking',
  }),
  lex('唱歌', 'sing', ['verb', 'actionVerb', 'intransitive', 'progressive'], {
    third: 'sings',
    gerund: 'singing',
  }),
  lex('跳舞', 'dance', ['verb', 'actionVerb', 'intransitive', 'progressive'], {
    third: 'dances',
    gerund: 'dancing',
  }),
  lex('游泳', 'swim', ['verb', 'actionVerb', 'intransitive', 'progressive'], {
    third: 'swims',
    gerund: 'swimming',
  }),
  lex('跑步', 'run', ['verb', 'actionVerb', 'intransitive', 'progressive'], {
    third: 'runs',
    gerund: 'running',
  }),
  lex('旅游', 'travel', ['verb', 'actionVerb', 'intransitive', 'progressive'], {
    third: 'travels',
    gerund: 'traveling',
  }),
  lex('运动', 'exercise', ['verb', 'actionVerb', 'intransitive', 'atPlace', 'progressive'], {
    third: 'exercises',
    gerund: 'exercising',
  }),
  lex('休息', 'rest', ['verb', 'actionVerb', 'intransitive', 'atPlace', 'progressive'], {
    third: 'rests',
    gerund: 'resting',
  }),
  lex('笑', 'laugh', ['verb', 'actionVerb', 'intransitive', 'progressive'], {
    third: 'laughs',
    gerund: 'laughing',
  }),
  lex('生病', 'get sick', ['verb', 'actionVerb', 'intransitive'], {
    third: 'gets sick',
    gerund: 'getting sick',
  }),
  lex('下雨', 'rain', ['verb'], { third: 'rains', gerund: 'raining' }),
  lex('喜欢', 'like', ['verb'], { third: 'likes', gerund: 'liking' }),
  lex('爱', 'love', ['verb'], { third: 'loves', gerund: 'loving' }),
  lex('想', 'want', ['verb'], { third: 'wants', gerund: 'wanting' }),
  lex('要', 'want', ['verb'], { third: 'wants', gerund: 'wanting' }),
  lex('会', 'can', ['verb'], { third: 'can', gerund: 'being able to' }),
  lex('能', 'can', ['verb'], { third: 'can', gerund: 'being able to' }),
  lex('可以', 'can', ['verb'], { third: 'can', gerund: 'being able to' }),
  lex('请', 'invite', ['verb'], { third: 'invites', gerund: 'inviting' }),
  lex('叫', 'call', ['verb', 'actionVerb'], { third: 'calls', gerund: 'calling' }),
  lex('给', 'give', ['verb'], { third: 'gives', gerund: 'giving' }),
  lex('送', 'give', ['verb'], { third: 'gives', gerund: 'giving' }),
  lex('找', 'look for', ['verb'], { third: 'looks for', gerund: 'looking for' }),
  lex('等', 'wait', ['verb', 'actionVerb', 'intransitive', 'progressive'], { third: 'waits', gerund: 'waiting' }),
  lex('问', 'ask', ['verb', 'actionVerb'], { third: 'asks', gerund: 'asking' }),
  lex('回答', 'answer', ['verb', 'actionVerb'], { third: 'answers', gerund: 'answering' }),
  lex('认识', 'know', ['verb'], { third: 'knows', gerund: 'knowing' }),
  lex('知道', 'know', ['verb', 'actionVerb'], { third: 'knows', gerund: 'knowing' }),
  lex('觉得', 'think', ['verb', 'actionVerb'], { third: 'thinks', gerund: 'thinking' }),
  lex('希望', 'hope', ['verb'], { third: 'hopes', gerund: 'hoping' }),
  lex('帮助', 'help', ['verb', 'actionVerb', 'progressive'], { third: 'helps', gerund: 'helping' }),
  lex('洗', 'wash', ['verb', 'actionVerb', 'progressive'], { third: 'washes', gerund: 'washing' }),
  lex('穿', 'wear', ['verb', 'actionVerb', 'progressive'], { third: 'wears', gerund: 'wearing' }),
  lex('玩', 'play', ['verb', 'actionVerb', 'atPlace', 'progressive'], { third: 'plays', gerund: 'playing' }),
  lex('开始', 'start', ['verb', 'actionVerb', 'progressive'], { third: 'starts', gerund: 'starting' }),
  lex('准备', 'prepare', ['verb', 'actionVerb', 'progressive'], { third: 'prepares', gerund: 'preparing' }),
  lex('介绍', 'introduce', ['verb', 'progressive'], { third: 'introduces', gerund: 'introducing' }),
  lex('告诉', 'tell', ['verb', 'progressive'], { third: 'tells', gerund: 'telling' }),
  lex('懂', 'understand', ['verb'], { third: 'understands', gerund: 'understanding' }),
  lex('进', 'enter', ['verb'], { third: 'enters', gerund: 'entering' }),
  lex('出', 'go out', ['verb'], { third: 'goes out', gerund: 'going out' }),
  lex('到', 'arrive', ['verb'], { third: 'arrives', gerund: 'arriving' }),
  lex('起床', 'get up', ['verb', 'actionVerb', 'intransitive'], {
    third: 'gets up',
    gerund: 'getting up',
  }),
  lex('上班', 'go to work', ['verb', 'actionVerb', 'intransitive', 'progressive'], {
    third: 'goes to work',
    gerund: 'going to work',
  }),
  lex('考试', 'take an exam', ['verb', 'actionVerb', 'progressive'], {
    third: 'takes an exam',
    gerund: 'taking an exam',
  }),
  lex('踢', 'kick', ['verb', 'actionVerb'], { third: 'kicks', gerund: 'kicking' }),
  lex('完', 'finish', ['verb'], { third: 'finishes', gerund: 'finishing' }),
  lex('让', 'let', ['verb'], { third: 'lets', gerund: 'letting' }),
  lex('欢迎', 'welcome', ['verb'], { third: 'welcomes', gerund: 'welcoming' }),
]

/** Lexemes by dictionary id, to attach grammar data to a learned word. */
export const SENTENCE_LEXICON_BY_ID: ReadonlyMap<string, SentenceLexeme> = new Map(
  SENTENCE_LEXICON.map((lexeme) => [lexeme.id, lexeme]),
)
