export class BillingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 404 | 409 | 502 | 503 = 400
  ) {
    super(message);
    this.name = "BillingError";
  }
}
