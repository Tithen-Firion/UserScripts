// ==UserScript==
// @name        Netflix - subtitle downloader
// @description Allows you to download subtitles from Netflix
// @license     MIT
// @version     4.2.8
// @namespace   tithen-firion.github.io
// @include     https://www.netflix.com/*
// @grant       unsafeWindow
// @require     https://cdn.jsdelivr.net/npm/jszip@3.7.1/dist/jszip.min.js
// @require     https://cdn.jsdelivr.net/npm/file-saver-es@2.0.5/dist/FileSaver.min.js
// ==/UserScript==

class ProgressBar {
  constructor(max) {
    this.current = 0;
    this.max = max;

    let container = document.querySelector('#userscript_progress_bars');
    if(container === null) {
      container = document.createElement('div');
      container.id = 'userscript_progress_bars'
      document.body.appendChild(container)
      container.style
      container.style.position = 'fixed';
      container.style.top = 0;
      container.style.left = 0;
      container.style.width = '100%';
      container.style.background = 'red';
      container.style.zIndex = '99999999';
    }

    this.progressElement = document.createElement('div');
    this.progressElement.innerHTML = 'Click to stop';
    this.progressElement.style.cursor = 'pointer';
    this.progressElement.style.fontSize = '16px';
    this.progressElement.style.textAlign = 'center';
    this.progressElement.style.width = '100%';
    this.progressElement.style.height = '20px';
    this.progressElement.style.background = 'transparent';
    this.stop = new Promise(resolve => {
      this.progressElement.addEventListener('click', () => {resolve(STOP_THE_DOWNLOAD)});
    });

    container.appendChild(this.progressElement);
  }

  increment() {
    this.current += 1;
    if(this.current <= this.max) {
      let p = this.current / this.max * 100;
      this.progressElement.style.background = `linear-gradient(to right, green ${p}%, transparent ${p}%)`;
    }
  }

  destroy() {
    this.progressElement.remove();
  }
}

const STOP_THE_DOWNLOAD = 'NETFLIX_SUBTITLE_DOWNLOADER_STOP_THE_DOWNLOAD';

const WEBVTT = 'webvtt-lssdh-ios8';
const DFXP = 'dfxp-ls-sdh';
const SIMPLE = 'simplesdh';
const IMSC1_1 = 'imsc1.1';
const ALL_FORMATS = [IMSC1_1, DFXP, WEBVTT, SIMPLE];
const ALL_FORMATS_prefer_vtt = [WEBVTT, IMSC1_1, DFXP, SIMPLE];

const FORMAT_NAMES = {};
FORMAT_NAMES[WEBVTT] = 'WebVTT';
FORMAT_NAMES[DFXP] = 'IMSC1.1/DFXP/XML';

const EXTENSIONS = {};
EXTENSIONS[WEBVTT] = 'vtt';
EXTENSIONS[DFXP] = 'dfxp';
EXTENSIONS[SIMPLE] = 'xml';
EXTENSIONS[IMSC1_1] = 'xml';

