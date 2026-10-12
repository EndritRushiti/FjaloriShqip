// The Workers runtime module that builds outgoing emails (used only at runtime by contact.ts).
declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string);
  }
}
