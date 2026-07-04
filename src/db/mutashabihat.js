import { getVerseByKey } from './queries';
const phrasesData = require('../../assets/data/phrases.json');
const phraseVersesData = require('../../assets/data/phrase_verses.json');

export const getPhrasesForAyah = async (verseKey) => {
  const phraseIds = phraseVersesData[verseKey];
  if (!phraseIds || phraseIds.length === 0) return [];

  const results = [];
  for (const pid of phraseIds) {
    const pData = phrasesData[pid.toString()];
    if (!pData) continue;
    
    // Extract phrase text using source
    let phraseText = "";
    if (pData.source && pData.source.key) {
      const sourceAyah = await getVerseByKey(pData.source.key);
      if (sourceAyah && sourceAyah.text_uthmani) {
        const words = sourceAyah.text_uthmani.split(' ');
        // Indices in JSON are 1-based, inclusive
        phraseText = words.slice(pData.source.from - 1, pData.source.to).join(' ');
      }
    }

    results.push({
      id: pid,
      text: phraseText,
      count: pData.count,
      surahs: pData.surahs,
      ayahs: pData.ayahs,
      sourceKey: pData.source ? pData.source.key : '',
      occurrences: pData.ayah[verseKey] || []
    });
  }
  return results;
};

export const getAyahKeysForPhrase = (phraseId) => {
  const pData = phrasesData[phraseId.toString()];
  if (!pData || !pData.ayah) return [];
  // Object.keys(pData.ayah) gives all the verse_keys where this phrase occurs
  return Object.keys(pData.ayah);
};
