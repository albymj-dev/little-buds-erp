import React, { createContext, useContext, useState, useEffect } from 'react';

export interface WordStyle {
  word: string;
  colorMode: 'word' | 'letter';
  wordColor: string;
  letterColors: string[];
}

export interface ElementFontSizes {
  brandTitle: number;
  brandSubtitle: number;
  pageHeading: number;
  subheading: number;
  kpiValue: number;
  kpiLabel: number;
  navText: number;
  buttonText: number;
  bodyText: number;
  tableText: number;
}

export interface TypographyPreset {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  secondaryAccentColor: string;
  brandTitleWords: WordStyle[];
  brandSubtitleWords: WordStyle[];
  elementFontSizes: ElementFontSizes;
}

export const RAINBOW_PALETTE = [
  '#E53935', // Red
  '#F5A623', // Orange / Sun Gold
  '#EAB308', // Yellow
  '#74B72E', // Green / Leaf
  '#0EA5E9', // Sky Blue
  '#6366F1', // Indigo
  '#A855F7', // Purple
  '#EC4899', // Pink
];

export const CURATED_SWATCHES = [
  { name: 'Sun Gold', hex: '#F5A623' },
  { name: 'Leaf Green', hex: '#558B2F' },
  { name: 'Bright Green', hex: '#74B72E' },
  { name: 'Sky Blue', hex: '#0284C7' },
  { name: 'Cyan Blue', hex: '#06B6D4' },
  { name: 'Tulip Coral', hex: '#E53935' },
  { name: 'Rose Red', hex: '#F43F5E' },
  { name: 'Earth Brown', hex: '#8D5B4C' },
  { name: 'Deep Indigo', hex: '#4338CA' },
  { name: 'Royal Purple', hex: '#7E22CE' },
  { name: 'Dark Slate', hex: '#0F172A' },
  { name: 'Pure White', hex: '#FFFFFF' },
];

export const DEFAULT_FONT_SIZES: ElementFontSizes = {
  brandTitle: 18,
  brandSubtitle: 10,
  pageHeading: 24,
  subheading: 14,
  kpiValue: 24,
  kpiLabel: 11,
  navText: 14,
  buttonText: 13,
  bodyText: 14,
  tableText: 13,
};

export function createWordStylesFromText(
  text: string,
  defaultWordColor = '#111827',
  customLetterColors?: string[][]
): WordStyle[] {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((w, wIdx) => {
    const letters = Array.from(w).map((_, chIdx) => {
      if (customLetterColors && customLetterColors[wIdx] && customLetterColors[wIdx][chIdx]) {
        return customLetterColors[wIdx][chIdx];
      }
      return defaultWordColor;
    });
    return {
      word: w,
      colorMode: 'word',
      wordColor: defaultWordColor,
      letterColors: letters,
    };
  });
}

const DEFAULT_BRAND_TITLE_WORDS: WordStyle[] = [
  {
    word: 'Little',
    colorMode: 'word',
    wordColor: '#111827',
    letterColors: ['#111827', '#111827', '#111827', '#111827', '#111827', '#111827'],
  },
  {
    word: 'Buds',
    colorMode: 'word',
    wordColor: '#558B2F',
    letterColors: ['#558B2F', '#558B2F', '#558B2F', '#558B2F'],
  },
];

const DEFAULT_BRAND_SUBTITLE_WORDS: WordStyle[] = [
  {
    word: 'Child',
    colorMode: 'word',
    wordColor: '#8D5B4C',
    letterColors: ['#8D5B4C', '#8D5B4C', '#8D5B4C', '#8D5B4C', '#8D5B4C'],
  },
  {
    word: 'Care',
    colorMode: 'word',
    wordColor: '#8D5B4C',
    letterColors: ['#8D5B4C', '#8D5B4C', '#8D5B4C', '#8D5B4C'],
  },
  {
    word: 'Centre',
    colorMode: 'word',
    wordColor: '#8D5B4C',
    letterColors: ['#8D5B4C', '#8D5B4C', '#8D5B4C', '#8D5B4C', '#8D5B4C', '#8D5B4C'],
  },
];

const DEFAULT_PAGE_HEADING_WORDS: WordStyle[] = [
  {
    word: 'Reports',
    colorMode: 'word',
    wordColor: '#111827',
    letterColors: ['#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827'],
  },
  {
    word: '&',
    colorMode: 'word',
    wordColor: '#558B2F',
    letterColors: ['#558B2F'],
  },
  {
    word: 'Financial',
    colorMode: 'word',
    wordColor: '#111827',
    letterColors: ['#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827'],
  },
  {
    word: 'Statements',
    colorMode: 'word',
    wordColor: '#111827',
    letterColors: ['#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827', '#111827'],
  },
];

