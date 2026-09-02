import { hashStagingPassword } from "../server/_core/stagingAuth";

const password = process.env.STAGING_AUTH_PASSWORD;
if (!password) throw new Error("Defina STAGING_AUTH_PASSWORD apenas no processo local.");
process.stdout.write(`${hashStagingPassword(password)}\n`);
