import { id } from './locales/id';

export type DeepString<T> = T extends object
  ? { [K in keyof T]: DeepString<T[K]> }
  : string;

export type TranslationSchema = DeepString<typeof id>;

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

type Prev = [never, 0, 1, 2, 3, ...never[]];

export type Paths<T, D extends number = 3> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T]-?: K extends string | number
        ? `${K}` | Join<K, Paths<T[K], Prev[D]>>
        : never;
    }[keyof T]
  : '';

export type TranslationKey = Paths<TranslationSchema>;
