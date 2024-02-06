import { ExposedConfigurationsRecord, ModifyConfigBehavior, ProviderOptions } from "../types";

export interface IService {
    /**
     * Initialize the provider
     */
    init?(): Promise<void>;

    get(): Promise<ExposedConfigurationsRecord>;

    options?(): Partial<ProviderOptions>;

    update?(key: string, value: any, modifyConfigBehavior: ModifyConfigBehavior): Promise<void>;

    save?(configs: ExposedConfigurationsRecord): Promise<void>;
}