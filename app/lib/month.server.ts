export function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET'
    ) {
      return true;
    }

    if (
      err.message.includes('ENOTFOUND') ||
      err.message.includes('getaddrinfo')
    ) {
      return true;
    }
  }

  return false;
}