const messages = {
  'en': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'Download subs for this',
      menuEpisode: 'episode',
      menuMovie: 'movie',
      menuDownloadToEnd: 'Download subs from this ep till last available',
      menuDownloadSeason: 'Download subs for this season',
      menuDownloadAll: 'Download subs for all seasons',
      menuEpTitleInFilename: 'Add episode title to filename:',
      menuForceAllLang: 'Force Netflix to show all languages:',
      menuPrefLocale: 'Preferred locale:',
      menuLangSetting: 'Languages to download:',
      menuSubFormat: 'Subtitle format: prefer',
      menuBatchDelay: 'Batch delay:',
      preferredLocalePrompt: 'Netflix limited "force all subtitles" usage. Now you have to set a preferred locale to show subtitles for that language.\nPossible values (you can enter only one at a time!):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'Languages to download, comma separated. Leave empty to download all subtitles.\n(Example: en,pt,pt-BR,fr):',
      delayPrompt: 'Delay (in seconds) between switching pages when downloading subs in batch:',
      subtitleUrlError: "Can't find subtitle URL, check the console for more information!",
      subtitleNotFound: "Couldn't find the subtitles. Wait until the player is loaded. If that doesn't help, refresh the page.",
      cacheZipError: "An error occured when loading the zip file with subs from the cache. More info in the browser console.",
      on: 'on',
      off: 'off',
      all: 'all',
      disabled: 'disabled'
  },
  'pt': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'Transferir legendas para este',
      menuEpisode: 'episódio',
      menuMovie: 'filme',
      menuDownloadToEnd: 'Transferir legendas deste episódio até ao último disponível',
      menuDownloadSeason: 'Transferir legendas desta temporada',
      menuDownloadAll: 'Transferir legendas de todas as temporadas',
      menuEpTitleInFilename: 'Adicionar título do episódio ao nome do ficheiro:',
      menuForceAllLang: 'Forçar a Netflix a mostrar todos os idiomas:',
      menuPrefLocale: 'Local preferido:',
      menuLangSetting: 'Idiomas a transferir:',
      menuSubFormat: 'Formato das legendas: preferir',
      menuBatchDelay: 'Atraso em lote:',
      preferredLocalePrompt: 'A Netflix limitou a utilização de “forçar todas as legendas”. Agora tens de definir um local preferido para mostrar legendas para esse idioma.\nValores possíveis (só podes introduzir um de cada vez!):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'Idiomas a transferir, separados por vírgulas. Deixa em branco para transferir todas as legendas.\n(Exemplo: en,pt,pt-BR,fr):',
      delayPrompt: 'Atraso (em segundos) entre a mudança de página quando transfere legendas em lote:',
      subtitleUrlError: "Não foi possível encontrar o link das legendas. Verifica a consola para mais informações!",
      subtitleNotFound: "Não foi possível encontrar as legendas. Espera até que o leitor seja carregado. Se isso não ajudar, atualiza a página.",
      cacheZipError: "Ocorreu um erro ao carregar o ficheiro ZIP com as legendas da cache. Mais informações na consola do navegador.",
      on: 'ligado',
      off: 'desligado',
      all: 'todas',
      disabled: 'desativado'
  },
  'pt-BR': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'Baixar legendas para este',
      menuEpisode: 'episódio',
      menuMovie: 'filme',
      menuDownloadToEnd: 'Baixar legendas deste episódio até o último disponível',
      menuDownloadSeason: 'Baixar legendas desta temporada',
      menuDownloadAll: 'Baixar legendas de todas as temporadas',
      menuEpTitleInFilename: 'Adicionar título do episódio ao nome do arquivo:',
      menuForceAllLang: 'Forçar Netflix a mostrar todos os idiomas:',
      menuPrefLocale: 'Local preferencial:',
      menuLangSetting: 'Idiomas para baixar:',
      menuSubFormat: 'Formato da legenda: preferir',
      menuBatchDelay: 'Atraso em lote:',
      preferredLocalePrompt: 'A Netflix limitou o uso da opção "forçar todas as legendas". Agora você precisa definir um local preferencial para exibir legendas nesse idioma.\nValores possíveis (você pode inserir apenas um de cada vez!):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'Idiomas para baixar, separados por vírgula. Deixe em branco para baixar todas as legendas.\n(Exemplo: en,pt,pt-BR,fr):',
      delayPrompt: 'Atraso (em segundos) entre a troca de páginas ao baixar legendas em lote:',
      subtitleUrlError: "Não foi possível encontrar o link das legendas. Verifique o console para mais informações!",
      subtitleNotFound: "Não foi possível encontrar as legendas. Aguarde até que o player seja carregado. Se isso não ajudar, atualize a página.",
      cacheZipError: "Ocorreu um erro ao carregar o arquivo ZIP com as legendas do cache. Mais informações no console do navegador.",
      on: 'ligado',
      off: 'desligado',
      all: 'todas',
      disabled: 'desativado'
  },
  'fr': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'Télécharger les sous-titres pour cet(te)',
      menuEpisode: 'épisode',
      menuMovie: 'film',
      menuDownloadToEnd: 'Télécharger les sous-titres de cet épisode jusqu\'au dernier disponible',
      menuDownloadSeason: 'Télécharger les sous-titres de cette saison',
      menuDownloadAll: 'Télécharger les sous-titres de toutes les saisons',
      menuEpTitleInFilename: 'Ajouter le titre de l\'épisode au nom du fichier :',
      menuForceAllLang: 'Forcer Netflix à afficher toutes les langues :',
      menuPrefLocale: 'Locale préférée :',
      menuLangSetting: 'Langues à télécharger :',
      menuSubFormat: 'Format des sous-titres : préférence',
      menuBatchDelay: 'Délai en lot :',
      preferredLocalePrompt: 'Netflix a limité l\'utilisation de « forcer tous les sous-titres ». Tu dois maintenant définir une locale préférée pour afficher les sous-titres de cette langue.\nValeurs possibles (tu ne peux en saisir qu\'une seule à la fois !):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, en-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'Langues à télécharger, séparées par des virgules. Laisse un blanc pour télécharger tous les sous-titres.\n(Exemple : en,pt,pt-BR,fr) :',
      delayPrompt: 'Délai (en secondes) entre les changements de page lors du téléchargement de sous-titres par lot :',
      subtitleUrlError: 'Impossible de trouver le lien des sous-titres. Vérifie la console pour plus d\'informations !',
      subtitleNotFound: 'Impossible de trouver les sous-titres. Attends que le lecteur soit chargé. Si ça ne marche pas, actualise la page.',
      cacheZipError: 'Une erreur est survenue lors du chargement du fichier ZIP contenant les sous-titres depuis le cache. Plus d\'infos dans la console du navigateur.',
      on: 'activé',
      off: 'désactivé',
      all: 'toutes',
      disabled: 'désactivé'
  },
  'de': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'Untertitel für dieses herunterladen',
      menuEpisode: 'Folge',
      menuMovie: 'Film',
      menuDownloadToEnd: 'Untertitel von dieser Folge bis zur letzten verfügbaren herunterladen',
      menuDownloadSeason: 'Untertitel für diese Staffel herunterladen',
      menuDownloadAll: 'Untertitel für alle Staffeln herunterladen',
      menuEpTitleInFilename: 'Folgentitel zum Dateinamen hinzufügen:',
      menuForceAllLang: 'Netflix zwingen, alle Sprachen anzuzeigen:',
      menuPrefLocale: 'Bevorzugte Spracheinstellung:',
      menuLangSetting: 'Sprachen zum Herunterladen:',
      menuSubFormat: 'Untertitelformat: bevorzugt',
      menuBatchDelay: 'Verzögerung bei Batch:',
      preferredLocalePrompt: 'Netflix hat die Nutzung von "Alle Untertitel erzwingen" eingeschränkt. Du musst jetzt eine bevorzugte Sprache einstellen, um Untertitel für diese Sprache anzuzeigen.\nMögliche Werte (jeweils nur eine Eingabe möglich!):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'Zu ladende Sprachen, durch Kommas getrennt. Leer lassen, um alle Untertitel herunterzuladen.\n(Beispiel: en,pt,pt-BR,fr):',
      delayPrompt: 'Verzögerung (in Sekunden) zwischen Seitenwechseln beim Herunterladen von Untertiteln im Batch:',
      subtitleUrlError: 'Kann die Untertitel-URL nicht finden, siehe Konsole für weitere Informationen!',
      subtitleNotFound: 'Untertitel konnten nicht gefunden werden. Warte, bis der Player geladen ist. Wenn das nicht hilft, lade die Seite neu.',
      cacheZipError: 'Beim Laden der ZIP-Datei mit Untertiteln aus dem Cache ist ein Fehler aufgetreten. Weitere Infos in der Browser-Konsole.',
      on: 'ein',
      off: 'aus',
      all: 'alle',
      disabled: 'deaktiviert'
  },
  'ko': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: '이 자막 다운로드',
      menuEpisode: '에피소드',
      menuMovie: '영화',
      menuDownloadToEnd: '이 에피소드부터 마지막까지 자막 다운로드',
      menuDownloadSeason: '이 시즌 자막 다운로드',
      menuDownloadAll: '모든 시즌 자막 다운로드',
      menuEpTitleInFilename: '파일명에 에피소드 제목 추가:',
      menuForceAllLang: '넷플릭스에서 모든 언어 표시 강제:',
      menuPrefLocale: '선호 지역 설정:',
      menuLangSetting: '다운로드할 언어:',
      menuSubFormat: '자막 형식: 선호',
      menuBatchDelay: '일괄 처리 지연:',
      preferredLocalePrompt: '넷플릭스는 "모든 자막 강제" 사용을 제한했습니다. 이제 해당 언어 자막을 표시하려면 선호 지역을 설정해야 합니다.\n가능한 값 (한 번에 하나씩 입력 가능):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: '다운로드할 언어를 쉼표로 구분하여 입력하세요. 모두 다운로드하려면 비워두세요.\n(예: en,pt,pt-BR,fr):',
      delayPrompt: '일괄 다운로드 시 페이지 전환 간 지연 시간(초):',
      subtitleUrlError: '자막 URL을 찾을 수 없습니다. 자세한 내용은 콘솔을 확인하세요!',
      subtitleNotFound: '자막을 찾을 수 없습니다. 플레이어가 로드될 때까지 기다리세요. 그래도 안 되면 페이지를 새로 고침하세요.',
      cacheZipError: '캐시에서 자막 ZIP 파일을 불러오는 중 오류가 발생했습니다. 자세한 내용은 브라우저 콘솔을 확인하세요.',
      on: '켜짐',
      off: '꺼짐',
      all: '모두',
      disabled: '사용 안 함'
  },
  'ja': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'この字幕をダウンロード',
      menuEpisode: 'エピソード',
      menuMovie: '映画',
      menuDownloadToEnd: 'このエピソードから最後まで字幕をダウンロード',
      menuDownloadSeason: 'このシーズンの字幕をダウンロード',
      menuDownloadAll: 'すべてのシーズンの字幕をダウンロード',
      menuEpTitleInFilename: 'ファイル名にエピソードタイトルを追加:',
      menuForceAllLang: 'Netflixで全言語を表示するよう強制:',
      menuPrefLocale: '優先ロケール:',
      menuLangSetting: 'ダウンロードする言語:',
      menuSubFormat: '字幕形式: 優先',
      menuBatchDelay: 'バッチ遅延:',
      preferredLocalePrompt: 'Netflixは「すべての字幕を強制表示」機能を制限しました。現在、その言語の字幕を表示するには優先ロケールを設定する必要があります。\n可能な値（一度に1つのみ入力可能）:\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'ダウンロードする言語をカンマ区切りで入力してください。すべての字幕をダウンロードするには空欄のままにしてください。\n(例: en,pt,pt-BR,fr):',
      delayPrompt: 'バッチで字幕をダウンロードする際のページ切り替え間の遅延（秒）:',
      subtitleUrlError: '字幕のURLが見つかりません。詳細はコンソールを確認してください！',
      subtitleNotFound: '字幕が見つかりません。プレーヤーが読み込まれるまで待ってください。それでも解決しない場合は、ページを更新してください。',
      cacheZipError: 'キャッシュから字幕のZIPファイルを読み込む際にエラーが発生しました。詳細はブラウザのコンソールをご覧ください。',
      on: 'オン',
      off: 'オフ',
      all: 'すべて',
      disabled: '無効'
  },
  'uk': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'Завантажити субтитри для цього',
      menuEpisode: 'епізод',
      menuMovie: 'фільм',
      menuDownloadToEnd: 'Завантажити субтитри від цього епізоду до останнього доступного',
      menuDownloadSeason: 'Завантажити субтитри для цього сезону',
      menuDownloadAll: 'Завантажити субтитри для всіх сезонів',
      menuEpTitleInFilename: 'Додати назву епізоду до імені файлу:',
      menuForceAllLang: 'Примусити Netflix показувати всі мови:',
      menuPrefLocale: 'Бажана локаль:',
      menuLangSetting: 'Мови для завантаження:',
      menuSubFormat: 'Формат субтитрів: пріоритет',
      menuBatchDelay: 'Затримка пакетної обробки:',
      preferredLocalePrompt: 'Netflix обмежив використання "примусового показу всіх субтитрів". Тепер потрібно встановити бажану локаль, щоб показувати субтитри для цієї мови.\nМожливі значення (можна вводити лише по одному разу!):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'Мови для завантаження, через кому. Залиште порожнім, щоб завантажити всі субтитри.\n(Приклад: en,pt,pt-BR,fr):',
      delayPrompt: 'Затримка (в секундах) між перемиканням сторінок при пакетному завантаженні субтитрів:',
      subtitleUrlError: 'Не вдалося знайти URL субтитрів, перевірте консоль для отримання додаткової інформації!',
      subtitleNotFound: 'Не вдалося знайти субтитри. Зачекайте, поки плеєр завантажиться. Якщо це не допоможе, оновіть сторінку.',
      cacheZipError: 'Сталася помилка при завантаженні ZIP-файлу з субтитрами з кешу. Більше інформації в консолі браузера.',
      on: 'увімкнено',
      off: 'вимкнено',
      all: 'всі',
      disabled: 'відключено'
  },
  'es': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'Descargar subtítulos para este',
      menuEpisode: 'episodio',
      menuMovie: 'película',
      menuDownloadToEnd: 'Descargar subtítulos desde este episodio hasta el último disponible',
      menuDownloadSeason: 'Descargar subtítulos de esta temporada',
      menuDownloadAll: 'Descargar subtítulos de todas las temporadas',
      menuEpTitleInFilename: 'Añadir título del episodio al nombre del archivo:',
      menuForceAllLang: 'Forzar a Netflix a mostrar todos los idiomas:',
      menuPrefLocale: 'Localidad preferida:',
      menuLangSetting: 'Idiomas a descargar:',
      menuSubFormat: 'Formato de subtítulo: preferir',
      menuBatchDelay: 'Retraso por lotes:',
      preferredLocalePrompt: 'Netflix limitó el uso de "forzar todos los subtítulos". Ahora debes configurar una localidad preferida para mostrar subtítulos en ese idioma.\nValores posibles (solo puedes ingresar uno a la vez!):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'Idiomas para descargar, separados por comas. Deja vacío para descargar todos los subtítulos.\n(Ejemplo: en,pt,pt-BR,fr):',
      delayPrompt: 'Retraso (en segundos) entre cambiar páginas al descargar subtítulos en lote:',
      subtitleUrlError: 'No se pudo encontrar la URL del subtítulo, revisa la consola para más información!',
      subtitleNotFound: 'No se pudieron encontrar los subtítulos. Espera hasta que el reproductor esté cargado. Si no ayuda, recarga la página.',
      cacheZipError: 'Ocurrió un error al cargar el archivo zip con subtítulos desde la caché. Más información en la consola del navegador.',
      on: 'activado',
      off: 'desactivado',
      all: 'todos',
      disabled: 'desactivado'
  },
  'it': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'Scarica sottotitoli per questo',
      menuEpisode: 'episodio',
      menuMovie: 'film',
      menuDownloadToEnd: 'Scarica sottotitoli da questo episodio fino all\'ultimo disponibile',
      menuDownloadSeason: 'Scarica sottotitoli per questa stagione',
      menuDownloadAll: 'Scarica sottotitoli per tutte le stagioni',
      menuEpTitleInFilename: 'Aggiungi titolo episodio al nome file:',
      menuForceAllLang: 'Forza Netflix a mostrare tutte le lingue:',
      menuPrefLocale: 'Locale preferita:',
      menuLangSetting: 'Lingue da scaricare:',
      menuSubFormat: 'Formato sottotitoli: preferisci',
      menuBatchDelay: 'Ritardo batch:',
      preferredLocalePrompt: 'Netflix ha limitato l\'uso di "forzare tutti i sottotitoli". Ora devi impostare una locale preferita per mostrare i sottotitoli in quella lingua.\nValori possibili (puoi inserire solo uno alla volta!):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'Lingue da scaricare, separate da virgole. Lascia vuoto per scaricare tutti i sottotitoli.\n(Esempio: en,pt,pt-BR,fr):',
      delayPrompt: 'Ritardo (in secondi) tra il cambio di pagina durante il download in batch dei sottotitoli:',
      subtitleUrlError: 'Impossibile trovare l\'URL del sottotitolo, controlla la console per maggiori informazioni!',
      subtitleNotFound: 'Impossibile trovare i sottotitoli. Attendi che il player sia caricato. Se non funziona, ricarica la pagina.',
      cacheZipError: 'Si è verificato un errore durante il caricamento del file zip con i sottotitoli dalla cache. Maggiori informazioni nella console del browser.',
      on: 'attivato',
      off: 'disattivato',
      all: 'tutti',
      disabled: 'disabilitato'
  },
  'zh': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: '下载此视频的字幕',
      menuEpisode: '集',
      menuMovie: '电影',
      menuDownloadToEnd: '从本集开始下载到最后一集的字幕',
      menuDownloadSeason: '下载本季的字幕',
      menuDownloadAll: '下载所有季的字幕',
      menuEpTitleInFilename: '将集标题添加到文件名：',
      menuForceAllLang: '强制 Netflix 显示所有语言：',
      menuPrefLocale: '首选语言环境：',
      menuLangSetting: '下载语言：',
      menuSubFormat: '字幕格式：优先选择',
      menuBatchDelay: '批量延迟：',
      preferredLocalePrompt: 'Netflix 限制了“强制所有字幕”的使用。现在你必须设置首选语言环境以显示该语言的字幕。\n可能的值（一次只能输入一个！）：\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh)：',
      downloadLangsPrompt: '要下载的语言，用逗号分隔。留空表示下载所有字幕。\n（例如：en,pt,pt-BR,fr）：',
      delayPrompt: '批量下载字幕时切换页面的延迟（秒）：',
      subtitleUrlError: '找不到字幕 URL，请检查控制台获取更多信息！',
      subtitleNotFound: '找不到字幕。请等待播放器加载完成。如果无效，请刷新页面。',
      cacheZipError: '加载缓存中的字幕 ZIP 文件时出错。浏览器控制台有更多信息。',
      on: '开启',
      off: '关闭',
      all: '全部',
      disabled: '禁用'
  },
  'ru': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'Скачать субтитры для этого',
      menuEpisode: 'эпизода',
      menuMovie: 'фильма',
      menuDownloadToEnd: 'Скачать субтитры с этого эпизода до последнего доступного',
      menuDownloadSeason: 'Скачать субтитры для этого сезона',
      menuDownloadAll: 'Скачать субтитры для всех сезонов',
      menuEpTitleInFilename: 'Добавить название эпизода к имени файла:',
      menuForceAllLang: 'Принудительно показывать все языки Netflix:',
      menuPrefLocale: 'Предпочитаемая локаль:',
      menuLangSetting: 'Языки для загрузки:',
      menuSubFormat: 'Формат субтитров: предпочтительный',
      menuBatchDelay: 'Задержка пакетной загрузки:',
      preferredLocalePrompt: 'Netflix ограничил использование функции "принудительного отображения всех субтитров". Теперь необходимо установить предпочитаемую локаль для отображения субтитров на этом языке.\nВозможные значения (можно вводить только одно за раз!):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'Языки для загрузки через запятую. Оставьте пустым для загрузки всех субтитров.\n(Пример: en,pt,pt-BR,fr):',
      delayPrompt: 'Задержка (в секундах) между переключением страниц при пакетной загрузке субтитров:',
      subtitleUrlError: 'Не удалось найти URL субтитров, проверьте консоль для получения дополнительной информации!',
      subtitleNotFound: 'Не удалось найти субтитры. Подождите, пока загрузится плеер. Если это не поможет, обновите страницу.',
      cacheZipError: 'Произошла ошибка при загрузке ZIP-файла с субтитрами из кэша. Подробнее в консоли браузера.',
      on: 'включено',
      off: 'выключено',
      all: 'все',
      disabled: 'отключено'
  },
  'ar': {
      menuTitle: 'Netflix subtitle downloader',
      menuDownload: 'تنزيل الترجمات لهذا',
      menuEpisode: 'الحلقة',
      menuMovie: 'الفيلم',
      menuDownloadToEnd: 'تنزيل الترجمات من هذه الحلقة حتى الأخيرة المتوفرة',
      menuDownloadSeason: 'تنزيل الترجمات لهذا الموسم',
      menuDownloadAll: 'تنزيل الترجمات لجميع المواسم',
      menuEpTitleInFilename: 'إضافة عنوان الحلقة إلى اسم الملف:',
      menuForceAllLang: 'إجبار Netflix على عرض جميع اللغات:',
      menuPrefLocale: 'الإعداد المحلي المفضل:',
      menuLangSetting: 'اللغات المراد تنزيلها:',
      menuSubFormat: 'صيغة الترجمة: تفضيل',
      menuBatchDelay: 'تأخير الدفعة:',
      preferredLocalePrompt: 'حدت Netflix من استخدام "فرض كل الترجمات". الآن يجب عليك تعيين إعداد محلي مفضل لعرض الترجمات بتلك اللغة.\nالقيم الممكنة (يمكنك إدخال واحد فقط في كل مرة!):\n(ar, cs, da, de, el, en, es, es-ES, fi, fr, he, hi, hr, hu, id, it, ja, ko, ms, nb, nl, pl, pt, pt-BR, ro, ru, sv, ta, te, th, tr, uk, vi, zh):',
      downloadLangsPrompt: 'اللغات التي تريد تنزيلها، مفصولة بفواصل. اتركها فارغة لتنزيل كل الترجمات.\n(مثال: en,pt,pt-BR,fr):',
      delayPrompt: 'التأخير (بالثواني) بين تبديل الصفحات عند تنزيل الترجمات دفعة واحدة:',
      subtitleUrlError: 'تعذر العثور على رابط الترجمة، تحقق من وحدة التحكم لمزيد من المعلومات!',
      subtitleNotFound: 'تعذر العثور على الترجمات. انتظر حتى يتم تحميل المشغل. إذا لم يساعد ذلك، قم بتحديث الصفحة.',
      cacheZipError: 'حدث خطأ أثناء تحميل ملف ZIP الخاص بالترجمات من ذاكرة التخزين المؤقت. مزيد من المعلومات في وحدة تحكم المتصفح.',
      on: 'تشغيل',
      off: 'إيقاف',
      all: 'الكل',
      disabled: 'معطل'
  }
};

