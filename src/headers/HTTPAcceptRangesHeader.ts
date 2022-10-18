import { HTTPCommaSeparatedValueHeader } from "./HTTPHeader";

export enum HTTPAcceptRange {
  Bytes = "bytes",
}

export class HTTPAcceptRangesHeader extends HTTPCommaSeparatedValueHeader<HTTPAcceptRange> {
  public constructor(_values: HTTPAcceptRange[] = []) {
    super(_values);
  }
}
