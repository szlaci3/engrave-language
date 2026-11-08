import { useEffect, useMemo, useState } from 'react';
import { db } from '../../db/db';
import type { UiLanguage } from './types';

const uiLanguageSettingKey = 'uiLanguage';
const defaultUiLanguage: UiLanguage = 'zh';

type TranslationValue =
  | string
  | ((values: Record<string, string | number>) => string);

const translations = {
  zh: {
    appEyebrow: '荷兰语 - 中文词汇',
    appIntro: '本地荷兰语-中文词汇文件，用于复习和听力练习。',
    primaryNavigation: '主导航',
    newFile: '新文件',
    data: '数据',
    settings: '设置',
    newFolder: '新文件夹',
    folderName: '文件夹名称',
    create: '创建',
    folders: '文件夹',
    files: '文件',
    createFile: '创建',
    loadingFiles: '正在加载文件...',
    noFiles:
      '还没有词汇文件。创建一个文件，开始建立你的本地学习列表。',
    savedFilesLoadError: '无法加载已保存的文件。',
    reorderFile: ({ title }) => `调整顺序：${title}`,
    reorderFilesHint: '拖动手柄调整顺序，或聚焦手柄后使用上下方向键。',
    fileOrderSaved: '文件顺序已保存。',
    fileOrderSaveError: '无法保存文件顺序。已恢复原顺序，请重试。',
    addFolderName: '保存前请输入文件夹名称。',
    folderCreateError: '无法创建文件夹。请重试。',
    file: '文件',
    folder: '文件夹',
    folderFiles: '文件夹文件',
    loadingFolder: '正在加载文件夹...',
    folderLoadError: '无法加载此文件夹。',
    noFilesInFolder: '此文件夹中还没有文件。',
    folderNotFound: '找不到此文件夹。',
    newFileEyebrow: '新文件',
    pasteVocabulary: '粘贴词汇',
    saveVocabularyFile: '保存词汇文件',
    vocabularyText: '词汇文本',
    validLines: ({ count, skipped }) =>
      `${count} 个有效行${Number(skipped) > 0 ? `，${skipped} 个已跳过` : ''}`,
    pasteValidLine: '请至少粘贴一行有效的荷兰语-中文词汇。',
    fileSaveError: '无法保存文件。请重试。',
    loadingFile: '正在加载文件...',
    fileNotFound: '找不到此文件。',
    fileTitle: '文件标题',
    editFile: '编辑文件',
    saveFile: '保存文件',
    addFileTitle: '保存前请输入文件标题。',
    keepValidLine: '请保留至少一行有效的荷兰语-中文词汇。',
    noFolder: '无文件夹',
    studyFlashcards: '学习卡片',
    playDutchExpression: ({ text }) => `播放荷兰语：${text}`,
    playChineseTranslation: ({ text }) => `播放中文翻译：${text}`,
    flashcards: '学习卡片',
    loadingFlashcards: '正在加载学习卡片...',
    flashcardsLoadError: '无法加载学习卡片。',
    flashcardDirection: '学习卡片方向',
    dutch: '荷兰语',
    chinese: '中文',
    prompt: '题目',
    answer: '答案',
    previous: '上一张',
    next: '下一张',
    practiceComplete: '本轮学习结束，已回到开头。',
    noEntriesForFlashcards: '此文件没有词汇条目。',
    localData: '本地数据',
    exportDatabase: '导出数据库',
    importReplace: '导入数据库，替换当前数据',
    mergeDatabase: '添加现有数据库，保留当前数据',
    exportStarted: '数据库导出已开始。请查看下载内容。',
    exportError: '无法导出数据库。请重试。',
    replaceConfirm: '这将替换此设备上的所有 Engrave Language 数据。继续吗？',
    importCanceled: '导入已取消。当前数据未更改。',
    importReplaced: '数据库导入完成。当前数据已被替换。',
    importFailed: '导入失败。',
    databaseMerged: '数据库已添加。当前数据已保留。',
    voiceSettings: '语音设置',
    uiLanguage: '界面语言',
    chineseUi: '中文',
    englishUi: 'English',
    audioSource: '发音来源',
    dutchAudioSource: '荷兰语发音来源',
    chineseAudioSource: '中文发音来源',
    speechSynthesisAudio: '浏览器语音',
    wiktionaryAudio: 'Wiktionary 音频，缺失时使用浏览器语音',
    speechUnavailable: '此浏览器不支持语音合成。',
    dutchVoice: '荷兰语语音',
    chineseVoice: '中文语音',
    automaticDutch: '自动 - 优先使用比利时荷兰语',
    automaticChinese: '自动 - 优先使用普通话中文',
    dutchVoiceHint:
      '当浏览器提供 nl-BE 和 nl-NL 等荷兰语语音时，它们会显示在这里。',
    chineseVoiceHint:
      '当浏览器提供 zh-TW 等台湾语音时，它们可以在这里选择。',
    chineseAudioTextHandling: '中文音频文本处理',
    splitChineseAudioText: '按中文逗号分段播放',
    originalChineseAudioText: '播放原始完整文本',
    chineseAudioTextHandlingHint:
      '分段模式会在每次播放时依次播放中文逗号分隔的部分。',
    saveSettings: '保存设置',
    settingsSaved: '设置已保存。',
  },
  en: {
    appEyebrow: 'Dutch - Chinese vocabulary',
    appIntro: 'Local Dutch-Chinese vocabulary files for review and listening.',
    primaryNavigation: 'Primary',
    newFile: 'New file',
    data: 'Data',
    settings: 'Settings',
    newFolder: 'New folder',
    folderName: 'Folder name',
    create: 'Create',
    folders: 'Folders',
    files: 'Files',
    createFile: 'Create',
    loadingFiles: 'Loading files...',
    noFiles:
      'No vocabulary files yet. Create a file to start building your local study list.',
    savedFilesLoadError: 'Saved files could not be loaded.',
    reorderFile: ({ title }) => `Reorder: ${title}`,
    reorderFilesHint: 'Drag a handle to reorder, or focus it and use the Up and Down arrow keys.',
    fileOrderSaved: 'File order saved.',
    fileOrderSaveError: 'The file order could not be saved. The previous order was restored. Try again.',
    addFolderName: 'Add a folder name before saving.',
    folderCreateError: 'The folder could not be created. Try again.',
    file: 'File',
    folder: 'Folder',
    folderFiles: 'Folder files',
    loadingFolder: 'Loading folder...',
    folderLoadError: 'This folder could not be loaded.',
    noFilesInFolder: 'No files in this folder yet.',
    folderNotFound: 'This folder was not found.',
    newFileEyebrow: 'New file',
    pasteVocabulary: 'Paste vocabulary',
    saveVocabularyFile: 'Save vocabulary file',
    vocabularyText: 'Vocabulary text',
    validLines: ({ count, skipped }) =>
      `${count} valid line${Number(count) === 1 ? '' : 's'}${
        Number(skipped) > 0 ? `, ${skipped} skipped` : ''
      }`,
    pasteValidLine: 'Paste at least one valid Dutch-Chinese vocabulary line.',
    fileSaveError: 'The file could not be saved. Try again.',
    loadingFile: 'Loading file...',
    fileNotFound: 'This file was not found.',
    fileTitle: 'File title',
    editFile: 'Edit file',
    saveFile: 'Save file',
    addFileTitle: 'Add a file title before saving.',
    keepValidLine: 'Keep at least one valid Dutch-Chinese vocabulary line.',
    noFolder: 'No folder',
    studyFlashcards: 'Study flashcards',
    playDutchExpression: ({ text }) => `Play Dutch expression: ${text}`,
    playChineseTranslation: ({ text }) => `Play Chinese translation: ${text}`,
    flashcards: 'Flashcards',
    loadingFlashcards: 'Loading flashcards...',
    flashcardsLoadError: 'Flashcards could not be loaded.',
    flashcardDirection: 'Flashcard direction',
    dutch: 'Dutch',
    chinese: 'Chinese',
    prompt: 'Prompt',
    answer: 'Answer',
    previous: 'Previous',
    next: 'Next',
    practiceComplete: 'End of deck — starting again.',
    noEntriesForFlashcards: 'This file has no vocabulary entries.',
    localData: 'Local data',
    exportDatabase: 'Export database',
    importReplace: 'Import database, replace current data',
    mergeDatabase: 'Add existing database, preserve current data',
    exportStarted: 'Database export started. Check your downloads.',
    exportError: 'The database could not be exported. Try again.',
    replaceConfirm: 'This will replace all current Engrave Language data on this device. Continue?',
    importCanceled: 'Import canceled. Current data was not changed.',
    importReplaced: 'Database import complete. Current data was replaced.',
    importFailed: 'Import failed.',
    databaseMerged: 'Database added. Current data was preserved.',
    voiceSettings: 'Voice settings',
    uiLanguage: 'UI language',
    chineseUi: 'Chinese',
    englishUi: 'English',
    audioSource: 'Audio source',
    dutchAudioSource: 'Dutch audio source',
    chineseAudioSource: 'Chinese audio source',
    speechSynthesisAudio: 'Browser speech',
    wiktionaryAudio: 'Wiktionary audio, then browser speech',
    speechUnavailable: 'Speech synthesis is not available in this browser.',
    dutchVoice: 'Dutch voice',
    chineseVoice: 'Chinese voice',
    automaticDutch: 'Automatic - prefer Belgian Dutch',
    automaticChinese: 'Automatic - prefer Mandarin Chinese',
    dutchVoiceHint:
      'Dutch voices such as nl-BE and nl-NL appear when your browser exposes them.',
    chineseVoiceHint:
      'Taiwan voices such as zh-TW are selectable when your browser exposes them.',
    chineseAudioTextHandling: 'Chinese audio text handling',
    splitChineseAudioText: 'Split at Chinese commas',
    originalChineseAudioText: 'Play the original full text',
    chineseAudioTextHandlingHint:
      'Split mode cycles through parts separated by Chinese commas on each play.',
    saveSettings: 'Save settings',
    settingsSaved: 'Settings saved.',
  },
} satisfies Record<UiLanguage, Record<string, TranslationValue>>;