// Get the browser language
const browserLang = navigator.language.toLowerCase(); // ex: ex: 'pt-pt', 'fr-fr'

// Mapping logic
let userLang;
if (browserLang === 'pt-br') {
  userLang = 'pt-BR';
} else if (browserLang === 'pt-pt') {
  userLang = 'pt';
} else if (messages.hasOwnProperty(browserLang)) {
  userLang = browserLang;
} else {
  const shortLang = browserLang.split('-')[0]; // ex: 'fr-fr' → 'fr'
  userLang = messages.hasOwnProperty(shortLang) ? shortLang : 'en';
}

const t = (key) => messages[userLang]?.[key] || messages['en'][key]; // fallback to English

const DOWNLOAD_MENU = `
<ol>
  <li class="header">${t('menuTitle')}</li>
  <li class="download">${t('menuDownload')} <span class="series">${t('menuEpisode')}</span><span class="not-series">${t('menuMovie')}</span></li>
  <li class="download-to-end series">${t('menuDownloadToEnd')}</li>
  <li class="download-season series">${t('menuDownloadSeason')}</li>
  <li class="download-all series">${t('menuDownloadAll')}</li>
  <li class="ep-title-in-filename">${t('menuEpTitleInFilename')} <span></span></li>
  <li class="force-all-lang">${t('menuForceAllLang')} <span></span></li>
  <li class="pref-locale">${t('menuPrefLocale')} <span></span></li>
  <li class="lang-setting">${t('menuLangSetting')} <span></span></li>
  <li class="sub-format">${t('menuSubFormat')} <span></span></li>
  <li class="batch-delay">${t('menuBatchDelay')} <span></span></li>
</ol>
`;

