import { ExposedConfigurationsRecord, ModifyConfigBehavior, ServiceOptions } from "../types";

export interface IService {
    /**
     * Initialize the provider
     */
    init?(): Promise<void>;

    get(): Promise<ExposedConfigurationsRecord>;

    options?(): Partial<ServiceOptions>;

    update?(key: string, value: any, modifyConfigBehavior: ModifyConfigBehavior): Promise<void>;

    save?(configs: ExposedConfigurationsRecord): Promise<void>;
}