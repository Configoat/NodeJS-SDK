import { IService } from "./services";

export type InitOptions = {
    apiUrl: string;
    environments: Environment[];
    services: IService[];
    fallbacks: IService[];
    configoatService: boolean;
    envService: boolean;
    autoReload: boolean;
    autoReloadInterval: number;
    setProcessEnv: boolean;
    modifyConfigBehavior: ModifyConfigBehavior;
}

export type Environment = {
    id: string;
    token: string;
}

export type ExposedConfigurationsRecord = Record<string, any>;

export type InternalConfigurationsRecord = {
    name: string,
    config: ExposedConfigurationsRecord,
    options: ProviderOptions,
}[];

export enum ModifyConfigBehavior {
    MEMORY = "MEMORY",
    FIRST = "FIRST",
    ALL = "ALL",
}

export type ProviderOptions = {
    useInFallback: boolean;
    useInImport: boolean;
}