const SCRIPT_CSS = `
#subtitle-downloader-menu {
  position: absolute;
  display: block !important;
  max-width: 100%;
  width: auto;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  background: #141414;
  color: #ffffff;
  border: 1px solid #333;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  border-radius: 4px;
  z-index: 99999998;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
  overflow-x: auto;
  white-space: nowrap;
}

#subtitle-downloader-menu ol {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
}

#subtitle-downloader-menu li {
  padding: 10px;
  border-bottom: 1px solid #333;
  cursor: pointer;
  transition: background-color 0.3s ease, color 0.3s ease;
}

#subtitle-downloader-menu li.header {
  font-weight: bold;
  background: #181818;
  cursor: default;
  border-bottom: 1px solid #505050;
  text-align: center;
}

#subtitle-downloader-menu li:not(.header) {
  display: none;
}

#subtitle-downloader-menu li:not(.header):hover {
  background: rgba(229, 9, 20, 0.1);
  color: #e50914;
}

#subtitle-downloader-menu:hover li {
  display: block;
}

#subtitle-downloader-menu:not(.series) .series { display: none; }
#subtitle-downloader-menu.series .not-series { display: none; }

#subtitle-downloader-menu:hover {
  display: block;
}
`;

const SUB_TYPES = {
  'subtitles': '',
  'closedcaptions': '[cc]'
};

