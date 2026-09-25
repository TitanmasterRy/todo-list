// A message is plain text with {name} placeholders, or plural forms picked by Intl.PluralRules from the `count` param.
export interface PluralMessage {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}
export type Message = string | PluralMessage;
export type Params = Record<string, string | number>;
