/**
 * Единая точка доступа к секретам окружения.
 *
 * Секрет JWT НЕ имеет значения по умолчанию: предсказуемый секрет = подделка
 * токенов и вход в админку кем угодно. Ошибка выбрасывается лениво (в момент
 * подписи/проверки токена), чтобы `next build` не падал без переменных.
 */

const MIN_JWT_SECRET_LENGTH = 32;

let cachedJwtSecret: Uint8Array | null = null;

export function getJwtSecret(): Uint8Array {
  if (cachedJwtSecret) return cachedJwtSecret;

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      "JWT_SECRET не задан или короче 32 символов. Добавьте его в .env " +
        "(сгенерировать: openssl rand -base64 48)."
    );
  }

  cachedJwtSecret = new TextEncoder().encode(secret);
  return cachedJwtSecret;
}

export function isJwtSecretConfigured(): boolean {
  const secret = process.env.JWT_SECRET;
  return Boolean(secret && secret.length >= MIN_JWT_SECRET_LENGTH);
}