let idOverrides = {};
let subCache = {};
let titleCache = {};

let batch = null;
try {
  batch = JSON.parse(sessionStorage.getItem('NSD_batch'));
}
catch(ignore) {}

let batchAll = null;
let batchSeason = null;
let batchToEnd = null;

let epTitleInFilename = localStorage.getItem('NSD_ep-title-in-filename') === 'true';
let forceSubs = localStorage.getItem('NSD_force-all-lang') !== 'false';
let prefLocale = localStorage.getItem('NSD_pref-locale') || '';
let langs = localStorage.getItem('NSD_lang-setting') || '';
let subFormat = localStorage.getItem('NSD_sub-format') || WEBVTT;
let batchDelay = parseFloat(localStorage.getItem('NSD_batch-delay') || '0');

const setEpTitleInFilename = () => {
  document.querySelector('#subtitle-downloader-menu .ep-title-in-filename > span').innerHTML = t(epTitleInFilename ? 'on' : 'off');
};
const setForceText = () => {
  document.querySelector('#subtitle-downloader-menu .force-all-lang > span').innerHTML = t(forceSubs ? 'on' : 'off');
};
const setLocaleText = () => {
  const text = prefLocale === '' ? t('disabled') : prefLocale;
  document.querySelector('#subtitle-downloader-menu .pref-locale > span').textContent = text;
};
const setLangsText = () => {
  const text = langs === '' ? t('all') : langs;
  document.querySelector('#subtitle-downloader-menu .lang-setting > span').textContent = text;
};
const setFormatText = () => {
  document.querySelector('#subtitle-downloader-menu .sub-format > span').innerHTML = FORMAT_NAMES[subFormat];
};
const setBatchDelayText = () => {
  document.querySelector('#subtitle-downloader-menu .batch-delay > span').innerHTML = batchDelay;
};

