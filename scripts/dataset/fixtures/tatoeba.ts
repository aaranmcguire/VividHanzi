/*
 * Real Tatoeba sentences (CC BY 2.0 FR) in the per-language export format,
 * for the tests. The ids and texts are Tatoeba's; the authors of the
 * Chinese sentences were checked on tatoeba.org. The English
 * translations are left without an author ("\N") because theirs could not
 * be checked from this environment. Sentences 999999999 and 999999998 are
 * made up (that id does not exist) only to test the orphaned-sentence filter.
 */
export const cmnSentencesFixture = [
  '8934441\tcmn\t柠檬很酸。\tiiujik\t\\N\t\\N',
  '374825\tcmn\t谢谢你。\tsysko\t\\N\t\\N',
  '999999999\tcmn\t你们好吗？\t\\N\t\\N\t\\N',
].join('\n')

export const engSentencesFixture = [
  '29487\teng\tLemon is sour.\t\\N\t\\N\t\\N',
  '435751\teng\tLemons are sour.\t\\N\t\\N\t\\N',
  '374827\teng\tThank you!\t\\N\t\\N\t\\N',
  '1876041\teng\tThank you.\t\\N\t\\N\t\\N',
  '999999998\teng\tHow are you all?\t\\N\t\\N\t\\N',
].join('\n')

export const cmnEngLinksFixture = [
  '8934441\t29487',
  '8934441\t435751',
  '374825\t1876041',
  '374825\t374827',
  '999999999\t999999998',
].join('\n')

/** Licensed recordings; the second line has no license, so it may not be reused. */
export const cmnAudioFixture = [
  '8934441\t988876\tGlossaMatik\tCC BY-NC 4.0\t/en/user/profile/GlossaMatik',
  '374825\t988877\tsomeone\t\t',
].join('\n')
