// Payment placeholder. It asks for no card or bank details and takes no money.
// A real store would swap in a hosted checkout from a PCI-compliant provider here.
export interface PaymentResult {
  provider: 'simulated';
  status: 'simulated_ok';
}

export interface PaymentProvider {
  readonly label: string;
  authorise(): Promise<PaymentResult>;
}

export const SimulatedProvider: PaymentProvider = {
  label: 'Simulated payment (no money is taken)',
  authorise: async () => ({ provider: 'simulated', status: 'simulated_ok' }),
};
