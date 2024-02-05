import { ConfigurationsRecord } from "../types";
import { Provider } from "./base";

export class EnvProvider extends Provider {
    private initialDotEnv: ConfigurationsRecord = process.env;

    constructor() {
        super("process.env");
    }

    public async getAll(): Promise<ConfigurationsRecord> {
        return this.initialDotEnv;
    }
}