export interface TypographyContextType {
  // Brand title & subtitle
  brandTitleWords: WordStyle[];
  brandSubtitleWords: WordStyle[];
  pageHeadingWords: WordStyle[];
  useCustomPageHeading: boolean;

  // Accent colours
  accentColor: string;
  secondaryAccentColor: string;

  // Element font sizes
  elementFontSizes: ElementFontSizes;

  // State controls
  isCustomizerOpen: boolean;
  setIsCustomizerOpen: (open: boolean) => void;

  // Modifiers
  updateWordColor: (
    target: 'brandTitle' | 'brandSubtitle' | 'pageHeading',
    wordIndex: number,
    color: string
  ) => void;
  updateLetterColor: (
    target: 'brandTitle' | 'brandSubtitle' | 'pageHeading',
    wordIndex: number,
    letterIndex: number,
    color: string
  ) => void;
  setWordColorMode: (
    target: 'brandTitle' | 'brandSubtitle' | 'pageHeading',
    wordIndex: number,
    mode: 'word' | 'letter'
  ) => void;
  setRainbowLettersOnWord: (
    target: 'brandTitle' | 'brandSubtitle' | 'pageHeading',
    wordIndex: number
  ) => void;
  setAccentColor: (color: string) => void;
  setSecondaryAccentColor: (color: string) => void;
  setElementFontSize: (element: keyof ElementFontSizes, size: number) => void;
  setCustomPageHeadingText: (text: string) => void;
  setUseCustomPageHeading: (use: boolean) => void;
  setCustomBrandTitleText: (text: string) => void;
  setCustomBrandSubtitleText: (text: string) => void;

  // Presets & Reset
  resetAll: () => void;
  resetFontSizes: () => void;
  applyPreset: (presetId: string) => void;
}

const STORAGE_KEY = 'littlebuds_typography_customization_v1';

const TypographyContext = createContext<TypographyContextType | undefined>(undefined);

