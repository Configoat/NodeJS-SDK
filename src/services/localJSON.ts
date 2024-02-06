import { readFileSync, writeFileSync } from "fs";
import { ExposedConfigurationsRecord } from "../types";
import { IService } from "./base";

export class LocalJSONService implements IService {
    async get() {
        try {
            const data = readFileSync("configurations.json", "utf-8");
            return JSON.parse(data);
        }
        catch (e) {
            return {};
        }
    }
    
    async save(data: ExposedConfigurationsRecord) {
        try {
            writeFileSync("configurations.json", JSON.stringify(data, null, 2));
        }
        catch (e) {
            console.error("Error in Local JSON Fallback", e);
        }
    }
}