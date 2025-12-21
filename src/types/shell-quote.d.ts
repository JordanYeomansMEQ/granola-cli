declare module 'shell-quote' {
  interface ShellQuoteOperator {
    op: string;
    pattern?: string;
  }

  interface ShellQuoteComment {
    comment: string;
  }

  type ShellQuoteToken = string | ShellQuoteOperator | ShellQuoteComment;

  type ShellQuoteEnvValue = string | number | boolean | null | undefined | Record<string, unknown>;

  type ShellQuoteEnv = Record<string, ShellQuoteEnvValue> | ((key: string) => ShellQuoteEnvValue);

  interface ShellQuoteParseOptions {
    escape?: string;
  }

  export function parse(
    command: string,
    env?: ShellQuoteEnv,
    options?: ShellQuoteParseOptions,
  ): ShellQuoteToken[];

  export function quote(args: ReadonlyArray<string>): string;
}