export const TypographyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brandTitleWords, setBrandTitleWords] = useState<WordStyle[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.brandTitleWords) return parsed.brandTitleWords;
      }
    } catch (e) {
      console.warn('Failed to load typography settings from storage', e);
    }
    return DEFAULT_BRAND_TITLE_WORDS;
  });

  const [brandSubtitleWords, setBrandSubtitleWords] = useState<WordStyle[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.brandSubtitleWords) return parsed.brandSubtitleWords;
      }
    } catch (e) {
      console.warn('Failed to load subtitle typography', e);
    }
    return DEFAULT_BRAND_SUBTITLE_WORDS;
  });

  const [pageHeadingWords, setPageHeadingWords] = useState<WordStyle[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.pageHeadingWords) return parsed.pageHeadingWords;
      }
    } catch (e) {
      console.warn('Failed to load page heading typography', e);
    }
    return DEFAULT_PAGE_HEADING_WORDS;
  });

  const [useCustomPageHeading, setUseCustomPageHeading] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.useCustomPageHeading === 'boolean') return parsed.useCustomPageHeading;
      }
    } catch (e) {
      // ignore
    }
    return false;
  });

  const [accentColor, setAccentColor] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.accentColor) return parsed.accentColor;
      }
    } catch (e) {
      // ignore
    }
    return '#558B2F'; // Leaf Green default
  });

  const [secondaryAccentColor, setSecondaryAccentColor] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.secondaryAccentColor) return parsed.secondaryAccentColor;
      }
    } catch (e) {
      // ignore
    }
    return '#F5A623'; // Sun Gold default
  });

  const [elementFontSizes, setElementFontSizes] = useState<ElementFontSizes>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.elementFontSizes) {
          return { ...DEFAULT_FONT_SIZES, ...parsed.elementFontSizes };
        }
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_FONT_SIZES;
  });

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // Synchronize to localStorage
  useEffect(() => {
    try {
      const payload = {
        brandTitleWords,
        brandSubtitleWords,
        pageHeadingWords,
        useCustomPageHeading,
        accentColor,
        secondaryAccentColor,
        elementFontSizes,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to persist typography settings', e);
    }
  }, [
    brandTitleWords,
    brandSubtitleWords,
    pageHeadingWords,
    useCustomPageHeading,
    accentColor,
    secondaryAccentColor,
    elementFontSizes,
  ]);

  // CSS variables injection for global styles
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-accent-color', accentColor);
    root.style.setProperty('--app-secondary-accent', secondaryAccentColor);
    root.style.setProperty('--app-font-brand-title', `${elementFontSizes.brandTitle}px`);
    root.style.setProperty('--app-font-brand-subtitle', `${elementFontSizes.brandSubtitle}px`);
    root.style.setProperty('--app-font-page-heading', `${elementFontSizes.pageHeading}px`);
    root.style.setProperty('--app-font-subheading', `${elementFontSizes.subheading}px`);
    root.style.setProperty('--app-font-kpi', `${elementFontSizes.kpiValue}px`);
    root.style.setProperty('--app-font-nav', `${elementFontSizes.navText}px`);
    root.style.setProperty('--app-font-button', `${elementFontSizes.buttonText}px`);
    root.style.setProperty('--app-font-body', `${elementFontSizes.bodyText}px`);
  }, [accentColor, secondaryAccentColor, elementFontSizes]);

  const updateWordColor = (
    target: 'brandTitle' | 'brandSubtitle' | 'pageHeading',
    wordIndex: number,
    color: string
  ) => {
    const updater = (prev: WordStyle[]) => {
      const next = prev.map((w, i) => {
        if (i !== wordIndex) return w;
        return {
          ...w,
          wordColor: color,
          letterColors: w.letterColors.map(() => color),
        };
      });
      return next;
    };

    if (target === 'brandTitle') setBrandTitleWords(updater);
    else if (target === 'brandSubtitle') setBrandSubtitleWords(updater);
    else setPageHeadingWords(updater);
  };

  const updateLetterColor = (
    target: 'brandTitle' | 'brandSubtitle' | 'pageHeading',
    wordIndex: number,
    letterIndex: number,
    color: string
  ) => {
    const updater = (prev: WordStyle[]) => {
      const next = prev.map((w, i) => {
        if (i !== wordIndex) return w;
        const newLetters = [...w.letterColors];
        newLetters[letterIndex] = color;
        return {
          ...w,
          colorMode: 'letter' as const,
          letterColors: newLetters,
        };
      });
      return next;
    };

    if (target === 'brandTitle') setBrandTitleWords(updater);
    else if (target === 'brandSubtitle') setBrandSubtitleWords(updater);
    else setPageHeadingWords(updater);
  };

  const setWordColorMode = (
    target: 'brandTitle' | 'brandSubtitle' | 'pageHeading',
    wordIndex: number,
    mode: 'word' | 'letter'
  ) => {
    const updater = (prev: WordStyle[]) => {
      return prev.map((w, i) => {
        if (i !== wordIndex) return w;
        return {
          ...w,
          colorMode: mode,
        };
      });
    };

    if (target === 'brandTitle') setBrandTitleWords(updater);
    else if (target === 'brandSubtitle') setBrandSubtitleWords(updater);
    else setPageHeadingWords(updater);
  };

  const setRainbowLettersOnWord = (
    target: 'brandTitle' | 'brandSubtitle' | 'pageHeading',
    wordIndex: number
  ) => {
    const updater = (prev: WordStyle[]) => {
      return prev.map((w, i) => {
        if (i !== wordIndex) return w;
        const letters = Array.from(w.word).map((_, lIdx) => {
          return RAINBOW_PALETTE[lIdx % RAINBOW_PALETTE.length];
        });
        return {
          ...w,
          colorMode: 'letter' as const,
          letterColors: letters,
        };
      });
    };

    if (target === 'brandTitle') setBrandTitleWords(updater);
    else if (target === 'brandSubtitle') setBrandSubtitleWords(updater);
    else setPageHeadingWords(updater);
  };

  const setElementFontSize = (element: keyof ElementFontSizes, size: number) => {
    setElementFontSizes((prev) => ({
      ...prev,
      [element]: Math.max(8, Math.min(60, size)),
    }));
  };

  const setCustomPageHeadingText = (text: string) => {
    setPageHeadingWords(createWordStylesFromText(text, '#111827'));
    setUseCustomPageHeading(true);
  };

  const setCustomBrandTitleText = (text: string) => {
    setBrandTitleWords(createWordStylesFromText(text, '#111827'));
  };

  const setCustomBrandSubtitleText = (text: string) => {
    setBrandSubtitleWords(createWordStylesFromText(text, '#8D5B4C'));
  };

  const resetFontSizes = () => {
    setElementFontSizes(DEFAULT_FONT_SIZES);
  };

  const resetAll = () => {
    setBrandTitleWords(DEFAULT_BRAND_TITLE_WORDS);
    setBrandSubtitleWords(DEFAULT_BRAND_SUBTITLE_WORDS);
    setPageHeadingWords(DEFAULT_PAGE_HEADING_WORDS);
    setUseCustomPageHeading(false);
    setAccentColor('#558B2F');
    setSecondaryAccentColor('#F5A623');
    setElementFontSizes(DEFAULT_FONT_SIZES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  };

  const applyPreset = (presetId: string) => {
    if (presetId === 'classic') {
      resetAll();
    } else if (presetId === 'rainbow') {
      setBrandTitleWords([
        {
          word: 'Little',
          colorMode: 'letter',
          wordColor: '#111827',
          letterColors: ['#E53935', '#F5A623', '#EAB308', '#74B72E', '#0EA5E9', '#A855F7'],
        },
        {
          word: 'Buds',
          colorMode: 'letter',
          wordColor: '#558B2F',
          letterColors: ['#E53935', '#F5A623', '#0EA5E9', '#74B72E'],
        },
      ]);
      setAccentColor('#F5A623');
      setSecondaryAccentColor('#74B72E');
    } else if (presetId === 'forest') {
      setBrandTitleWords([
        {
          word: 'Little',
          colorMode: 'word',
          wordColor: '#1E3A1E',
          letterColors: ['#1E3A1E', '#1E3A1E', '#1E3A1E', '#1E3A1E', '#1E3A1E', '#1E3A1E'],
        },
        {
          word: 'Buds',
          colorMode: 'word',
          wordColor: '#2E7D32',
          letterColors: ['#2E7D32', '#2E7D32', '#2E7D32', '#2E7D32'],
        },
      ]);
      setAccentColor('#2E7D32');
      setSecondaryAccentColor('#81C784');
    } else if (presetId === 'ocean') {
      setBrandTitleWords([
        {
          word: 'Little',
          colorMode: 'word',
          wordColor: '#0F172A',
          letterColors: ['#0F172A', '#0F172A', '#0F172A', '#0F172A', '#0F172A', '#0F172A'],
        },
        {
          word: 'Buds',
          colorMode: 'word',
          wordColor: '#0284C7',
          letterColors: ['#0284C7', '#0284C7', '#0284C7', '#0284C7'],
        },
      ]);
      setAccentColor('#0284C7');
      setSecondaryAccentColor('#38BDF8');
    } else if (presetId === 'sunset') {
      setBrandTitleWords([
        {
          word: 'Little',
          colorMode: 'word',
          wordColor: '#9A3412',
          letterColors: ['#9A3412', '#9A3412', '#9A3412', '#9A3412', '#9A3412', '#9A3412'],
        },
        {
          word: 'Buds',
          colorMode: 'word',
          wordColor: '#EA580C',
          letterColors: ['#EA580C', '#EA580C', '#EA580C', '#EA580C'],
        },
      ]);
      setAccentColor('#EA580C');
      setSecondaryAccentColor('#F5A623');
    } else if (presetId === 'royal') {
      setBrandTitleWords([
        {
          word: 'Little',
          colorMode: 'word',
          wordColor: '#1E1B4B',
          letterColors: ['#1E1B4B', '#1E1B4B', '#1E1B4B', '#1E1B4B', '#1E1B4B', '#1E1B4B'],
        },
        {
          word: 'Buds',
          colorMode: 'word',
          wordColor: '#7C3AED',
          letterColors: ['#7C3AED', '#7C3AED', '#7C3AED', '#7C3AED'],
        },
      ]);
      setAccentColor('#7C3AED');
      setSecondaryAccentColor('#C084FC');
    }
  };

  return (
    <TypographyContext.Provider
      value={{
        brandTitleWords,
        brandSubtitleWords,
        pageHeadingWords,
        useCustomPageHeading,
        accentColor,
        secondaryAccentColor,
        elementFontSizes,
        isCustomizerOpen,
        setIsCustomizerOpen,
        updateWordColor,
        updateLetterColor,
        setWordColorMode,
        setRainbowLettersOnWord,
        setAccentColor,
        setSecondaryAccentColor,
        setElementFontSize,
        setCustomPageHeadingText,
        setUseCustomPageHeading,
        setCustomBrandTitleText,
        setCustomBrandSubtitleText,
        resetAll,
        resetFontSizes,
        applyPreset,
      }}
    >
      {children}
    </TypographyContext.Provider>
  );
};

export const useTypography = (): TypographyContextType => {
  const context = useContext(TypographyContext);
  if (!context) {
    throw new Error('useTypography must be used within a TypographyProvider');
  }
  return context;
};
