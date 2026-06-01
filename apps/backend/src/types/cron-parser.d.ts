declare module 'cron-parser' {
  export function parseExpression(
    expression: string,
    options?: {
      tz?: string;
    }
  ): {
    next(): {
      toDate(): Date;
    };
  };
}