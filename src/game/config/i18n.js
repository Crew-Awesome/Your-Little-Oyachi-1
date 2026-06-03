import { languageStorageKeys } from "./storage.js";

export const languagePreferences = ["auto", "en", "pt", "es"];

const defaultLanguage = "en";

const translations = {
  en: {
    "language.auto": "Auto",
    "language.english": "EN",
    "language.portuguese": "PT",
    "language.spanish": "ES",
    "loading.main": "Loading",
    "loading.artwork": "Loading artwork",
    "loading.finalizing": "Finalizing",
    "loading.skip": "Skip",
    "loading.room": "Preparing the room",
    "loading.sounds": "Loading sounds",
    "loading.cozy": "Getting cozy",
    "loading.ready": "Almost ready",
    "audio.locked": "Audio locked",
    "audio.sfx": "Loading sfx",
    "audio.sfxSource": "Loading sfx: {src}",
    "audio.music": "Loading music",
    "audio.musicSource": "Loading music: {src}",
    "audio.musicReady": "Music ready",
    "audio.noMusic": "No music tracks",
    "audio.loadedSource": "Loaded: {src}",
    "audio.failedSource": "Failed: {src}",
    "nowPlaying": "Now playing",
    "settings.audio": "Audio",
    "settings.hints": "Hints",
    "settings.other": "Other",
    "settings.music": "Music",
    "settings.sfx": "SFX",
    "settings.on": "On",
    "settings.off": "Off",
    "settings.showHints": "Show Hints",
    "settings.language": "Language",
    "hint.pet": "Tap Oyachi to pet",
    "hint.hold": "Keep holding to pet",
    "hint.spam": "Quick pets make a tiny sparkle",
    "hint.toys": "Tap toys to give Oyachi something to play with",
    "hint.costumes": "Tap costumes to dress Oyachi",
    "hint.fullscreen": "Tap fullscreen for a bigger view",
    "hint.settings": "Settings are in the corner",
    "hint.test": "Hint test: Oyachi is listening.",
    "toys.title": "Toys",
    "toys.ball": "Ball",
    "closet.default": "Default",
    "toast.catch": "Catch x{count}!",
    "toast.greeting": "Hi again, I missed you",
    "toast.zoomies": "Zoomies!",
  },
  pt: {
    "language.auto": "Auto",
    "language.english": "EN",
    "language.portuguese": "PT",
    "language.spanish": "ES",
    "loading.main": "Carregando",
    "loading.artwork": "Carregando arte",
    "loading.finalizing": "Finalizando",
    "loading.skip": "Pular",
    "loading.room": "Preparando o quarto",
    "loading.sounds": "Carregando sons",
    "loading.cozy": "Deixando aconchegante",
    "loading.ready": "Quase pronto",
    "audio.locked": "Audio bloqueado",
    "audio.sfx": "Carregando efeitos",
    "audio.sfxSource": "Carregando efeitos: {src}",
    "audio.music": "Carregando musica",
    "audio.musicSource": "Carregando musica: {src}",
    "audio.musicReady": "Musica pronta",
    "audio.noMusic": "Sem musicas",
    "audio.loadedSource": "Carregado: {src}",
    "audio.failedSource": "Falhou: {src}",
    "nowPlaying": "Tocando agora",
    "settings.audio": "Audio",
    "settings.hints": "Dicas",
    "settings.other": "Outros",
    "settings.music": "Musica",
    "settings.sfx": "SFX",
    "settings.on": "Sim",
    "settings.off": "Nao",
    "settings.showHints": "Mostrar dicas",
    "settings.language": "Idioma",
    "hint.pet": "Toque na Oyachi para fazer carinho",
    "hint.hold": "Continue segurando para fazer carinho",
    "hint.spam": "Carinhos rapidos criam um brilho pequeno",
    "hint.toys": "Toque nos brinquedos para a Oyachi brincar",
    "hint.costumes": "Toque nas roupas para vestir a Oyachi",
    "hint.fullscreen": "Toque em tela cheia para ampliar",
    "hint.settings": "As configuracoes ficam no canto",
    "hint.test": "Teste de dica: a Oyachi esta ouvindo.",
    "toys.title": "Brinquedos",
    "toys.ball": "Bola",
    "closet.default": "Padrao",
    "toast.catch": "Pegou x{count}!",
    "toast.greeting": "Oi de novo, senti sua falta",
    "toast.zoomies": "Correria!",
  },
  es: {
    "language.auto": "Auto",
    "language.english": "EN",
    "language.portuguese": "PT",
    "language.spanish": "ES",
    "loading.main": "Cargando",
    "loading.artwork": "Cargando arte",
    "loading.finalizing": "Finalizando",
    "loading.skip": "Saltar",
    "loading.room": "Preparando la habitacion",
    "loading.sounds": "Cargando sonidos",
    "loading.cozy": "Poniendolo acogedor",
    "loading.ready": "Casi listo",
    "audio.locked": "Audio bloqueado",
    "audio.sfx": "Cargando efectos",
    "audio.sfxSource": "Cargando efectos: {src}",
    "audio.music": "Cargando musica",
    "audio.musicSource": "Cargando musica: {src}",
    "audio.musicReady": "Musica lista",
    "audio.noMusic": "No hay musica",
    "audio.loadedSource": "Cargado: {src}",
    "audio.failedSource": "Fallo: {src}",
    "nowPlaying": "Reproduciendo",
    "settings.audio": "Audio",
    "settings.hints": "Consejos",
    "settings.other": "Otros",
    "settings.music": "Musica",
    "settings.sfx": "SFX",
    "settings.on": "Si",
    "settings.off": "No",
    "settings.showHints": "Ver consejos",
    "settings.language": "Idioma",
    "hint.pet": "Toca a Oyachi para acariciarla",
    "hint.hold": "Manten presionado para acariciar",
    "hint.spam": "Las caricias rapidas crean un brillo",
    "hint.toys": "Toca juguetes para que Oyachi juegue",
    "hint.costumes": "Toca ropa para vestir a Oyachi",
    "hint.fullscreen": "Toca pantalla completa para ampliar",
    "hint.settings": "Los ajustes estan en la esquina",
    "hint.test": "Prueba de consejo: Oyachi esta escuchando.",
    "toys.title": "Juguetes",
    "toys.ball": "Pelota",
    "closet.default": "Predeterminado",
    "toast.catch": "Atrapo x{count}!",
    "toast.greeting": "Hola de nuevo, te extrane",
    "toast.zoomies": "A correr!",
  },
};

