import { Grid, Header, MinimizedPanelsMenu, MinimizedPanelsProvider, Panel, usePanelManager } from '@6njp/prototype-library'
import { getThemeVariables } from '@6njp/prototype-library/machinery'
import { ListMusic } from 'lucide-react'

import { SettingsProvider } from '@/features/contexts/SettingsContext.jsx'
import { ProjectProvider } from '@/features/contexts/ProjectContext.jsx'
import { PreviewProvider } from '@/features/contexts/PreviewContext.jsx'
import { UIProvider, useUI } from '@/features/contexts/UIContext.jsx'
import { EditorPanel } from '@/features/components/EditorPanel/EditorPanel.jsx'
import { SettingsPanel } from '@/features/components/SettingsPanel/SettingsPanel.jsx'
import { SampleBrowser } from '@/features/components/SampleBrowser/SampleBrowser.jsx'
import { ExtractionWizard } from '@/features/components/ExtractionWizard/ExtractionWizard.jsx'

import styles from './App.module.css'

export default function App() {
  const [isDark, setIsDark] = React.useState(true)
  const themeName = isDark ? 'dark' : 'light'
  const themeVariables = getThemeVariables(themeName)

  return (
    <SettingsProvider>
      <ProjectProvider>
        <PreviewProvider>
          <UIProvider>
            <MinimizedPanelsProvider>
              <main style={themeVariables} className={styles.app}>
                <Header
                  title='Audio Midi Extractor'
                  logo={ListMusic}
                  onToggleTheme={() => setIsDark(d => !d)}
                  layoutClassName={styles.headerLayout}
                  {...{ isDark }}
                />

                <Grid layoutClassName={styles.gridLayout}>
                  <AppPanels />
                </Grid>

                <MinimizedPanelsMenu layoutClassName={styles.minimizedMenuLayout} />
              </main>

              <ExtractionWizard />
            </MinimizedPanelsProvider>
          </UIProvider>
        </PreviewProvider>
      </ProjectProvider>
    </SettingsProvider>
  )
}

function AppPanels() {
  const settings = usePanelManager('settings', 'Settings')
  const editor = usePanelManager('editor', 'Editor')
  const { sampleBrowserOpen, closeSampleBrowser } = useUI()

  return (
    <>
      {settings.visible && (
        <Panel
          minimizable
          title='Settings'
          minWidth={6}
          minHeight={9}
          onMinimize={settings.minimize}
        >
          <SettingsPanel />
        </Panel>
      )}

      {editor.visible && (
        <Panel
          minimizable
          title='Editor'
          minWidth={10}
          minHeight={6}
          onMinimize={editor.minimize}
        >
          <EditorPanel />
        </Panel>
      )}

      {sampleBrowserOpen && (
        <Panel
          closeable
          title='Samples'
          minWidth={3}
          minHeight={3}
          onClose={closeSampleBrowser}
        >
          <SampleBrowser />
        </Panel>
      )}
    </>
  )
}