const setBatch = b => {
  if(b === null)
    sessionStorage.removeItem('NSD_batch');
  else
    sessionStorage.setItem('NSD_batch', JSON.stringify(b));
};

const toggleEpTitleInFilename = () => {
  epTitleInFilename = !epTitleInFilename;
  if(epTitleInFilename)
    localStorage.setItem('NSD_ep-title-in-filename', epTitleInFilename);
  else
    localStorage.removeItem('NSD_ep-title-in-filename');
  setEpTitleInFilename();
};
const toggleForceLang = () => {
  forceSubs = !forceSubs;
  if(forceSubs)
    localStorage.removeItem('NSD_force-all-lang');
  else
    localStorage.setItem('NSD_force-all-lang', forceSubs);
  document.location.reload();
};
const setPreferredLocale = () => {
  const result = prompt(t('preferredLocalePrompt'), prefLocale);
  if (result !== null) {
    prefLocale = result;
    if (prefLocale === '')
      localStorage.removeItem('NSD_pref-locale');
    else
      localStorage.setItem('NSD_pref-locale', prefLocale);
    document.location.reload();
  }
};
const setLangToDownload = () => {
  const result = prompt(t('downloadLangsPrompt'), langs);
  if(result !== null) {
    langs = result;
    if(langs === '')
      localStorage.removeItem('NSD_lang-setting');
    else
      localStorage.setItem('NSD_lang-setting', langs);
    setLangsText();
  }
};
const setSubFormat = () => {
  if(subFormat === WEBVTT) {
    localStorage.setItem('NSD_sub-format', DFXP);
    subFormat = DFXP;
  }
  else {
    localStorage.removeItem('NSD_sub-format');
    subFormat = WEBVTT;
  }
  setFormatText();
};
const setBatchDelay = () => {
  let result = prompt(t('delayPrompt'), batchDelay);
  if(result !== null) {
    result = parseFloat(result.replace(',', '.'));
    if(result < 0 || !Number.isFinite(result))
      result = 0;
    batchDelay = result;
    if(batchDelay == 0)
      localStorage.removeItem('NSD_batch-delay');
    else
      localStorage.setItem('NSD_batch-delay', batchDelay);
    setBatchDelayText();
  }
};

const asyncSleep = (seconds, value) => new Promise(resolve => {
  window.setTimeout(resolve, seconds * 1000, value);
});

const popRandomElement = arr => {
  return arr.splice(arr.length * Math.random() << 0, 1)[0];
};

const processSubInfo = async result => {
  const tracks = result.timedtexttracks;
  const subs = {};
  let reportError = true;
  for(const track of tracks) {
    if(track.isNoneTrack)
      continue;

    let type = SUB_TYPES[track.rawTrackType];
    if(typeof type === 'undefined')
      type = `[${track.rawTrackType}]`;
    const variant = (typeof track.trackVariant === 'undefined' ? '' : `-${track.trackVariant}`);
    const lang = track.language + type + variant + (track.isForcedNarrative ? '-forced' : '');

    const formats = {};
    for(let format of ALL_FORMATS) {
      const downloadables = track.ttDownloadables[format];
      if(typeof downloadables !== 'undefined') {
        let urls;
        if(typeof downloadables.downloadUrls !== 'undefined')
          urls = Object.values(downloadables.downloadUrls);
        else if(typeof downloadables.urls !== 'undefined')
          urls = downloadables.urls.map(({url}) => url);
        else {
          console.log('processSubInfo:', lang, Object.keys(downloadables));
          if(reportError) {
            reportError = false;
            alert(t('subtitleUrlError'));
          }
          continue;
        }
        formats[format] = [urls, EXTENSIONS[format]];
      }
    }

    if(Object.keys(formats).length > 0) {
      for(let i = 0; ; ++i) {
        const langKey = lang + (i == 0 ? "" : `-${i}`);
        if(typeof subs[langKey] === "undefined") {
          subs[langKey] = formats;
          break;
        }
      }
    }
  }
  subCache[result.movieId] = subs;
};

const checkSubsCache = async menu => {
  while(getSubsFromCache(true) === null) {
    await asyncSleep(0.1);
  }

  // show menu if on watch page
  menu.style.display = (document.location.pathname.split('/')[1] === 'watch' ? '' : 'none');

  if(batch !== null && batch.length > 0) {
    downloadBatch(true);
  }
};

