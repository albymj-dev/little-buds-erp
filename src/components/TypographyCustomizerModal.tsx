import React, { useState } from 'react';
import {
  useTypography,
  CURATED_SWATCHES,
  RAINBOW_PALETTE,
  DEFAULT_FONT_SIZES,
  ElementFontSizes,
  createWordStylesFromText,
} from '../contexts/TypographyContext';
import { StyledWordText } from './StyledWordText';
import { LittleBudsLogo } from './Logo';
import {
  X,
  Palette,
  Type,
  Sparkles,
  RotateCcw,
  Check,
  Sliders,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  Wand2,
} from 'lucide-react';

export const TypographyCustomizerModal: React.FC = () => {
  const {
    brandTitleWords,
    brandSubtitleWords,
    pageHeadingWords,
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
    setCustomBrandTitleText,
    setCustomBrandSubtitleText,
    resetAll,
    resetFontSizes,
    applyPreset,
  } = useTypography();

  // Active top-level tab in customizer modal
  const [activeTab, setActiveTab] = useState<'textColors' | 'accentColor' | 'fontSizes' | 'presets'>('textColors');

  // Under 'textColors', which target element are we styling?
  const [targetElement, setTargetElement] = useState<'brandTitle' | 'brandSubtitle' | 'pageHeading' | 'customStudio'>('brandTitle');

  // Currently selected word index for letter-by-letter editing
  const [selectedWordIdx, setSelectedWordIdx] = useState<number>(0);

  // Currently selected letter index within that word
  const [selectedLetterIdx, setSelectedLetterIdx] = useState<number>(0);

  // Custom studio state for free-form custom words
  const [customStudioText, setCustomStudioText] = useState('Little Buds Centre');
  const [customStudioWords, setCustomStudioWords] = useState(() =>
    createWordStylesFromText('Little Buds Centre', '#111827')
  );

  if (!isCustomizerOpen) return null;

  // Active words array based on targetElement
  const currentTargetWords =
    targetElement === 'brandTitle'
      ? brandTitleWords
      : targetElement === 'brandSubtitle'
      ? brandSubtitleWords
      : targetElement === 'pageHeading'
      ? pageHeadingWords
      : customStudioWords;

  // Safe selected word
  const currentWord = currentTargetWords[selectedWordIdx] || currentTargetWords[0];
  const safeWordIdx = Math.min(selectedWordIdx, Math.max(0, currentTargetWords.length - 1));

  const handleSelectWord = (idx: number) => {
    setSelectedWordIdx(idx);
    setSelectedLetterIdx(0);
  };

  const handleUpdateLetterColor = (color: string) => {
    if (targetElement === 'customStudio') {
      setCustomStudioWords((prev) =>
        prev.map((w, wIdx) => {
          if (wIdx !== safeWordIdx) return w;
          const newLetters = [...w.letterColors];
          newLetters[selectedLetterIdx] = color;
          return {
            ...w,
            colorMode: 'letter',
            letterColors: newLetters,
          };
        })
      );
    } else {
      updateLetterColor(targetElement, safeWordIdx, selectedLetterIdx, color);
    }
  };

  const handleUpdateWordColor = (color: string) => {
    if (targetElement === 'customStudio') {
      setCustomStudioWords((prev) =>
        prev.map((w, wIdx) => {
          if (wIdx !== safeWordIdx) return w;
          return {
            ...w,
            colorMode: 'word',
            wordColor: color,
            letterColors: w.letterColors.map(() => color),
          };
        })
      );
    } else {
      updateWordColor(targetElement, safeWordIdx, color);
    }
  };

  const handleSetColorMode = (mode: 'word' | 'letter') => {
    if (targetElement === 'customStudio') {
      setCustomStudioWords((prev) =>
        prev.map((w, wIdx) => {
          if (wIdx !== safeWordIdx) return w;
          return { ...w, colorMode: mode };
        })
      );
    } else {
      setWordColorMode(targetElement, safeWordIdx, mode);
    }
  };

  const handleRainbowWord = () => {
    if (targetElement === 'customStudio') {
      setCustomStudioWords((prev) =>
        prev.map((w, wIdx) => {
          if (wIdx !== safeWordIdx) return w;
          const letters = Array.from(w.word).map(
            (_, lIdx) => RAINBOW_PALETTE[lIdx % RAINBOW_PALETTE.length]
          );
          return { ...w, colorMode: 'letter', letterColors: letters };
        })
      );
    } else {
      setRainbowLettersOnWord(targetElement, safeWordIdx);
    }
  };

  const handleApplyCustomStudioToBrand = () => {
    setCustomBrandTitleText(customStudioText);
    setTargetElement('brandTitle');
  };

  const handleApplyCustomStudioToHeading = () => {
    setCustomPageHeadingText(customStudioText);
    setTargetElement('pageHeading');
  };

  const currentSelectedLetterColor =
    currentWord?.colorMode === 'letter' &&
    currentWord?.letterColors &&
    currentWord.letterColors[selectedLetterIdx]
      ? currentWord.letterColors[selectedLetterIdx]
      : currentWord?.wordColor || '#111827';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-linear-to-r from-stone-50 via-white to-stone-50">
          <div className="flex items-center space-x-3">
            <div
              className="p-2 rounded-xl text-white shadow-xs"
              style={{ backgroundColor: accentColor }}
            >
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                Typography & Styling Studio
                <span
                  className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full text-white"
                  style={{ backgroundColor: secondaryAccentColor }}
                >
                  Live Customizer
                </span>
              </h2>
              <p className="text-xs text-stone-500">
                Change letter colors, word colors, accent colors separately, and font size for each element.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCustomizerOpen(false)}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
            title="Close Customizer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Real-Time Banner Preview */}
        <div className="bg-stone-100/80 px-5 py-3 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> Live Preview:
            </span>
            {/* Brand preview */}
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-2xs">
              <LittleBudsLogo className="h-6 w-6" />
              <div className="flex flex-col">
                <StyledWordText
                  words={brandTitleWords}
                  fontSize={elementFontSizes.brandTitle}
                  className="font-extrabold tracking-tight leading-none"
                />
                <StyledWordText
                  words={brandSubtitleWords}
                  fontSize={elementFontSizes.brandSubtitle}
                  className="font-semibold uppercase tracking-wider leading-none mt-0.5"
                />
              </div>
            </div>
            {/* Accent badge preview */}
            <div
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-2xs flex items-center gap-1.5"
              style={{ backgroundColor: accentColor }}
            >
              <Check className="h-3 w-3" />
              Accent Active
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={resetAll}
              className="inline-flex items-center px-2.5 py-1 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 font-medium transition-colors"
            >
              <RotateCcw className="h-3 w-3 mr-1 text-stone-400" />
              Reset Defaults
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-stone-200 px-5 bg-stone-50/50">
          <nav className="flex space-x-6 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('textColors')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'textColors'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <Type className="h-4 w-4" />
              Letter & Word Colours
            </button>
            <button
              onClick={() => setActiveTab('accentColor')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'accentColor'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <Palette className="h-4 w-4" />
              Accent Colours (Separate)
            </button>
            <button
              onClick={() => setActiveTab('fontSizes')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'fontSizes'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Font Size of Each Element
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'presets'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Presets & Themes
            </button>
          </nav>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: LETTER & WORD COLOURS */}
          {activeTab === 'textColors' && (
            <div className="space-y-6">
              {/* Target Element Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                  Select Element to Color:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      setTargetElement('brandTitle');
                      setSelectedWordIdx(0);
                      setSelectedLetterIdx(0);
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-left font-semibold text-xs sm:text-sm transition-all ${
                      targetElement === 'brandTitle'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-[10px] text-stone-400 uppercase font-bold">Brand Title</div>
                    <div className="truncate mt-0.5">Little Buds</div>
                  </button>

                  <button
                    onClick={() => {
                      setTargetElement('brandSubtitle');
                      setSelectedWordIdx(0);
                      setSelectedLetterIdx(0);
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-left font-semibold text-xs sm:text-sm transition-all ${
                      targetElement === 'brandSubtitle'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-[10px] text-stone-400 uppercase font-bold">Brand Subtitle</div>
                    <div className="truncate mt-0.5">Child Care Centre</div>
                  </button>

                  <button
                    onClick={() => {
                      setTargetElement('pageHeading');
                      setSelectedWordIdx(0);
                      setSelectedLetterIdx(0);
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-left font-semibold text-xs sm:text-sm transition-all ${
                      targetElement === 'pageHeading'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-[10px] text-stone-400 uppercase font-bold">Page Main Heading</div>
                    <div className="truncate mt-0.5">Reports & Finances</div>
                  </button>

                  <button
                    onClick={() => {
                      setTargetElement('customStudio');
                      setSelectedWordIdx(0);
                      setSelectedLetterIdx(0);
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-left font-semibold text-xs sm:text-sm transition-all ${
                      targetElement === 'customStudio'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-2xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-[10px] text-purple-500 uppercase font-bold">Word Studio</div>
                    <div className="truncate mt-0.5">Custom Words</div>
                  </button>
                </div>
              </div>

              {/* Freeform Studio input if customStudio selected */}
              {targetElement === 'customStudio' && (
                <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                      Type Any Word or Phrase to Color:
                    </label>
                    <span className="text-[11px] text-purple-600">Edit letters below</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customStudioText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomStudioText(val);
                        setCustomStudioWords(createWordStylesFromText(val, '#111827'));
                        setSelectedWordIdx(0);
                        setSelectedLetterIdx(0);
                      }}
                      className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder="e.g. Welcome Little Buds"
                    />
                    <button
                      onClick={handleApplyCustomStudioToBrand}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      title="Set as Brand Title"
                    >
                      Use as Brand Title
                    </button>
                    <button
                      onClick={handleApplyCustomStudioToHeading}
                      className="px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      title="Set as Page Heading"
                    >
                      Use as Page Heading
                    </button>
                  </div>
                </div>
              )}

              {/* Word Selector Chips */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                  1. Pick Word to Style:
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {currentTargetWords.map((w, idx) => {
                    const isSelected = idx === safeWordIdx;
                    return (
                      <button
                        key={`${w.word}-${idx}`}
                        onClick={() => handleSelectWord(idx)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <span>"{w.word}"</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                            w.colorMode === 'letter'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {w.colorMode === 'letter' ? 'Per Letter' : 'Whole Word'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coloring Mode & Controls for the active word */}
              {currentWord && (
                <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">
                        Styling Word: <span className="text-emerald-700 font-extrabold">"{currentWord.word}"</span>
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Choose whether to apply color to the whole word or each individual letter.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSetColorMode('word')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          currentWord.colorMode === 'word'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        Color as Whole Word
                      </button>
                      <button
                        onClick={() => handleSetColorMode('letter')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          currentWord.colorMode === 'letter'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        Color Each Letter
                      </button>
                    </div>
                  </div>

                  {/* SUB-SECTION A: LETTER-BY-LETTER COLORING */}
                  {currentWord.colorMode === 'letter' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                          Click a letter to change its color:
                        </label>
                        <button
                          onClick={handleRainbowWord}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg shadow-2xs transition-colors"
                        >
                          <Wand2 className="h-3 w-3 mr-1 text-purple-600" />
                          Rainbow All Letters
                        </button>
                      </div>

                      {/* Interactive Letter Tiles */}
                      <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-stone-200">
                        {Array.from(currentWord.word).map((char, charIdx) => {
                          const isCharSelected = charIdx === selectedLetterIdx;
                          const letterColor =
                            currentWord.letterColors && currentWord.letterColors[charIdx]
                              ? currentWord.letterColors[charIdx]
                              : currentWord.wordColor;

                          return (
                            <button
                              key={`${char}-${charIdx}`}
                              onClick={() => setSelectedLetterIdx(charIdx)}
                              className={`flex flex-col items-center justify-center w-11 h-13 rounded-xl font-mono text-xl font-black border transition-all ${
                                isCharSelected
                                  ? 'border-stone-900 ring-2 ring-stone-900 shadow-sm scale-105 bg-stone-50'
                                  : 'border-stone-200 bg-white hover:border-stone-400'
                              }`}
                            >
                              <span style={{ color: letterColor }}>{char}</span>
                              <span
                                className="w-2.5 h-2.5 rounded-full mt-1 border border-black/10"
                                style={{ backgroundColor: letterColor }}
                              />
                            </button>
                          );
                        })}
                      </div>

                      {/* Palette for the currently selected letter */}
                      <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-700">
                            Color for letter{' '}
                            <span className="font-mono text-base font-extrabold px-1.5 py-0.5 bg-stone-100 rounded border border-stone-200 text-stone-900">
                              '{currentWord.word[selectedLetterIdx]}'
                            </span>{' '}
                            (Position {selectedLetterIdx + 1}):
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold text-stone-500">
                              {currentSelectedLetterColor}
                            </span>
                            <div
                              className="w-5 h-5 rounded-md border border-stone-300 shadow-2xs"
                              style={{ backgroundColor: currentSelectedLetterColor }}
                            />
                          </div>
                        </div>

                        {/* Quick Swatch Circles */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {CURATED_SWATCHES.map((swatch) => (
                            <button
                              key={swatch.hex}
                              onClick={() => handleUpdateLetterColor(swatch.hex)}
                              title={swatch.name}
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-transform hover:scale-110 shadow-2xs ${
                                currentSelectedLetterColor.toLowerCase() === swatch.hex.toLowerCase()
                                  ? 'ring-2 ring-stone-900 border-white'
                                  : 'border-stone-300'
                              }`}
                              style={{ backgroundColor: swatch.hex }}
                            >
                              {currentSelectedLetterColor.toLowerCase() === swatch.hex.toLowerCase() && (
                                <Check
                                  className={`h-4 w-4 ${
                                    swatch.hex === '#FFFFFF' ? 'text-black' : 'text-white'
                                  }`}
                                />
                              )}
                            </button>
                          ))}
                        </div>

                        {/* Custom Color Picker input */}
                        <div className="flex items-center space-x-3 pt-2 border-t border-stone-100">
                          <label className="text-xs font-semibold text-stone-600">
                            Custom Color Picker:
                          </label>
                          <input
                            type="color"
                            value={currentSelectedLetterColor}
                            onChange={(e) => handleUpdateLetterColor(e.target.value)}
                            className="w-9 h-8 p-0 border border-stone-300 rounded-lg cursor-pointer bg-white"
                          />
                          <input
                            type="text"
                            value={currentSelectedLetterColor}
                            onChange={(e) => handleUpdateLetterColor(e.target.value)}
                            className="w-24 px-2 py-1 text-xs font-mono font-semibold uppercase border border-stone-300 rounded-lg"
                            placeholder="#000000"
                          />
                          {selectedLetterIdx < currentWord.word.length - 1 && (
                            <button
                              onClick={() => setSelectedLetterIdx((prev) => prev + 1)}
                              className="ml-auto text-xs font-bold text-stone-600 hover:text-stone-900 underline"
                            >
                              Next Letter →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* SUB-SECTION B: WHOLE WORD COLORING */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                          Pick Color for Whole Word "{currentWord.word}":
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-stone-500">
                            {currentWord.wordColor}
                          </span>
                          <div
                            className="w-5 h-5 rounded-md border border-stone-300 shadow-2xs"
                            style={{ backgroundColor: currentWord.wordColor }}
                          />
                        </div>
                      </div>

                      {/* Curated Swatches for Whole Word */}
                      <div className="flex flex-wrap gap-2.5 p-3 bg-white rounded-xl border border-stone-200">
                        {CURATED_SWATCHES.map((swatch) => (
                          <button
                            key={swatch.hex}
                            onClick={() => handleUpdateWordColor(swatch.hex)}
                            title={swatch.name}
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-transform hover:scale-105 shadow-2xs ${
                              currentWord.wordColor.toLowerCase() === swatch.hex.toLowerCase()
                                ? 'ring-2 ring-stone-900 border-white'
                                : 'border-stone-300'
                            }`}
                            style={{ backgroundColor: swatch.hex }}
                          >
                            {currentWord.wordColor.toLowerCase() === swatch.hex.toLowerCase() && (
                              <Check
                                className={`h-4 w-4 ${
                                  swatch.hex === '#FFFFFF' ? 'text-black' : 'text-white'
                                }`}
                              />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Custom Color Picker for Whole Word */}
                      <div className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-stone-200">
                        <label className="text-xs font-semibold text-stone-600">
                          Custom Hex or Eyedropper:
                        </label>
                        <input
                          type="color"
                          value={currentWord.wordColor}
                          onChange={(e) => handleUpdateWordColor(e.target.value)}
                          className="w-10 h-8 p-0 border border-stone-300 rounded-lg cursor-pointer bg-white"
                        />
                        <input
                          type="text"
                          value={currentWord.wordColor}
                          onChange={(e) => handleUpdateWordColor(e.target.value)}
                          className="w-24 px-2 py-1 text-xs font-mono font-semibold uppercase border border-stone-300 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACCENT COLOURS (SEPARATE) */}
          {activeTab === 'accentColor' && (
            <div className="space-y-6">
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 flex items-start space-x-3">
                <Palette className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 space-y-1">
                  <p className="font-bold">Accent Colours are Managed Separately</p>
                  <p>
                    These control the application's visual chrome, including the active sidebar navigation items,
                    primary action buttons, table highlights, tabs, and status badges.
                  </p>
                </div>
              </div>

              {/* Primary Accent Color */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Primary Accent Colour</h3>
                    <p className="text-xs text-stone-500">
                      Applied to active navigation link, primary buttons, and highlight rings.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-stone-600">{accentColor}</span>
                    <div
                      className="w-7 h-7 rounded-lg border border-stone-300 shadow-2xs"
                      style={{ backgroundColor: accentColor }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {CURATED_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.hex}
                      onClick={() => setAccentColor(swatch.hex)}
                      title={swatch.name}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-transform hover:scale-105 shadow-2xs ${
                        accentColor.toLowerCase() === swatch.hex.toLowerCase()
                          ? 'ring-2 ring-stone-900 border-white'
                          : 'border-stone-300'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {accentColor.toLowerCase() === swatch.hex.toLowerCase() && (
                        <Check
                          className={`h-4 w-4 ${
                            swatch.hex === '#FFFFFF' ? 'text-black' : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-3 pt-2 border-t border-stone-100">
                  <label className="text-xs font-semibold text-stone-600">Custom Accent Picker:</label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-9 h-8 p-0 border border-stone-300 rounded-lg cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-24 px-2 py-1 text-xs font-mono font-semibold uppercase border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Secondary Accent Color */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Secondary Accent Colour</h3>
                    <p className="text-xs text-stone-500">
                      Applied to status tags, notification pills, and secondary badges.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-stone-600">
                      {secondaryAccentColor}
                    </span>
                    <div
                      className="w-7 h-7 rounded-lg border border-stone-300 shadow-2xs"
                      style={{ backgroundColor: secondaryAccentColor }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {CURATED_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.hex}
                      onClick={() => setSecondaryAccentColor(swatch.hex)}
                      title={swatch.name}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-transform hover:scale-105 shadow-2xs ${
                        secondaryAccentColor.toLowerCase() === swatch.hex.toLowerCase()
                          ? 'ring-2 ring-stone-900 border-white'
                          : 'border-stone-300'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {secondaryAccentColor.toLowerCase() === swatch.hex.toLowerCase() && (
                        <Check
                          className={`h-4 w-4 ${
                            swatch.hex === '#FFFFFF' ? 'text-black' : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-3 pt-2 border-t border-stone-100">
                  <label className="text-xs font-semibold text-stone-600">Custom Secondary Picker:</label>
                  <input
                    type="color"
                    value={secondaryAccentColor}
                    onChange={(e) => setSecondaryAccentColor(e.target.value)}
                    className="w-9 h-8 p-0 border border-stone-300 rounded-lg cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={secondaryAccentColor}
                    onChange={(e) => setSecondaryAccentColor(e.target.value)}
                    className="w-24 px-2 py-1 text-xs font-mono font-semibold uppercase border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Accent Live Preview Box */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-3">
                  Live Accent Elements Preview:
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="px-4 py-2 rounded-xl font-bold text-xs text-white shadow-xs"
                    style={{ backgroundColor: accentColor }}
                  >
                    Primary Action Button
                  </button>
                  <div
                    className="px-3 py-1.5 rounded-lg border font-semibold text-xs flex items-center gap-2"
                    style={{
                      borderColor: accentColor,
                      color: accentColor,
                      backgroundColor: `${accentColor}15`,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                    Active Sidebar Item Style
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-2xs"
                    style={{ backgroundColor: secondaryAccentColor }}
                  >
                    Secondary Tag / Pill
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FONT SIZE OF EACH ELEMENT */}
          {activeTab === 'fontSizes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Fine-Grained Font Size Controls</h3>
                  <p className="text-xs text-stone-500">
                    Adjust font size in pixels independently for each layout element.
                  </p>
                </div>
                <button
                  onClick={resetFontSizes}
                  className="px-3 py-1.5 text-xs font-bold text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                >
                  Reset All Font Sizes
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Brand Title */}
                <FontSizeSliderCard
                  title="Brand Title"
                  description="Main logo brand name (e.g. 'LittleBuds')"
                  value={elementFontSizes.brandTitle}
                  defaultValue={DEFAULT_FONT_SIZES.brandTitle}
                  min={12}
                  max={36}
                  onChange={(val) => setElementFontSize('brandTitle', val)}
                />

                {/* 2. Brand Subtitle */}
                <FontSizeSliderCard
                  title="Brand Subtitle"
                  description="Logo subtitle text (e.g. 'Child Care Centre')"
                  value={elementFontSizes.brandSubtitle}
                  defaultValue={DEFAULT_FONT_SIZES.brandSubtitle}
                  min={8}
                  max={18}
                  onChange={(val) => setElementFontSize('brandSubtitle', val)}
                />

                {/* 3. Page Main Heading (H1) */}
                <FontSizeSliderCard
                  title="Page Main Heading (H1)"
                  description="Top title (e.g. 'Reports & Financial Statements')"
                  value={elementFontSizes.pageHeading}
                  defaultValue={DEFAULT_FONT_SIZES.pageHeading}
                  min={16}
                  max={42}
                  onChange={(val) => setElementFontSize('pageHeading', val)}
                />

                {/* 4. Subheadings & Descriptions */}
                <FontSizeSliderCard
                  title="Subheadings & Descriptions"
                  description="Explanatory text below headings and card captions"
                  value={elementFontSizes.subheading}
                  defaultValue={DEFAULT_FONT_SIZES.subheading}
                  min={10}
                  max={20}
                  onChange={(val) => setElementFontSize('subheading', val)}
                />

                {/* 5. Card KPI Metric Values */}
                <FontSizeSliderCard
                  title="Card KPI Metric Numbers"
                  description="Bold financial totals & numerical metrics"
                  value={elementFontSizes.kpiValue}
                  defaultValue={DEFAULT_FONT_SIZES.kpiValue}
                  min={16}
                  max={38}
                  onChange={(val) => setElementFontSize('kpiValue', val)}
                />

                {/* 5b. Card KPI Labels */}
                <FontSizeSliderCard
                  title="Card KPI Header Labels"
                  description="Titles and badges above metric numbers"
                  value={elementFontSizes.kpiLabel}
                  defaultValue={DEFAULT_FONT_SIZES.kpiLabel}
                  min={9}
                  max={16}
                  onChange={(val) => setElementFontSize('kpiLabel', val)}
                />

                {/* 6. Navigation Link Text */}
                <FontSizeSliderCard
                  title="Sidebar Navigation Links"
                  description="Text inside sidebar menu items"
                  value={elementFontSizes.navText}
                  defaultValue={DEFAULT_FONT_SIZES.navText}
                  min={11}
                  max={20}
                  onChange={(val) => setElementFontSize('navText', val)}
                />

                {/* 7. Buttons & Badges */}
                <FontSizeSliderCard
                  title="Action Buttons Text"
                  description="Text inside toolbar buttons and submit controls"
                  value={elementFontSizes.buttonText}
                  defaultValue={DEFAULT_FONT_SIZES.buttonText}
                  min={11}
                  max={18}
                  onChange={(val) => setElementFontSize('buttonText', val)}
                />

                {/* 8. Body & Table Text */}
                <FontSizeSliderCard
                  title="Body & Table Text"
                  description="General paragraphs and tabular statement items"
                  value={elementFontSizes.bodyText}
                  defaultValue={DEFAULT_FONT_SIZES.bodyText}
                  min={11}
                  max={18}
                  onChange={(val) => setElementFontSize('bodyText', val)}
                />
              </div>
            </div>
          )}

          {/* TAB 4: PRESETS & THEMES */}
          {activeTab === 'presets' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Curated Styling Themes</h3>
                <p className="text-xs text-stone-500">
                  Select a pre-designed harmonious palette for words, letters, and accents.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Preset 1: LittleBuds Classic */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900">LittleBuds Original</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Default
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Natural Leaf Green accent, Sun Gold secondary, and crisp charcoal title typography.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <div className="flex space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#111827]" />
                      <span className="w-5 h-5 rounded-full bg-[#558B2F]" />
                      <span className="w-5 h-5 rounded-full bg-[#F5A623]" />
                      <span className="w-5 h-5 rounded-full bg-[#8D5B4C]" />
                    </div>
                    <button
                      onClick={() => applyPreset('classic')}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold transition-colors"
                    >
                      Apply Classic
                    </button>
                  </div>
                </div>

                {/* Preset 2: Candy Rainbow */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 hover:border-purple-300 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900">Joyful Rainbow</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                        Letter-by-Letter
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Every individual letter in 'Little' and 'Buds' styled in joyful alternating rainbow colors.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <div className="flex space-x-1">
                      {RAINBOW_PALETTE.slice(0, 5).map((c) => (
                        <span key={c} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <button
                      onClick={() => applyPreset('rainbow')}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                    >
                      Apply Rainbow
                    </button>
                  </div>
                </div>

                {/* Preset 3: Forest Meadow */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 hover:border-green-300 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900">Forest Meadow</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Deep pine green brand wording, emerald green accents, and sage borders.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <div className="flex space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#1E3A1E]" />
                      <span className="w-5 h-5 rounded-full bg-[#2E7D32]" />
                      <span className="w-5 h-5 rounded-full bg-[#81C784]" />
                    </div>
                    <button
                      onClick={() => applyPreset('forest')}
                      className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                    >
                      Apply Forest
                    </button>
                  </div>
                </div>

                {/* Preset 4: Ocean Sky */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 hover:border-sky-300 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900">Ocean Sky</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Deep navy slate wording, crisp sky blue accents, and electric cyan tags.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <div className="flex space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#0F172A]" />
                      <span className="w-5 h-5 rounded-full bg-[#0284C7]" />
                      <span className="w-5 h-5 rounded-full bg-[#38BDF8]" />
                    </div>
                    <button
                      onClick={() => applyPreset('ocean')}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                    >
                      Apply Ocean
                    </button>
                  </div>
                </div>

                {/* Preset 5: Sunset Warmth */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 hover:border-orange-300 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900">Sunset Warmth</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Warm burnt terracotta wording, vibrant tangerine accent, and golden sun badges.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <div className="flex space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#9A3412]" />
                      <span className="w-5 h-5 rounded-full bg-[#EA580C]" />
                      <span className="w-5 h-5 rounded-full bg-[#F5A623]" />
                    </div>
                    <button
                      onClick={() => applyPreset('sunset')}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                    >
                      Apply Sunset
                    </button>
                  </div>
                </div>

                {/* Preset 6: Royal Amethyst */}
                <div className="bg-white p-4 rounded-xl border border-stone-200 hover:border-purple-300 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900">Royal Amethyst</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Midnight violet wording, royal purple accent, and lavender badges.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <div className="flex space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#1E1B4B]" />
                      <span className="w-5 h-5 rounded-full bg-[#7C3AED]" />
                      <span className="w-5 h-5 rounded-full bg-[#C084FC]" />
                    </div>
                    <button
                      onClick={() => applyPreset('royal')}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                    >
                      Apply Royal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <span className="text-xs text-stone-500 font-medium hidden sm:inline">
            All color and size preferences are automatically saved in your browser.
          </span>
          <div className="flex items-center space-x-3 ml-auto">
            <button
              onClick={() => setIsCustomizerOpen(false)}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Done & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FontSizeSliderCardProps {
  title: string;
  description: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
}

const FontSizeSliderCard: React.FC<FontSizeSliderCardProps> = ({
  title,
  description,
  value,
  defaultValue,
  min,
  max,
  onChange,
}) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-stone-900 block">{title}</span>
          <span className="text-[11px] text-stone-500 line-clamp-1">{description}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="text-sm font-extrabold font-mono text-stone-900 px-2 py-0.5 bg-stone-100 rounded-md">
            {value}px
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 font-bold text-sm"
          title="Decrease font size"
        >
          -
        </button>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-emerald-600 h-2 bg-stone-200 rounded-lg cursor-pointer"
        />
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 font-bold text-sm"
          title="Increase font size"
        >
          +
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] pt-1">
        <span className="text-stone-400 font-mono">
          Min {min}px • Max {max}px
        </span>
        {value !== defaultValue && (
          <button
            onClick={() => onChange(defaultValue)}
            className="text-emerald-700 font-semibold hover:underline"
          >
            Reset ({defaultValue}px)
          </button>
        )}
      </div>
    </div>
  );
};
