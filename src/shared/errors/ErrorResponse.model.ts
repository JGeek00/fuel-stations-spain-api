export interface ApiError {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}
