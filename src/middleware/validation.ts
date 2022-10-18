import { HTTPRouterCallback } from "../HTTPRouter";

export interface IUseValidationStringOptions {
  match?: RegExp;
  minLength?: number;
  maxLength?: number;
  allowedValue?: string[];
  required?: boolean;
}

export interface IUseValidationNumberOptions {
  min?: number;
  max?: number;
  allowedValues?: number[];
  required?: boolean; 
}

export interface IUseValidationOptions {

}