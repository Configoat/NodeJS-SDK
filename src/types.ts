import { Provider } from "./providers";

export type InitOptions = {
    apiUrl: string;
    environments: Environment[];
    providers: Provider[];
    defaultProviders: boolean;
    autoReload: boolean;
    autoReloadInterval: number;
    setProcessEnv: boolean;
}

export type Environment = {
    id: string;
    token: string;
}

export type ConfigurationsRecord = Record<string, any>;