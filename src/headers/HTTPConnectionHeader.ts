import { HTTPCommaSeparatedValueHeader } from "./HTTPHeader";

export enum HTTPConnectionPreference {
  Close = "close",
  KeepAlive = "keep-alive",
}

export class HTTPConnectionPreferenceHeader extends HTTPCommaSeparatedValueHeader<HTTPConnectionPreference> {
  public constructor(value: HTTPConnectionPreference[]) {
    super(value);
  }
}

