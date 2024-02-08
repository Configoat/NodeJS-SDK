import { readFileSync } from "fs";
import { homedir } from "os";

export function deepEqual(a: any, b: any) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// Copied from CLI tool

const configoatFolder = `${homedir()}/.configoat`;
const configFile = `${configoatFolder}/config.json`;

export function getLocalConfig(key: string) {
    try {
        return JSON.parse(readFileSync(configFile, "utf-8"))[key];
    }
    catch (err) {
        return undefined;
    }
}
