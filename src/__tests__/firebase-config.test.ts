import { afterEach, describe, expect, it } from "vitest";
import { CloudDisabledError, getDb, isCloudConfigured, isCloudDisabledError, resetDbCache } from "@/server/firebase";

const ENV_KEYS = [
  "FIREBASE_SERVICE_ACCOUNT",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "FIRESTORE_EMULATOR_HOST",
] as const;

const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

afterEach(() => {
  clearEnv();
  for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  resetDbCache();
});

describe("firebase credentials resolution", () => {
  it("is disabled when nothing is configured (لا DATABASE_URL ولا اعتمادات)", () => {
    clearEnv();
    expect(isCloudConfigured()).toBe(false);
    expect(() => getDb()).toThrow(CloudDisabledError);
  });

  it("detects the separate FIREBASE_* variables", () => {
    clearEnv();
    process.env.FIREBASE_PROJECT_ID = "demo-project";
    process.env.FIREBASE_CLIENT_EMAIL = "sa@demo-project.iam.gserviceaccount.com";
    process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n";
    expect(isCloudConfigured()).toBe(true);
  });

  it("accepts a full service-account JSON, raw or base64", () => {
    const json = JSON.stringify({
      project_id: "demo-project",
      client_email: "sa@demo-project.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
    });
    clearEnv();
    process.env.FIREBASE_SERVICE_ACCOUNT = json;
    expect(isCloudConfigured()).toBe(true);
    clearEnv();
    process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(json, "utf8").toString("base64");
    expect(isCloudConfigured()).toBe(true);
  });

  it("ignores an incomplete service account", () => {
    clearEnv();
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: "demo-project" });
    expect(isCloudConfigured()).toBe(false);
  });

  it("supports ADC and the Firestore emulator", () => {
    clearEnv();
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/sa.json";
    expect(isCloudConfigured()).toBe(true);
    clearEnv();
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    expect(isCloudConfigured()).toBe(false);
    process.env.FIREBASE_PROJECT_ID = "demo-project";
    expect(isCloudConfigured()).toBe(true);
  });

  it("recognises the disabled error by instance and by code", () => {
    expect(isCloudDisabledError(new CloudDisabledError())).toBe(true);
    expect(isCloudDisabledError({ code: "cloud_disabled" })).toBe(true);
    expect(isCloudDisabledError(new Error("other"))).toBe(false);
  });
});
