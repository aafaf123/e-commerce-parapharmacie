// backend/src/i18n.js
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import middleware from "i18next-http-middleware";

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: "fr",
    backend: {
      loadPath: "./locales/{{lng}}/translation.json"
    },
    detection: {
      order: ['header', 'querystring', 'cookie'],
      caches: false
    }
  });

export default middleware.handle(i18next);