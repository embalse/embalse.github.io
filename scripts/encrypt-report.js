// Cifra un reporte para orli.html (AES-GCM con clave PBKDF2 de "usuario:contraseña").
// Uso: node scripts/encrypt-report.js <reporte.js> <salida.enc.js> <usuario> <contraseña>
const fs = require("fs");
const { webcrypto: { subtle }, randomBytes } = require("crypto");

const ITERATIONS = 250000;
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

async function main() {
  const [input, output, user, password] = process.argv.slice(2);
  if (!password) throw new Error("Uso: encrypt-report.js <reporte.js> <salida.enc.js> <usuario> <contraseña>");

  const source = fs.readFileSync(input, "utf8").trim();
  const json = source.replace(/^window\.ORLI_REPORT\s*=\s*/, "").replace(/;$/, "");
  JSON.parse(json);

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const material = await subtle.importKey("raw", Buffer.from(`${user}:${password}`), "PBKDF2", false, ["deriveKey"]);
  const key = await subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const data = await subtle.encrypt({ name: "AES-GCM", iv }, key, Buffer.from(json));

  const payload = { iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data)) };
  fs.writeFileSync(output, `window.ORLI_REPORT_ENC = ${JSON.stringify(payload)};\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
