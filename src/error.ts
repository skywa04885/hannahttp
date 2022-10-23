export class HTTPError extends Error {
  public constructor(message?: string) {
    super(message);
  }
}

export class HTTPNetworkingError extends HTTPError {}

export enum HTTPSyntaxErrorSource {
  RequestLineParser = "RequestLineParser",
  RequestHeadersParser = "RequestHeadersParser",
  RequestBodyParser = "RequestBodyParser",
}

export class HTTPSyntaxError extends HTTPError {
  public constructor(
    public readonly source: HTTPSyntaxErrorSource,
    message?: string
  ) {
    super(message);
  }
}

export class HTTPVersionNotSupportedError extends HTTPError {}
