export function retryBackendStarting(failureCount: number, error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 503 && failureCount < 8;
}

export function backendStartingRetryDelay(): number {
  return 1000;
}