const processMetadata = data => {
  // add menu when it's not there
  let menu = document.querySelector('#subtitle-downloader-menu');
  if(menu === null) {
    menu = document.createElement('div');
    menu.id = 'subtitle-downloader-menu';
    menu.innerHTML = DOWNLOAD_MENU;
    document.body.appendChild(menu);
    menu.querySelector('.download').addEventListener('click', downloadThis);
    menu.querySelector('.download-to-end').addEventListener('click', downloadToEnd);
    menu.querySelector('.download-season').addEventListener('click', downloadSeason);
    menu.querySelector('.download-all').addEventListener('click', downloadAll);
    menu.querySelector('.ep-title-in-filename').addEventListener('click', toggleEpTitleInFilename);
    menu.querySelector('.force-all-lang').addEventListener('click', toggleForceLang);
    menu.querySelector('.pref-locale').addEventListener('click', setPreferredLocale);
    menu.querySelector('.lang-setting').addEventListener('click', setLangToDownload);
    menu.querySelector('.sub-format').addEventListener('click', setSubFormat);
    menu.querySelector('.batch-delay').addEventListener('click', setBatchDelay);
    setEpTitleInFilename();
    setForceText();
    setLocaleText();
    setLangsText();
    setFormatText();
  }
  // hide menu, at this point sub info is still missing
  menu.style.display = 'none';
  menu.classList.remove('series');

  const result = data.video;
  const {type, title} = result;
  if(type === 'show') {
    batchAll = [];
    batchSeason = [];
    batchToEnd = [];
    const allEpisodes = [];
    let currentSeason = 0;
    menu.classList.add('series');
    for(const season of result.seasons) {
      for(const episode of season.episodes) {
        if(episode.id === result.currentEpisode)
          currentSeason = season.seq;
        allEpisodes.push([season.seq, episode.seq, episode.id]);
        titleCache[episode.id] = {
          type, title,
          season: season.seq,
          episode: episode.seq,
          subtitle: episode.title,
          hiddenNumber: episode.hiddenEpisodeNumbers
        };
      }
    }

    allEpisodes.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let toEnd = false;
    for(const [season, episode, id] of allEpisodes) {
      batchAll.push(id);
      if(season === currentSeason)
        batchSeason.push(id);
      if(id === result.currentEpisode)
        toEnd = true;
      if(toEnd)
        batchToEnd.push(id);
    }
  }
  else if(type === 'movie' || type === 'supplemental') {
    titleCache[result.id] = {type, title};
  }
  else {
  	console.debug('[Netflix Subtitle Downloader] unknown video type:', type, result)
    return;
  }
  checkSubsCache(menu);
};

const getVideoId = () => window.location.pathname.split('/').pop();

const getXFromCache = (cache, name, silent) => {
  const id = getVideoId();
  if(cache.hasOwnProperty(id))
    return cache[id];

  let newID = undefined;
  try {
    newID = unsafeWindow.netflix.falcorCache.videos[id].current.value[1];
  }
  catch(ignore) {}
  if(typeof newID !== 'undefined' && cache.hasOwnProperty(newID))
    return cache[newID];

  newID = idOverrides[id];
  if(typeof newID !== 'undefined' && cache.hasOwnProperty(newID))
    return cache[newID];

  if(silent === true)
    return null;

  alert(t('subtitleNotFound'));
  throw '';
};

const getSubsFromCache = silent => getXFromCache(subCache, 'subs', silent);

const pad = (number, letter) => `${letter}${number.toString().padStart(2, '0')}`;

