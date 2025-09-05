import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import WatermarkDetector from '@/pages/Tools/WatermarkDetector';
import WatermarkDetectorDE from '@/pages/Tools/WatermarkDetectorDE';

type Language = 'de' | 'en';

const GITHUB_URL = 'https://github.com/withus/ki-text-pruefer';

const App = () => {
  const [language, setLanguage] = useState<Language>('de');

  // lang-Attribut des Dokuments an die gewählte Sprache angleichen
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex max-w-6xl items-center justify-between py-3">
          <span className="font-semibold">KI-Text-Prüfer</span>
          <div className="flex gap-2" role="group" aria-label="Sprache / Language">
            <Button
              size="sm"
              variant={language === 'de' ? 'default' : 'outline'}
              aria-pressed={language === 'de'}
              aria-label="Deutsch"
              onClick={() => setLanguage('de')}
            >
              DE
            </Button>
            <Button
              size="sm"
              variant={language === 'en' ? 'default' : 'outline'}
              aria-pressed={language === 'en'}
              aria-label="English"
              onClick={() => setLanguage('en')}
            >
              EN
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {language === 'de' ? <WatermarkDetectorDE /> : <WatermarkDetector />}
      </main>

      <footer className="border-t py-6 text-sm text-muted-foreground">
        <div className="container flex max-w-6xl items-center justify-between">
          <span>Sven Withus</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};

export default App;
