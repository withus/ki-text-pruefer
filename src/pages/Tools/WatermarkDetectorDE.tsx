import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  Copy,
  Trash2,
  Download,
  Upload,
  Eye,
  EyeOff,
  Shield,
  Search,
  FileText,
  CheckCircle,
  Info,
  Zap
} from 'lucide-react';

interface CharacterInfo {
  char: string;
  code: number;
  hex: string;
  name: string;
  category: 'invisible' | 'suspicious' | 'normal' | 'whitespace' | 'control' | 'unicode-special';
  isWatermark: boolean;
  description?: string;
  displayChar?: string;
}

const WatermarkDetectorDE = () => {
  const [inputText, setInputText] = useState('');
  const [cleanedText, setCleanedText] = useState('');
  const [detectedCharacters, setDetectedCharacters] = useState<CharacterInfo[]>([]);
  const [showInvisible, setShowInvisible] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    invisible: 0,
    suspicious: 0,
    unicodeSpecial: 0,
    watermarkLikelihood: 0
  });
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Comprehensive character database - EXPANDED
  const getCharacterInfo = (char: string): CharacterInfo => {
    const code = char.charCodeAt(0);
    const hex = code.toString(16).toUpperCase().padStart(4, '0');

    // Zero-width characters (highest watermark likelihood)
    if (code === 0x200B) return {
      char, code, hex,
      name: 'Zero Width Space (ZWSP)',
      category: 'invisible',
      isWatermark: true,
      description: 'Unsichtbares Zeichen ohne Breite; kann zum Markieren von Text genutzt werden',
      displayChar: '⟨ZWSP⟩'
    };
    if (code === 0x200C) return {
      char, code, hex,
      name: 'Zero Width Non-Joiner (ZWNJ)',
      category: 'invisible',
      isWatermark: true,
      description: 'Unsichtbares Zeichen ohne Breite; verhindert das Verbinden benachbarter Zeichen',
      displayChar: '⟨ZWNJ⟩'
    };
    if (code === 0x200D) return {
      char, code, hex,
      name: 'Zero Width Joiner (ZWJ)',
      category: 'invisible',
      isWatermark: true,
      description: 'Unsichtbares Zeichen ohne Breite; verbindet benachbarte Zeichen, zum Beispiel in Emoji-Sequenzen',
      displayChar: '⟨ZWJ⟩'
    };
    if (code === 0xFEFF) return {
      char, code, hex,
      name: 'Byte Order Mark (BOM)',
      category: 'invisible',
      isWatermark: true,
      description: 'Byte-Order-Mark; unsichtbar, steht normalerweise am Dateianfang und kann beim Kopieren im Text landen',
      displayChar: '⟨BOM⟩'
    };

    // Other invisible characters
    if (code === 0x2060) return {
      char, code, hex,
      name: 'Word Joiner (WJ)',
      category: 'invisible',
      isWatermark: true,
      displayChar: '⟨WJ⟩'
    };
    if (code === 0x180E) return {
      char, code, hex,
      name: 'Mongolian Vowel Separator',
      category: 'invisible',
      isWatermark: true,
      displayChar: '⟨MVS⟩'
    };

    // Mathematical invisible operators
    if (code === 0x2061) return {
      char, code, hex,
      name: 'Function Application (FA)',
      category: 'invisible',
      isWatermark: true,
      displayChar: '⟨FA⟩'
    };
    if (code === 0x2062) return {
      char, code, hex,
      name: 'Invisible Times (IT)',
      category: 'invisible',
      isWatermark: true,
      displayChar: '⟨IT⟩'
    };
    if (code === 0x2063) return {
      char, code, hex,
      name: 'Invisible Separator (IS)',
      category: 'invisible',
      isWatermark: true,
      displayChar: '⟨IS⟩'
    };
    if (code === 0x2064) return {
      char, code, hex,
      name: 'Invisible Plus (IP)',
      category: 'invisible',
      isWatermark: true,
      displayChar: '⟨IP⟩'
    };

    // Special spaces
    if (code === 0x2000) return { char, code, hex, name: 'En Quad', category: 'suspicious', isWatermark: true, displayChar: '⟨NQSP⟩' };
    if (code === 0x2001) return { char, code, hex, name: 'Em Quad', category: 'suspicious', isWatermark: true, displayChar: '⟨MQSP⟩' };
    if (code === 0x2002) return { char, code, hex, name: 'En Space', category: 'suspicious', isWatermark: true, displayChar: '⟨ENSP⟩' };
    if (code === 0x2003) return { char, code, hex, name: 'Em Space', category: 'suspicious', isWatermark: true, displayChar: '⟨EMSP⟩' };
    if (code === 0x2004) return { char, code, hex, name: 'Three-Per-Em Space', category: 'suspicious', isWatermark: true, displayChar: '⟨3/MSP⟩' };
    if (code === 0x2005) return { char, code, hex, name: 'Four-Per-Em Space', category: 'suspicious', isWatermark: true, displayChar: '⟨4/MSP⟩' };
    if (code === 0x2006) return { char, code, hex, name: 'Six-Per-Em Space', category: 'suspicious', isWatermark: true, displayChar: '⟨6/MSP⟩' };
    if (code === 0x2007) return { char, code, hex, name: 'Figure Space', category: 'suspicious', isWatermark: true, displayChar: '⟨FSP⟩' };
    if (code === 0x2008) return { char, code, hex, name: 'Punctuation Space', category: 'suspicious', isWatermark: true, displayChar: '⟨PSP⟩' };
    if (code === 0x2009) return { char, code, hex, name: 'Thin Space', category: 'suspicious', isWatermark: true, displayChar: '⟨THSP⟩' };
    if (code === 0x200A) return { char, code, hex, name: 'Hair Space', category: 'suspicious', isWatermark: true, displayChar: '⟨HSP⟩' };
    if (code === 0x202F) return { char, code, hex, name: 'Narrow No-Break Space', category: 'suspicious', isWatermark: true, displayChar: '⟨NNBSP⟩' };
    if (code === 0x205F) return { char, code, hex, name: 'Medium Mathematical Space', category: 'suspicious', isWatermark: true, displayChar: '⟨MMSP⟩' };
    if (code === 0x3000) return { char, code, hex, name: 'Ideographic Space', category: 'suspicious', isWatermark: true, displayChar: '⟨IDSP⟩' };

    // Directional marks
    if (code === 0x200E) return { char, code, hex, name: 'Left-to-Right Mark (LRM)', category: 'suspicious', isWatermark: true, displayChar: '⟨LRM⟩' };
    if (code === 0x200F) return { char, code, hex, name: 'Right-to-Left Mark (RLM)', category: 'suspicious', isWatermark: true, displayChar: '⟨RLM⟩' };
    if (code === 0x202A) return { char, code, hex, name: 'Left-to-Right Embedding (LRE)', category: 'suspicious', isWatermark: true, displayChar: '⟨LRE⟩' };
    if (code === 0x202B) return { char, code, hex, name: 'Right-to-Left Embedding (RLE)', category: 'suspicious', isWatermark: true, displayChar: '⟨RLE⟩' };
    if (code === 0x202C) return { char, code, hex, name: 'Pop Directional Formatting (PDF)', category: 'suspicious', isWatermark: true, displayChar: '⟨PDF⟩' };
    if (code === 0x202D) return { char, code, hex, name: 'Left-to-Right Override (LRO)', category: 'suspicious', isWatermark: true, displayChar: '⟨LRO⟩' };
    if (code === 0x202E) return { char, code, hex, name: 'Right-to-Left Override (RLO)', category: 'suspicious', isWatermark: true, displayChar: '⟨RLO⟩' };
    if (code === 0x2066) return { char, code, hex, name: 'Left-to-Right Isolate (LRI)', category: 'suspicious', isWatermark: true, displayChar: '⟨LRI⟩' };
    if (code === 0x2067) return { char, code, hex, name: 'Right-to-Left Isolate (RLI)', category: 'suspicious', isWatermark: true, displayChar: '⟨RLI⟩' };
    if (code === 0x2068) return { char, code, hex, name: 'First Strong Isolate (FSI)', category: 'suspicious', isWatermark: true, displayChar: '⟨FSI⟩' };
    if (code === 0x2069) return { char, code, hex, name: 'Pop Directional Isolate (PDI)', category: 'suspicious', isWatermark: true, displayChar: '⟨PDI⟩' };

    // Line and paragraph separators
    if (code === 0x2028) return { char, code, hex, name: 'Line Separator (LS)', category: 'suspicious', isWatermark: true, displayChar: '⟨LS⟩' };
    if (code === 0x2029) return { char, code, hex, name: 'Paragraph Separator (PS)', category: 'suspicious', isWatermark: true, displayChar: '¶' };

    // Soft hyphen - invisible character
    if (code === 0x00AD) return { char, code, hex, name: 'Soft Hyphen (SHY)', category: 'invisible', isWatermark: true, displayChar: '⟨SHY⟩' };

    // Common Unicode special characters
    if (code === 0x2013) return { char, code, hex, name: 'En Dash', category: 'unicode-special', isWatermark: true, displayChar: '–', description: 'Gedankenstrich (wird zu - ersetzt)' };
    if (code === 0x2014) return { char, code, hex, name: 'Em Dash', category: 'unicode-special', isWatermark: true, displayChar: '—', description: 'Langer Gedankenstrich (wird zu - ersetzt)' };
    if (code === 0x201C) return { char, code, hex, name: 'Left Double Quotation Mark', category: 'unicode-special', isWatermark: false, displayChar: '"' };
    if (code === 0x201D) return { char, code, hex, name: 'Right Double Quotation Mark', category: 'unicode-special', isWatermark: false, displayChar: '"' };
    if (code === 0x201E) return { char, code, hex, name: 'Double Low-9 Quotation Mark', category: 'unicode-special', isWatermark: false, displayChar: '„', description: 'Deutsche Anführungszeichen unten' };
    if (code === 0x2018) return { char, code, hex, name: 'Left Single Quotation Mark', category: 'unicode-special', isWatermark: false, displayChar: "'" };
    if (code === 0x2019) return { char, code, hex, name: 'Right Single Quotation Mark', category: 'unicode-special', isWatermark: false, displayChar: "'" };
    if (code === 0x2022) return { char, code, hex, name: 'Bullet', category: 'unicode-special', isWatermark: false, displayChar: '•' };
    if (code === 0x2026) return { char, code, hex, name: 'Horizontal Ellipsis', category: 'unicode-special', isWatermark: false, displayChar: '…' };

    // Regular whitespace
    if (code === 0x0020) return { char, code, hex, name: 'Space', category: 'whitespace', isWatermark: false, displayChar: '•' };
    // Non-breaking space is unicode-special
    if (code === 0x00A0) return { char, code, hex, name: 'Non-Breaking Space (NBSP)', category: 'unicode-special', isWatermark: false, displayChar: '⍽', description: 'Geschütztes Leerzeichen' };
    if (code === 0x0009) return { char, code, hex, name: 'Tab', category: 'whitespace', isWatermark: false, displayChar: '→' };
    if (code === 0x000A) return { char, code, hex, name: 'Line Feed', category: 'whitespace', isWatermark: false, displayChar: '↵' };
    if (code === 0x000D) return { char, code, hex, name: 'Carriage Return', category: 'whitespace', isWatermark: false, displayChar: '⏎' };

    // Control characters
    if (code === 0x0000) return { char, code, hex, name: 'Null', category: 'control', isWatermark: false, displayChar: '␀' };
    if (code < 0x20 || code === 0x7F) return {
      char, code, hex,
      name: `Control Character`,
      category: 'control',
      isWatermark: false,
      displayChar: `[${hex}]`
    };

    // Variation selectors
    if (code >= 0xFE00 && code <= 0xFE0F) return {
      char, code, hex,
      name: `Variation Selector ${code - 0xFE00 + 1}`,
      category: 'invisible',
      isWatermark: true,
      displayChar: `⟨VS${code - 0xFE00 + 1}⟩`
    };

    // German characters - should be kept
    const germanChars = 'äöüÄÖÜßéèêëàáâãåæçíìîïñóòôõøœúùûýÿ';
    if (germanChars.includes(char)) {
      return { char, code, hex, name: 'Normal Character', category: 'normal', isWatermark: false, displayChar: char };
    }

    // Any other non-ASCII character
    if (code > 127) return {
      char, code, hex,
      name: `Unicode Character`,
      category: 'unicode-special',
      isWatermark: false,
      displayChar: char,
      description: `U+${hex}`
    };

    // Normal character
    return { char, code, hex, name: 'Normal Character', category: 'normal', isWatermark: false, displayChar: char };
  };

  const analyzeText = useCallback(() => {
    if (!inputText) {
      setDetectedCharacters([]);
      setStats({ total: 0, invisible: 0, suspicious: 0, unicodeSpecial: 0, watermarkLikelihood: 0 });
      setCleanedText('');
      return;
    }

    setIsAnalyzing(true);

    setTimeout(() => {
      const chars = Array.from(inputText);
      const analyzed: CharacterInfo[] = [];
      const charMap = new Map<string, number>();
      let invisibleCount = 0;
      let suspiciousCount = 0;
      let unicodeSpecialCount = 0;
      let watermarkChars = 0;
      let cleaned = '';

      chars.forEach(char => {
        const info = getCharacterInfo(char);

        // Count occurrences
        const key = `${info.hex}-${info.name}`;
        charMap.set(key, (charMap.get(key) || 0) + 1);

        if (info.category === 'invisible') {
          invisibleCount++;
          if (info.isWatermark) watermarkChars++;
        } else if (info.category === 'suspicious') {
          suspiciousCount++;
          if (info.isWatermark) watermarkChars++;
        } else if (info.category === 'unicode-special') {
          unicodeSpecialCount++;
          // Replace en-dash and em-dash with regular dash
          if (info.code === 0x2013 || info.code === 0x2014) {
            cleaned += '-';
          } else if (info.code === 0x201C || info.code === 0x201D) {
            cleaned += '"';
          } else if (info.code === 0x2018 || info.code === 0x2019) {
            cleaned += "'";
          } else if (info.code === 0x201E) {
            cleaned += '"';
          } else {
            // Keep German umlauts and other harmless unicode
            const germanChars = 'äöüÄÖÜß';
            if (germanChars.includes(char)) {
              cleaned += char;
            }
            // Otherwise skip the unicode special character
          }
          if (info.isWatermark) watermarkChars++;
        } else if (info.category === 'normal' || info.category === 'whitespace') {
          cleaned += char;
        }
      });

      // Create unique character list with counts
      const uniqueChars: CharacterInfo[] = [];
      const processedHexes = new Set<string>();

      chars.forEach(char => {
        const info = getCharacterInfo(char);
        // Show all characters when showInvisible is true, otherwise only non-normal ones
        if (!processedHexes.has(info.hex)) {
          if (showInvisible || info.category !== 'normal') {
            processedHexes.add(info.hex);
            uniqueChars.push(info);
          }
        }
      });

      // Calculate watermark likelihood (0-100)
      const totalSpecial = invisibleCount + suspiciousCount;
      const watermarkLikelihood = Math.min(
        100,
        Math.round((watermarkChars / Math.max(1, chars.length)) * 1000) // Amplify small percentages
      );

      setDetectedCharacters(uniqueChars);
      setStats({
        total: chars.length,
        invisible: invisibleCount,
        suspicious: suspiciousCount,
        unicodeSpecial: unicodeSpecialCount,
        watermarkLikelihood
      });
      setCleanedText(cleaned);
      setIsAnalyzing(false);
    }, 100);
  }, [inputText, showInvisible]);

  // Debounced analysis on input change
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(() => {
      analyzeText();
    }, 150); // 150ms debounce for better UX

    setDebounceTimer(timer);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [inputText, analyzeText]);

  const handlePaste = (e: React.ClipboardEvent) => {
    // Auto-analyze on paste with minimal delay
    setTimeout(analyzeText, 50);
  };

  const copyCleanText = () => {
    navigator.clipboard.writeText(cleanedText);
  };

  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      stats,
      detectedCharacters: detectedCharacters,
      originalLength: inputText.length,
      cleanedLength: cleanedText.length,
      removedCharacters: inputText.length - cleanedText.length
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wasserzeichen-analyse-${Date.now()}.json`;
    a.click();
  };

  const getWatermarkAlert = () => {
    if (stats.watermarkLikelihood > 75) {
      return {
        variant: 'destructive' as const,
        title: 'Viele auffällige Zeichen gefunden',
        description: 'Ein hoher Anteil des Textes besteht aus unsichtbaren oder ungewöhnlichen Zeichen. Die Details zeigen, welche es sind.'
      };
    } else if (stats.watermarkLikelihood > 30) {
      return {
        variant: 'default' as const,
        title: 'Auffällige Zeichen gefunden',
        description: 'Der Text enthält unsichtbare oder ungewöhnliche Zeichen in nennenswerter Zahl. Die Details zeigen, welche es sind.'
      };
    } else if (stats.invisible > 0 || stats.suspicious > 0) {
      return {
        variant: 'default' as const,
        title: 'Versteckte Zeichen gefunden',
        description: 'Einige unsichtbare oder ungewöhnliche Zeichen erkannt, aber nur ein kleiner Anteil des Textes.'
      };
    }
    return null;
  };

  const alert = getWatermarkAlert();

  return (
    <>
      <div className="min-h-screen bg-background pt-12 pb-12">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Text Wasserzeichen Detektor
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Erkennen Sie versteckte Wasserzeichen und unsichtbare Zeichen in Texten. Angezeigt werden unsichtbare und ungewöhnliche Unicode-Zeichen, die beim Kopieren aus KI-Werkzeugen oder anderen Quellen im Text landen können.
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Text-Analyse
              </CardTitle>
              <CardDescription>
                Fügen Sie Ihren Text ein oder tippen Sie, um versteckte Wasserzeichen und unsichtbare Zeichen zu erkennen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Textarea
                  placeholder="Fügen Sie hier Ihren Text ein, um nach versteckten Wasserzeichen zu suchen..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPaste={handlePaste}
                  className="min-h-[200px] font-mono text-sm"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setInputText('')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={analyzeText}
                  className="bg-primary hover:bg-primary-glow"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Zap className="h-4 w-4 mr-2 animate-pulse" />
                      Analysiere...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Text analysieren
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowInvisible(!showInvisible)}
                >
                  {showInvisible ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showInvisible ? 'Nur Verdächtige' : 'Alle Zeichen'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {alert && (
            <Alert variant={alert.variant} className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>{alert.description}</AlertDescription>
            </Alert>
          )}

          {stats.total > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <p className="text-sm text-muted-foreground">Zeichen gesamt</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-500">{stats.invisible}</div>
                    <p className="text-sm text-muted-foreground">Unsichtbare</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-orange-500">{stats.suspicious}</div>
                    <p className="text-sm text-muted-foreground">Verdächtige</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-500">{stats.unicodeSpecial}</div>
                    <p className="text-sm text-muted-foreground">Unicode-Spezial</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-primary">
                      {stats.watermarkLikelihood}%
                    </div>
                    <p className="text-sm text-muted-foreground">Auffälligkeits-Index</p>
                    <Progress value={stats.watermarkLikelihood} className="mt-2" />
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="visualization" className="mb-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="visualization">Visualisierung</TabsTrigger>
                  <TabsTrigger value="details">Zeichen-Details</TabsTrigger>
                  <TabsTrigger value="cleaned">Bereinigter Text</TabsTrigger>
                </TabsList>

                <TabsContent value="visualization" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Text-Visualisierung</CardTitle>
                      <CardDescription>
                        Versteckte Zeichen sind markiert und beschriftet
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all overflow-x-auto max-h-[400px] overflow-y-auto">
                        {Array.from(inputText).map((char, idx) => {
                          const info = getCharacterInfo(char);

                          if (info.category === 'invisible') {
                            return (
                              <span
                                key={idx}
                                className="bg-red-500 text-white px-1 mx-0.5 rounded text-xs"
                                title={`${info.name} (U+${info.hex})`}
                              >
                                {info.displayChar}
                              </span>
                            );
                          } else if (info.category === 'suspicious') {
                            return (
                              <span
                                key={idx}
                                className="bg-orange-500 text-white px-1 mx-0.5 rounded text-xs"
                                title={`${info.name} (U+${info.hex})`}
                              >
                                {info.displayChar}
                              </span>
                            );
                          } else if (info.category === 'unicode-special') {
                            return (
                              <span
                                key={idx}
                                className="bg-blue-500 text-white px-1 mx-0.5 rounded text-xs"
                                title={`${info.name} (U+${info.hex})`}
                              >
                                U+{info.hex}
                              </span>
                            );
                          } else if (info.category === 'whitespace') {
                            return (
                              <span key={idx} className="text-muted-foreground">
                                {info.displayChar}
                              </span>
                            );
                          }
                          return <span key={idx}>{char}</span>;
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="details" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Erkannte Spezialzeichen</CardTitle>
                      <CardDescription>
                        Detaillierte Analyse von nicht-Standard-Zeichen
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {detectedCharacters.map((char, idx) => {
                          // Count occurrences
                          const count = Array.from(inputText).filter(c =>
                            c.charCodeAt(0) === char.code
                          ).length;

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-4">
                                <Badge
                                  variant={
                                    char.isWatermark ? 'destructive' :
                                    char.category === 'suspicious' ? 'default' :
                                    char.category === 'unicode-special' ? 'outline' :
                                    'secondary'
                                  }
                                >
                                  {char.category === 'unicode-special' ? 'Unicode' : char.category}
                                </Badge>
                                <div>
                                  <div className="font-semibold flex items-center gap-2">
                                    {char.name}
                                    {count > 1 && (
                                      <Badge variant="outline" className="text-xs">
                                        {count}x
                                      </Badge>
                                    )}
                                  </div>
                                  {char.description && (
                                    <div className="text-sm text-muted-foreground">
                                      {char.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right font-mono text-sm">
                                <div className="font-bold">U+{char.hex}</div>
                                <div className="text-muted-foreground">
                                  {char.displayChar && char.displayChar !== char.char ? char.displayChar : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cleaned" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Bereinigter Text</CardTitle>
                      <CardDescription>
                        Text ohne unsichtbare und verdächtige Zeichen. Weitere Nicht-ASCII-Zeichen wie €, Emojis und Auslassungspunkte werden ebenfalls entfernt (Umlaute, ß und einige Buchstaben mit Akzent bleiben). Gedankenstriche werden zu Bindestrichen, die Anführungszeichen U+201C, U+201D, U+201E, U+2018 und U+2019 zu geraden. Andere Anführungszeichen wie Guillemets entfallen.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-muted p-2 rounded text-sm">
                        <Info className="inline h-4 w-4 mr-2" />
                        {inputText.length - cleanedText.length} Zeichen entfernt
                      </div>
                      <Textarea
                        value={cleanedText}
                        readOnly
                        className="min-h-[200px] font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <Button onClick={copyCleanText}>
                          <Copy className="h-4 w-4 mr-2" />
                          Bereinigten Text kopieren
                        </Button>
                        <Button variant="outline" onClick={downloadReport}>
                          <Download className="h-4 w-4 mr-2" />
                          Bericht herunterladen
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* Educational Section */}
          <Card>
            <CardHeader>
              <CardTitle>Über Text-Wasserzeichen</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Häufige Wasserzeichen-Techniken</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span><strong>Zero-Width-Zeichen:</strong> Unsichtbare Unicode-Zeichen zwischen Wörtern (ZWSP, ZWJ, ZWNJ)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span><strong>Typografische Zeichen:</strong> Gedankenstriche (U+2013, U+2014) und Anführungszeichen wie U+201E gehören zur normalen Typografie. Gedankenstriche zählen in der Kennzahl mit.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span><strong>Richtungsmarkierungen:</strong> RTL/LTR-Überschreibungszeichen</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span><strong>Mathematische Operatoren:</strong> Unsichtbare Times, Plus, Separator</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Warum auf Wasserzeichen prüfen?</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                      <span><strong>Datenschutz:</strong> Unsichtbare Zeichen sehen, bevor ein Text weitergegeben wird</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                      <span><strong>KI-Werkzeuge:</strong> Unsichtbare Zeichen finden, die beim Kopieren aus solchen Werkzeugen mitkommen können</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                      <span><strong>Sicherheit:</strong> Versteckte bösartige Zeichen finden</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                      <span><strong>Datenintegrität:</strong> Sauberen Text für Verarbeitung sicherstellen</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default WatermarkDetectorDE;