const safeTitle = title => title.trim().replace(/[:*?"<>|\\\/]+/g, '_').replace(/ /g, '.');

const getTitleFromCache = () => {
  const title = getXFromCache(titleCache, 'title');
  const titleParts = [title.title];
  if(title.type === 'show') {
    const season = pad(title.season, 'S');
    if(title.hiddenNumber) {
      titleParts.push(season);
      titleParts.push(title.subtitle);
    }
    else {
      titleParts.push(season + pad(title.episode, 'E'));
      if(epTitleInFilename)
        titleParts.push(title.subtitle);
    }
  }
  return [safeTitle(titleParts.join('.')), safeTitle(title.title)];
};

const pickFormat = formats => {
  const preferred = (subFormat === DFXP ? ALL_FORMATS : ALL_FORMATS_prefer_vtt);

  for(let format of preferred) {
    if(typeof formats[format] !== 'undefined')
      return formats[format];
  }
};


const _save = async (_zip, title) => {
  const content = await _zip.generateAsync({type:'blob'});
  saveAs(content, title + '.zip');
};

const _download = async _zip => {
  const subs = getSubsFromCache();
  const [title, seriesTitle] = getTitleFromCache();
  const downloaded = [];

  let filteredLangs;
  if(langs === '')
    filteredLangs = Object.keys(subs);
  else {
    const regularExpression = new RegExp(
      '^(' + langs
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\-/g, '\\-')
        .replace(/\s/g, '')
        .replace(/,/g, '|')
      + ')'
    );
    filteredLangs = [];
    for(const lang of Object.keys(subs)) {
      if(lang.match(regularExpression))
        filteredLangs.push(lang);
    }
  }

  const progress = new ProgressBar(filteredLangs.length);
  let stop = false;
  for(const lang of filteredLangs) {
    const [urls, extension] = pickFormat(subs[lang]);
    while(urls.length > 0) {
      let url = popRandomElement(urls);
      const resultPromise = fetch(url, {mode: "cors"});
      let result;
      try {
        // Promise.any isn't supported in all browsers, use Promise.race instead
        result = await Promise.race([resultPromise, progress.stop, asyncSleep(30, STOP_THE_DOWNLOAD)]);
      }
      catch(e) {
        // the only promise that can be rejected is the one from fetch
        // if that happens we want to stop the download anyway
        result = STOP_THE_DOWNLOAD;
      }
      if(result === STOP_THE_DOWNLOAD) {
        stop = true;
        break;
      }
      progress.increment();
      const data = await result.text();
      if(data.length > 0) {
        downloaded.push({lang, data, extension});
        break;
      }
    }
    if(stop)
      break;
  }

  downloaded.forEach(x => {
    const {lang, data, extension} = x;
    _zip.file(`${title}.WEBRip.Netflix.${lang}.${extension}`, data);
  });

  if(await Promise.race([progress.stop, {}]) === STOP_THE_DOWNLOAD)
    stop = true;
  progress.destroy();

  return [seriesTitle, stop];
};

const downloadThis = async () => {
  const _zip = new JSZip();
  const [title, stop] = await _download(_zip);
  _save(_zip, title);
};

const cleanBatch = async () => {
  setBatch(null);
  return;
  const cache = await caches.open('NSD');
  cache.delete('/subs.zip');
  await caches.delete('NSD');
}

const readAsBinaryString = blob => new Promise(resolve => {
  const reader = new FileReader();
  reader.onload = function(event) {
    resolve(event.target.result);
  };
  reader.readAsBinaryString(blob);
});

const downloadBatch = async auto => {
  const cache = await caches.open('NSD');
  let zip, title, stop;
  if(auto === true) {
    try {
      const response = await cache.match('/subs.zip');
      const blob = await response.blob();
      zip = await JSZip.loadAsync(await readAsBinaryString(blob));
    }
    catch(error) {
      console.error(error);
      alert('An error occured when loading the zip file with subs from the cache. More info in the browser console.');
      await cleanBatch();
      return;
    }
  }
  else
    zip = new JSZip();

  try {
    [title, stop] = await _download(zip);
  }
  catch(error) {
    title = 'unknown';
		stop = true;
  }

  const id = parseInt(getVideoId());
  batch = batch.filter(x => x !== id);

  if(stop || batch.length == 0) {
    await _save(zip, title);
    await cleanBatch();
  }
  else {
    setBatch(batch);
    cache.put('/subs.zip', new Response(await zip.generateAsync({type:'blob'})));
    await asyncSleep(batchDelay);
    window.location = window.location.origin + '/watch/' + batch[0];
  }
};

const downloadAll = () => {
  batch = batchAll;
  downloadBatch();
};

const downloadSeason = () => {
  batch = batchSeason;
  downloadBatch();
};

const downloadToEnd = () => {
  batch = batchToEnd;
  downloadBatch();
};

const processMessage = e => {
  const {type, data} = e.detail;
  if(type === 'subs')
    processSubInfo(data);
  else if(type === 'id_override')
    idOverrides[data[0]] = data[1];
  else if(type === 'metadata')
    processMetadata(data);
}

const injection = (ALL_FORMATS) => {
  const MANIFEST_PATTERN = new RegExp('manifest|licensedManifest');
  const forceSubs = localStorage.getItem('NSD_force-all-lang') !== 'false';
  const prefLocale = localStorage.getItem('NSD_pref-locale') || '';

  // hide the menu when we go back to the browse list
  window.addEventListener('popstate', () => {
    const display = (document.location.pathname.split('/')[1] === 'watch' ? '' : 'none');
    const menu = document.querySelector('#subtitle-downloader-menu');
    menu.style.display = display;
  });

  // hijack JSON.parse and JSON.stringify functions
  ((parse, stringify, open, realFetch) => {
    JSON.parse = function (text) {
      const data = parse(text);

      if (data && data.result && data.result.timedtexttracks && data.result.movieId) {
        window.dispatchEvent(new CustomEvent('netflix_sub_downloader_data', {detail: {type: 'subs', data: data.result}}));
      }
      return data;
    };

    JSON.stringify = function (data) {
      /*{
        let text = stringify(data);
        if (text.includes('dfxp-ls-sdh'))
          console.log(text, data);
      }*/

      if (data && typeof data.url === 'string' && data.url.search(MANIFEST_PATTERN) > -1) {
        for (let v of Object.values(data)) {
          try {
            if (v.profiles) {
              for(const profile_name of ALL_FORMATS) {
                if(!v.profiles.includes(profile_name)) {
                  v.profiles.unshift(profile_name);
                }
              }
            }
            if (v.showAllSubDubTracks != null && forceSubs)
              v.showAllSubDubTracks = true;
            if (prefLocale !== '')
              v.preferredTextLocale = prefLocale;
          }
          catch (e) {
            if (e instanceof TypeError)
              continue;
            else
              throw e;
          }
        }
      }
      if(data && typeof data.movieId === 'number') {
        try {
          let videoId = data.params.sessionParams.uiplaycontext.video_id;
          if(typeof videoId === 'number' && videoId !== data.movieId)
            window.dispatchEvent(new CustomEvent('netflix_sub_downloader_data', {detail: {type: 'id_override', data: [videoId, data.movieId]}}));
        }
        catch(ignore) {}
      }
      return stringify(data);
    };

    XMLHttpRequest.prototype.open = function() {
      if(arguments[1] && arguments[1].includes('/metadata?'))
        this.addEventListener('load', async () => {
          let data = this.response;
          if(data instanceof Blob)
            data = JSON.parse(await data.text());
          else if(typeof data === "string")
            data = JSON.parse(data);
          window.dispatchEvent(new CustomEvent('netflix_sub_downloader_data', {detail: {type: 'metadata', data: data}}));
        }, false);
      open.apply(this, arguments);
    };

    window.fetch = async (...args) => {
      const response = realFetch(...args);
      if(args[0] && args[0].includes('/metadata?')) {
        const copied = (await response).clone();
        const data = await copied.json();
        window.dispatchEvent(new CustomEvent('netflix_sub_downloader_data', {detail: {type: 'metadata', data: data}}));
      }
      return response;
    };
  })(JSON.parse, JSON.stringify, XMLHttpRequest.prototype.open, window.fetch);
}

window.addEventListener('netflix_sub_downloader_data', processMessage, false);

// inject script
const sc = document.createElement('script');
sc.innerHTML = '(' + injection.toString() + ')(' + JSON.stringify(ALL_FORMATS) + ')';
document.head.appendChild(sc);
document.head.removeChild(sc);

// add CSS style
const s = document.createElement('style');
s.innerHTML = SCRIPT_CSS;
document.head.appendChild(s);

const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node) {
      // add scrollbar - Netflix doesn't expect you to have this manu languages to choose from...
      try {
        (node.parentNode || node).querySelector('.watch-video--selector-audio-subtitle').parentNode.style.overflowY = 'scroll';
      }
      catch(ignore) {}
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });
