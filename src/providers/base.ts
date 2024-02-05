import { ConfigurationsRecord } from "../types";

export abstract class Provider {
    constructor(public name: string) {}

    /**
     * Initialize the provider
     */
    async init() {}

    public abstract getAll(): Promise<ConfigurationsRecord>;
}