let languagePreference = languagePreferences.includes(
  localStorage.getItem(languageStorageKeys.preference),
)
  ? localStorage.getItem(languageStorageKeys.preference)
  : "auto";

const listeners = new Set();

const normalizeLanguage = (language) => String(language ?? "").toLowerCase().split("-")[0];

export const getResolvedLanguage = () => {
  if (languagePreference !== "auto") {
    return languagePreference;
  }
  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  const match = browserLanguages
    .map(normalizeLanguage)
    .find((language) => translations[language]);
  return match || defaultLanguage;
};

export const getLanguagePreference = () => languagePreference;

export const setLanguagePreference = (preference) => {
  const nextPreference = languagePreferences.includes(preference) ? preference : "auto";
  if (nextPreference === languagePreference) {
    return;
  }
  languagePreference = nextPreference;
  localStorage.setItem(languageStorageKeys.preference, languagePreference);
  document.documentElement.lang = getResolvedLanguage();
  listeners.forEach((listener) => listener(languagePreference));
};

export const onLanguageChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const t = (key, replacements = {}) => {
  const language = getResolvedLanguage();
  const value = translations[language]?.[key] ?? translations[defaultLanguage][key] ?? key;
  return Object.entries(replacements).reduce(
    (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
    value,
  );
};

export const getLanguageOptions = () => [
  { id: "auto", label: t("language.auto") },
  { id: "en", label: t("language.english") },
  { id: "pt", label: t("language.portuguese") },
  { id: "es", label: t("language.spanish") },
];

document.documentElement.lang = getResolvedLanguage();
