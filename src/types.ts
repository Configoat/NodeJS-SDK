import { Provider } from "./providers";

export type InitOptions = {
    apiUrl: string;
    environments: Environment[];
    providers: Provider[];
    defaultProviders: boolean;
    autoReload: boolean;
    autoReloadInterval: number;
    setProcessEnv: boolean;
    modifyConfigBehavior: ModifyConfigBehavior;
}

export type Environment = {
    id: string;
    token: string;
}

export type ConfigurationsRecord = Record<string, any>;

export enum ModifyConfigBehavior {
    LOCAL_ONLY = "LOCAL_ONLY",
    FIRST_ENVIRONMENT = "FIRST_ENVIRONMENT",
    ALL_ENVIRONMENTS = "ALL_ENVIRONMENTS",
}