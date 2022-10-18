import { HTTPCommaSeparatedValueHeader } from "./HTTPHeader";

export enum HTTPTransferEncoding {
  Chunked = "chunked",
  Compress = "compress",
  Deflate = "deflate",
  Gzip = "gzip",
}

export class HTTPTransferEncodingHeader extends HTTPCommaSeparatedValueHeader<HTTPTransferEncoding> {
  public constructor() {
    super();
  }
}
