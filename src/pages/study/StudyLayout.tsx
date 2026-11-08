import { NavLink, Outlet } from 'react-router'
import { PageHeader } from '../../components/ui/PageHeader.tsx'
import { t, type MessageKey } from '../../i18n/index.ts'

/** Tabs of the Study section. Adding one = adding an entry and its <Route>. */
const STUDY_TABS: readonly { path: string; labelKey: MessageKey }[] = [
  { path: '/study', labelKey: 'study.myStudies' },
  { path: '/study/hsk', labelKey: 'study.hsk' },
  { path: '/study/sentences', labelKey: 'study.sentences' },
  { path: '/study/topics', labelKey: 'study.topics' },
  { path: '/study/custom', labelKey: 'study.custom' },
]

/** Study section: My Studies, HSK sets and topic sets. */
export function StudyLayout() {
  return (
    <>
      <PageHeader title={t('nav.study')} description={t('study.description')} />
      <nav aria-label={t('study.sections')} className="mb-4 overflow-x-auto sm:mb-6">
        <ul className="flex gap-1 border-b border-line">
          {STUDY_TABS.map((tab) => (
            <li key={tab.path} className="flex-1 sm:flex-none">
              <NavLink
                to={tab.path}
                end
                className={({ isActive }) =>
                  `-mb-px block border-b-2 px-2 py-2.5 text-center font-medium whitespace-nowrap sm:px-4 ${
                    isActive ? 'border-accent text-accent-strong' : 'border-transparent text-ink-muted hover:text-ink'
                  }`
                }
              >
                {t(tab.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </>
  )
}
