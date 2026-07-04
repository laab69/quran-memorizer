import rawLigatures from
  '../../../assets/fonts/surah-name-ligatures.json';

const surahLigatures = rawLigatures.default || rawLigatures;

// The JSON is a flat map: { "surah-1": "surah001", "surah-2": "surah002", ... }
// The values are ligature strings that the SurahNames font renders as calligraphic glyphs.
export function getSurahNameGlyph(surahNumber) {
  try {
    const key = `surah-${surahNumber}`;
    const ligature = surahLigatures[key];
    return ligature || null;
  } catch {
    return null;
  }
}
