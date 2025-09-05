import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  CheckCircle
} from 'lucide-react';

interface CharacterInfo {
  char: string;
  code: number;
  hex: string;
  name: string;
  category: 'invisible' | 'suspicious' | 'normal' | 'whitespace' | 'control';
  isWatermark: boolean;
  description?: string;
}

interface WatermarkPattern {
  pattern: RegExp;
  name: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

const WatermarkDetector = () => {
  const [inputText, setInputText] = useState('');
  const [cleanedText, setCleanedText] = useState('');
  const [detectedCharacters, setDetectedCharacters] = useState<CharacterInfo[]>([]);
  const [showInvisible, setShowInvisible] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    invisible: 0,
    suspicious: 0,
    watermarkLikelihood: 0
  });
  // Merker, dass nach dem nächsten Texteingang automatisch analysiert werden soll
  const analyzeAfterPasteRef = useRef(false);

  // Common watermark patterns
  const watermarkPatterns: WatermarkPattern[] = [
    {
      pattern: /[\u200B\u200C\u200D\uFEFF]/g,
      name: 'Zero-Width Characters',
      severity: 'high',
      description: 'Commonly used for text watermarking'
    },
    {
      pattern: /[\u2060\u2061\u2062\u2063\u2064]/g,
      name: 'Word Joiners & Invisible Operators',
      severity: 'high',
      description: 'Hidden formatting characters'
    },
    {
      pattern: /[\u180E\u200E\u200F\u202A-\u202E]/g,
      name: 'Directional Marks',
      severity: 'medium',
      description: 'Text direction controllers'
    },
    {
      pattern: /[\uFE00-\uFE0F]/g,
      name: 'Variation Selectors',
      severity: 'medium',
      description: 'Unicode variation selectors'
    }
  ];

  // Character database
  const getCharacterInfo = (char: string): CharacterInfo => {
    const code = char.charCodeAt(0);
    const hex = code.toString(16).toUpperCase().padStart(4, '0');

    // Zero-width characters (highest watermark likelihood)
    if (code === 0x200B) return {
      char, code, hex,
      name: 'Zero Width Space',
      category: 'invisible',
      isWatermark: true,
      description: 'Invisible zero-width character; can be used to mark text'
    };
    if (code === 0x200C) return {
      char, code, hex,
      name: 'Zero Width Non-Joiner',
      category: 'invisible',
      isWatermark: true,
      description: 'Invisible zero-width character; prevents neighboring characters from joining'
    };
    if (code === 0x200D) return {
      char, code, hex,
      name: 'Zero Width Joiner',
      category: 'invisible',
      isWatermark: true,
      description: 'Invisible zero-width character; joins neighboring characters, for example in emoji sequences'
    };
    if (code === 0xFEFF) return {
      char, code, hex,
      name: 'Zero Width No-Break Space',
      category: 'invisible',
      isWatermark: true,
      description: 'Byte order mark; invisible, normally found at the start of a file and can end up in copied text'
    };

    // Other invisible characters
    if (code === 0x2060) return { char, code, hex, name: 'Word Joiner', category: 'invisible', isWatermark: true };
    if (code === 0x180E) return { char, code, hex, name: 'Mongolian Vowel Separator', category: 'invisible', isWatermark: true };

    // Whitespace
    if (code === 0x0020) return { char, code, hex, name: 'Space', category: 'whitespace', isWatermark: false };
    if (code === 0x00A0) return { char, code, hex, name: 'Non-Breaking Space', category: 'whitespace', isWatermark: false };
    if (code === 0x0009) return { char, code, hex, name: 'Tab', category: 'whitespace', isWatermark: false };
    if (code === 0x000A) return { char, code, hex, name: 'Line Feed', category: 'whitespace', isWatermark: false };
    if (code === 0x000D) return { char, code, hex, name: 'Carriage Return', category: 'whitespace', isWatermark: false };

    // Control characters
    if (code < 0x20 || code === 0x7F) return {
      char, code, hex,
      name: `Control Character (${hex})`,
      category: 'control',
      isWatermark: false
    };

    // Directional marks
    if (code >= 0x200E && code <= 0x200F) return {
      char, code, hex,
      name: 'Directional Mark',
      category: 'suspicious',
      isWatermark: true,
      description: 'Text direction override'
    };
    if (code >= 0x202A && code <= 0x202E) return {
      char, code, hex,
      name: 'Directional Formatting',
      category: 'suspicious',
      isWatermark: true,
      description: 'Bidirectional text control'
    };

    // Normal character
    return { char, code, hex, name: 'Normal Character', category: 'normal', isWatermark: false };
  };

  const analyzeText = useCallback(() => {
    if (!inputText) {
      setDetectedCharacters([]);
      setStats({ total: 0, invisible: 0, suspicious: 0, watermarkLikelihood: 0 });
      setCleanedText('');
      return;
    }

    const chars = inputText.split('');
    const analyzed: CharacterInfo[] = [];
    let invisibleCount = 0;
    let suspiciousCount = 0;
    let watermarkChars = 0;
    let cleaned = '';

    chars.forEach(char => {
      const info = getCharacterInfo(char);

      if (info.category === 'invisible') {
        invisibleCount++;
        if (info.isWatermark) watermarkChars++;
      } else if (info.category === 'suspicious') {
        suspiciousCount++;
        if (info.isWatermark) watermarkChars++;
      } else {
        cleaned += char;
      }

      if (info.category !== 'normal' || showInvisible) {
        analyzed.push(info);
      }
    });

    // Calculate watermark likelihood (0-100)
    const totalSpecial = invisibleCount + suspiciousCount;
    const watermarkLikelihood = Math.min(
      100,
      Math.round((watermarkChars / Math.max(1, chars.length)) * 500) // Amplify small percentages
    );

    setDetectedCharacters(analyzed);
    setStats({
      total: chars.length,
      invisible: invisibleCount,
      suspicious: suspiciousCount,
      watermarkLikelihood
    });
    setCleanedText(cleaned);
  }, [inputText, showInvisible]);

  // Nach dem Einfügen steht der neue Text erst im nächsten Render im State,
  // deshalb erst dann analysieren (analyzeText ändert sich mit inputText)
  useEffect(() => {
    if (analyzeAfterPasteRef.current) {
      analyzeAfterPasteRef.current = false;
      analyzeText();
    }
  }, [analyzeText]);

  const handlePaste = (e: React.ClipboardEvent) => {
    // Auto-analyze on paste
    analyzeAfterPasteRef.current = true;
  };

  const copyCleanText = () => {
    navigator.clipboard.writeText(cleanedText);
  };

  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      stats,
      detectedCharacters: detectedCharacters.filter(c => c.isWatermark),
      originalLength: inputText.length,
      cleanedLength: cleanedText.length
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watermark-analysis-${Date.now()}.json`;
    a.click();
  };

  const getWatermarkAlert = () => {
    if (stats.watermarkLikelihood > 75) {
      return {
        variant: 'destructive' as const,
        title: 'Many flagged characters found',
        description: 'A high share of this text consists of invisible or unusual characters. The details show which ones.'
      };
    } else if (stats.watermarkLikelihood > 30) {
      return {
        variant: 'default' as const,
        title: 'Flagged characters found',
        description: 'This text contains a noticeable number of invisible or unusual characters. The details show which ones.'
      };
    } else if (stats.invisible > 0 || stats.suspicious > 0) {
      return {
        variant: 'default' as const,
        title: 'Hidden Characters Found',
        description: 'Some invisible or unusual characters detected, but only a small share of the text.'
      };
    }
    return null;
  };

  const alert = getWatermarkAlert();

  return (
    <>
      <div className="min-h-screen bg-background py-12">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Text Watermark Detector
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Detect hidden watermarks and invisible characters in text. The tool lists invisible and unusual Unicode characters that can end up in text copied from AI tools or other sources.
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Input Analysis
              </CardTitle>
              <CardDescription>
                Paste or type text to detect hidden watermarks and invisible characters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Textarea
                  placeholder="Paste your text here to check for hidden watermarks..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPaste={handlePaste}
                  className="min-h-[200px] font-mono"
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
                <Button onClick={analyzeText} className="bg-primary hover:bg-primary-glow">
                  <Search className="h-4 w-4 mr-2" />
                  Analyze Text
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowInvisible(!showInvisible)}
                >
                  {showInvisible ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                  {showInvisible ? 'Show All' : 'Hide Normal'}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-sm text-muted-foreground">Total Characters</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-500">{stats.invisible}</div>
                  <p className="text-sm text-muted-foreground">Invisible Characters</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-500">{stats.suspicious}</div>
                  <p className="text-sm text-muted-foreground">Suspicious Characters</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-primary">
                    {stats.watermarkLikelihood}%
                  </div>
                  <p className="text-sm text-muted-foreground">Flagged character score</p>
                </CardContent>
              </Card>
            </div>
          )}

          {detectedCharacters.length > 0 && (
            <Tabs defaultValue="visualization" className="mb-6">
              <TabsList>
                <TabsTrigger value="visualization">Visualization</TabsTrigger>
                <TabsTrigger value="details">Character Details</TabsTrigger>
                <TabsTrigger value="cleaned">Cleaned Text</TabsTrigger>
              </TabsList>

              <TabsContent value="visualization" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Text Visualization</CardTitle>
                    <CardDescription>
                      Hidden characters are highlighted and marked
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all">
                      {inputText.split('').map((char, idx) => {
                        const info = getCharacterInfo(char);
                        if (info.category === 'invisible') {
                          return (
                            <span
                              key={idx}
                              className="bg-red-500 text-white px-1 mx-0.5 rounded"
                              title={`${info.name} (U+${info.hex})`}
                            >
                              [U+{info.hex}]
                            </span>
                          );
                        } else if (info.category === 'suspicious') {
                          return (
                            <span
                              key={idx}
                              className="bg-orange-500 text-white px-1 mx-0.5 rounded"
                              title={`${info.name} (U+${info.hex})`}
                            >
                              [!]
                            </span>
                          );
                        } else if (info.category === 'whitespace') {
                          if (char === ' ') return <span key={idx} className="text-muted-foreground">·</span>;
                          if (char === '\t') return <span key={idx} className="text-muted-foreground">→</span>;
                          if (char === '\n') return <span key={idx} className="text-muted-foreground">↵<br /></span>;
                          return <span key={idx}>{char}</span>;
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
                    <CardTitle>Detected Special Characters</CardTitle>
                    <CardDescription>
                      Detailed analysis of non-standard characters
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {detectedCharacters
                        .filter(c => c.category !== 'normal')
                        .map((char, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-4">
                              <Badge
                                variant={
                                  char.isWatermark ? 'destructive' :
                                  char.category === 'suspicious' ? 'default' :
                                  'secondary'
                                }
                              >
                                {char.category}
                              </Badge>
                              <div>
                                <div className="font-semibold">{char.name}</div>
                                {char.description && (
                                  <div className="text-sm text-muted-foreground">
                                    {char.description}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right font-mono text-sm">
                              <div>U+{char.hex}</div>
                              <div className="text-muted-foreground">Code: {char.code}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cleaned" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Cleaned Text</CardTitle>
                    <CardDescription>
                      Text with the characters flagged as invisible or suspicious removed. All other characters stay unchanged.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={cleanedText}
                      readOnly
                      className="min-h-[200px] font-mono"
                    />
                    <div className="flex gap-2">
                      <Button onClick={copyCleanText}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Clean Text
                      </Button>
                      <Button variant="outline" onClick={downloadReport}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Educational Section */}
          <Card>
            <CardHeader>
              <CardTitle>About Text Watermarks</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Common Watermark Techniques</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                      <span><strong>Zero-Width Characters:</strong> Invisible Unicode characters embedded between words</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
                      <span><strong>Direction Marks:</strong> RTL/LTR override characters</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Why Check for Watermarks?</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500" />
                      <span><strong>Privacy:</strong> See invisible characters before passing a text on</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500" />
                      <span><strong>AI tools:</strong> Find invisible characters that can come along when copying from such tools</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500" />
                      <span><strong>Security:</strong> Find hidden malicious characters</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500" />
                      <span><strong>Data Integrity:</strong> Ensure clean text for processing</span>
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

export default WatermarkDetector;