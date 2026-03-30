function lowerErrorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }

  return String(error).toLowerCase();
}

export function isRecoverableLlmDependencyError(error: unknown): boolean {
  const message = lowerErrorText(error);
  return (
    message.includes('invalid api key') ||
    message.includes('invalid_api_key') ||
    message.includes('authentication') ||
    message.includes('rate limit') ||
    message.includes('rate_limit_exceeded') ||
    message.includes('retry after') ||
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('temporarily unavailable') ||
    message.includes('service unavailable')
  );
}

export function isRecoverableOnchainDependencyError(error: unknown): boolean {
  const message = lowerErrorText(error);
  return (
    message.includes('getperpmarketids') ||
    message.includes('returned no data ("0x")') ||
    message.includes('address is not a contract') ||
    message.includes('contractfunctionzerodataerror') ||
    message.includes('abidecodingzerodataerror')
  );
}
