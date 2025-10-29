import fs from 'fs/promises';
import crypto from 'crypto';

export async function verifyPlugin(pluginPath:string, sigPath:string, pubKey:string){
  const pluginContent = await fs.readFile(pluginPath);
  const sig = await fs.readFile(sigPath);
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(pluginContent);
  verifier.end();
  return verifier.verify(pubKey, sig);
}
