import { _json, _reader } from "./body";
import { _simple as _loggingSimple } from "./logging";

export namespace middleware {
  export namespace body {
    export const json = _json;
    export const reader = _reader;
  }

  export namespace logging {
    export const simple = _loggingSimple;
  }
}
