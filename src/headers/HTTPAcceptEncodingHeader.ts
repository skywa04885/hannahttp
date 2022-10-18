import { HTTPCommaSeparatedValueHeader } from "./HTTPHeader";

export enum HTTPAcceptEncoding {
  Chunked = "chunked",
  Compress = "compress",
  Deflate = "deflate",
  Gzip = "gzip",
}

export class HTTPAcceptEncodingHeader extends HTTPCommaSeparatedValueHeader<HTTPAcceptEncoding> {
  public constructor() {
    super();
  }
}
