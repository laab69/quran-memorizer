// Per-ayah recitation audio, served by everyayah.com (one small mp3 per verse,
// no bundling or timing-segment logic needed).
// Yassin Al-Jazaery, Warsh 'an Nafi' riwayah, 64kbps.
const RECITER_PATH = 'warsh/warsh_yassin_al_jazaery_64kbps';

export function getAyahAudioUrl(surahNumber, verseNumber) {
  const s = String(surahNumber).padStart(3, '0');
  const v = String(verseNumber).padStart(3, '0');
  return `https://everyayah.com/data/${RECITER_PATH}/${s}${v}.mp3`;
}
