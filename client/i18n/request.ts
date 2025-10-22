
import {cookies} from 'next/headers';
import {getRequestConfig} from 'next-intl/server';
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  const cookieStore = await cookies();
  const localeFromCookie = cookieStore.get('NEXT_LOCALE')?.value;

  console.log('Locale from request:', locale);
  console.log('Locale from cookie:', localeFromCookie);

  if (localeFromCookie) {
    locale = localeFromCookie;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
