/* Simple client-side i18n utility with:
   - Locale persistence in localStorage
   - <html lang> synchronization
   - data-i18n for textContent/innerHTML
   - data-i18n-attr for attributes (comma-separated list)
   - Page scoping via data-page on <body>
*/
(function () {
  var STORAGE_KEY = 'lang';
  var defaultLang = 'en';
  var supported = ['en', 'es', 'pt', 'fr'];

  function detectInitialLang() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && supported.indexOf(saved) !== -1) return saved;
    var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    var cand = nav.split('-')[0];
    return supported.indexOf(cand) !== -1 ? cand : defaultLang;
  }

  function setHtmlLang(lang) {
    var html = document.documentElement;
    if (html) html.setAttribute('lang', lang);
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Failed to load ' + url);
      return r.json();
    });
  }

  function resolve(obj, path) {
    return path.split('.').reduce(function (acc, key) {
      return acc && acc[key] != null ? acc[key] : undefined;
    }, obj);
  }

  function normalizePageKey(pageKey) {
    if (pageKey === 'publicIndex') return 'public.index';
    if (pageKey === 'public404') return 'public.404';
    return pageKey;
  }

  function applyTranslations(dict, pageKeyRaw) {
    var pageKey = normalizePageKey(pageKeyRaw);
    // Page title if provided
    var titleKey = pageKey + '.title';
    var pageTitle = resolve(dict, titleKey);
    if (typeof pageTitle === 'string') document.title = pageTitle;

    // Update all [data-i18n]
    var nodes = document.querySelectorAll('[data-i18n]');
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = resolve(dict, key);
      if (val == null) return;
      // If original contains <br> markers, keep HTML
      if (val.indexOf && (val.indexOf('<br') !== -1 || val.indexOf('</') !== -1)) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });

    // Update attributes
    var attrNodes = document.querySelectorAll('[data-i18n-attr]');
    attrNodes.forEach(function (el) {
      var attrs = (el.getAttribute('data-i18n-attr') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var base = el.getAttribute('data-i18n');
      if (!base) return;
      attrs.forEach(function (attr) {
        var v = resolve(dict, base + '.' + attr);
        // Fallback: if no nested value, use base value directly
        if (v == null) {
          v = resolve(dict, base);
        }
        if (v != null) el.setAttribute(attr, v);
      });
    });
  }

  function loadAndApply(lang) {
    var pageKey = (document.body && document.body.getAttribute('data-page')) || 'index';
    return fetchJSON('/js/locales/' + lang + '.json')
      .then(function (dict) {
        applyTranslations(dict, pageKey);
      })
      .catch(function (err) {
        // Fallback to default
        if (lang !== defaultLang) {
          return fetchJSON('/js/locales/' + defaultLang + '.json').then(function (dict) {
            applyTranslations(dict, pageKey);
          });
        }
        // eslint-disable-next-line no-console
        console.error(err);
      });
  }

  function init() {
    var current = detectInitialLang();
    setHtmlLang(current);
    loadAndApply(current);

    // Hook language switchers
    document.addEventListener('change', function (e) {
      var target = e.target;
      if (!target || target.getAttribute('data-lang-switch') !== 'select') return;
      var lang = target.value;
      if (supported.indexOf(lang) === -1) return;
      localStorage.setItem(STORAGE_KEY, lang);
      setHtmlLang(lang);
      loadAndApply(lang);
      // Sync all switchers
      document.querySelectorAll('[data-lang-switch="select"]').forEach(function (sel) {
        if (sel !== target) sel.value = lang;
      });
    });

    // Initialize switchers to current value
    document.addEventListener('DOMContentLoaded', function () {
      var saved = localStorage.getItem(STORAGE_KEY) || current;
      document.querySelectorAll('[data-lang-switch="select"]').forEach(function (sel) {
        sel.value = supported.indexOf(saved) !== -1 ? saved : defaultLang;
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