export type TranslationKey = keyof typeof translations.en;

export function isUiLanguage(value: unknown): value is UiLanguage {
  return value === 'zh' || value === 'en';
}

export async function getUiLanguage(): Promise<UiLanguage> {
  const setting = await db.settings.get(uiLanguageSettingKey);

  return isUiLanguage(setting?.value) ? setting.value : defaultUiLanguage;
}

export async function saveUiLanguage(language: UiLanguage) {
  await db.settings.put({
    key: uiLanguageSettingKey,
    value: language,
    updatedAt: new Date().toISOString(),
  });
}

export function useUiLanguage() {
  const [language, setLanguage] = useState<UiLanguage>(defaultUiLanguage);

  useEffect(() => {
    let isMounted = true;

    async function loadLanguage() {
      const savedLanguage = await getUiLanguage();

      if (isMounted) {
        setLanguage(savedLanguage);
      }
    }

    void loadLanguage();

    return () => {
      isMounted = false;
    };
  }, []);

  const t = useMemo(() => {
    return (
      key: TranslationKey,
      values: Record<string, string | number> = {},
    ) => {
      const value = translations[language][key];

      return typeof value === 'function' ? value(values) : value;
    };
  }, [language]);

  async function updateLanguage(nextLanguage: UiLanguage) {
    setLanguage(nextLanguage);
    await saveUiLanguage(nextLanguage);
  }

  return { language, setLanguage: updateLanguage, t };
}
