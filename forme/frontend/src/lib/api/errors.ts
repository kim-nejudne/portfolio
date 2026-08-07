/** The API's single error envelope, mirrored so the client can parse it. */
export interface ErrorEnvelope {
  error: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
