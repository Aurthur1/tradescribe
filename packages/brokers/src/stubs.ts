import type { BrokerAdapter, BrokerCapabilities, BrokerPlatform } from "./types.js";

const comingSoonCapabilities: BrokerCapabilities = {
  csvImport: false,
  equitySeries: false,
  liveSync: false,
  orderModificationHistory: false,
  readOnly: true
};

export class ComingSoonAdapter implements BrokerAdapter {
  readonly capabilities = comingSoonCapabilities;

  constructor(
    readonly id: string,
    readonly label: string,
    readonly platforms: BrokerPlatform[]
  ) {}

  async connect(): Promise<never> {
    throw new Error(`${this.label} is coming soon`);
  }

  async deploy(): Promise<never> {
    throw new Error(`${this.label} is coming soon`);
  }

  async disconnect(): Promise<void> {}

  async getAccountInfo(): Promise<never> {
    throw new Error(`${this.label} is coming soon`);
  }

  async getEquitySeries() {
    return [];
  }

  async getHistory() {
    return [];
  }
}
