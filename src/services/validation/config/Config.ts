import { ProductConfig } from "./ProductConfig";
import { Capability, CapabilityId, Product } from "@octocloud/types";
import { ValidationEndpoint } from "../../../schemas/Validation";
import { ValidatorError } from "../../../validators/backendValidator/ValidatorHelpers";
import { ApiClient } from "../api/ApiClient";
import { DateHelper } from "../../../helpers/DateHelper";
import { addDays } from "date-fns";

export interface ErrorResult<T> {
  data: Nullable<T>;
  error: Nullable<ValidatorError>;
}
interface IConfig {
  setCapabilities(capabilities: Capability[]): ValidatorError[];
  getCapabilityIDs(): CapabilityId[];
  setProducts(products: Product[]): ValidatorError[];
  getProduct(): Product;
}
export class Config implements IConfig {
  private static instance: Config;

  private endpoint: Nullable<string> = null;
  private apiKey: Nullable<string> = null;

  private capabilities: CapabilityId[] = [];

  public invalidProductId = "invalidProductId";
  public invalidOptionId = "invalidOptionId";
  public invalidAvailabilityId = "invalidAvailabilityId";
  public invalidUUID = "invalidUUID";
  public note = "Test Note";
  public _terminateValidation = false;

  public localDateStart = DateHelper.getDate(new Date().toISOString());
  public localDateEnd = DateHelper.getDate(
    addDays(new Date(), 30).toISOString()
  );

  public readonly productConfig = new ProductConfig();

  public static getInstance = (): Config => {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  };

  public init = (data: ValidationEndpoint): void => {
    this.endpoint = data.backend.endpoint;
    this.apiKey = data.backend.apiKey;
  };

  public getApiClient = (): ApiClient => {
    return new ApiClient({
      url: this.endpoint,
      apiKey: this.apiKey,
      capabilities: this.getCapabilityIDs(),
    });
  };

  public get terminateValidation() {
    return this._terminateValidation;
  }

  public set terminateValidation(terminateValidation: boolean) {
    this._terminateValidation = terminateValidation;
  }

  public setCapabilities = (capabilities: Capability[]): ValidatorError[] => {
    this.capabilities = capabilities.map((capability) => {
      return capability.id;
    });
    return [];
  };

  public getCapabilityIDs = (): CapabilityId[] => {
    return this.capabilities;
  };

  public setProducts = (products: Product[]): ValidatorError[] => {
    if (this.productConfig.areProductsValid(products)) {
      this.terminateValidation = true;
    }

    return this.productConfig.setProducts(products);
  };

  public getProduct = (): Product => {
    return this.productConfig.products[0];
  };
}
