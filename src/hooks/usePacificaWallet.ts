'use client';

import { useCallback, useEffect, useState } from 'react';

const LINKED_WALLET_KEY = 'pacificast_linked_pacifica_wallet';
const LINKED_WALLET_PROVIDER_KEY = 'pacificast_linked_pacifica_wallet_provider';

type BrowserWalletProvider = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toBase58?: () => string };
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<unknown>;
  signMessage?: (message: Uint8Array, encoding?: string) => Promise<{ signature?: Uint8Array } | Uint8Array>;
};

function isSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function getWalletProvider() {
  if (typeof window === 'undefined') return { provider: null as BrowserWalletProvider | null, name: '' };

  const w = window as Window & {
    phantom?: { solana?: BrowserWalletProvider };
    solflare?: BrowserWalletProvider;
    solana?: BrowserWalletProvider;
  };

  if (w.phantom?.solana?.isPhantom) return { provider: w.phantom.solana, name: 'Phantom' };
  if (w.solflare?.isSolflare) return { provider: w.solflare, name: 'Solflare' };
  if (w.solana?.isPhantom) return { provider: w.solana, name: 'Phantom' };
  return { provider: null, name: '' };
}

export function usePacificaWallet() {
  const [linkedPacificaAddress, setLinkedPacificaAddress] = useState('');
  const [linkedProvider, setLinkedProvider] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const address = window.localStorage.getItem(LINKED_WALLET_KEY) || '';
    const provider = window.localStorage.getItem(LINKED_WALLET_PROVIDER_KEY) || '';
    queueMicrotask(() => {
      setLinkedPacificaAddress(address);
      setLinkedProvider(provider);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const { provider, name } = getWalletProvider();
    if (!provider) return;

    let cancelled = false;
    const syncAddressFromProvider = async () => {
      try {
        // Avoid wallet popups on load; only reconnect if provider trusts this origin.
        await provider.connect?.({ onlyIfTrusted: true });
      } catch {
        // ignore: provider may reject trusted reconnect
      }

      const providerAddress = provider.publicKey?.toBase58?.() || '';
      if (!providerAddress || !isSolanaAddress(providerAddress) || cancelled) return;

      window.localStorage.setItem(LINKED_WALLET_KEY, providerAddress);
      window.localStorage.setItem(LINKED_WALLET_PROVIDER_KEY, name || 'Wallet');
      setLinkedPacificaAddress(providerAddress);
      setLinkedProvider(name || 'Wallet');
    };

    void syncAddressFromProvider();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = () => {
      setLinkedPacificaAddress(window.localStorage.getItem(LINKED_WALLET_KEY) || '');
      setLinkedProvider(window.localStorage.getItem(LINKED_WALLET_PROVIDER_KEY) || '');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const connectLinkedWallet = useCallback(async () => {
    const { provider, name } = getWalletProvider();
    if (!provider?.connect) {
      throw new Error('Install Phantom or Solflare to link a Pacifica wallet.');
    }

    await provider.connect();
    const address = provider.publicKey?.toBase58?.() || '';
    if (!address || !isSolanaAddress(address)) {
      throw new Error('Failed to read a valid Solana public key from wallet provider.');
    }

    window.localStorage.setItem(LINKED_WALLET_KEY, address);
    window.localStorage.setItem(LINKED_WALLET_PROVIDER_KEY, name || 'Wallet');
    setLinkedPacificaAddress(address);
    setLinkedProvider(name || 'Wallet');
    return { address, providerName: name || 'Wallet' };
  }, []);

  const signWithLinkedWallet = useCallback(async (message: string) => {
    const { provider } = getWalletProvider();
    if (!provider?.signMessage) {
      throw new Error('Connected wallet does not support signMessage.');
    }
    const bytes = new TextEncoder().encode(message);
    const signed = await provider.signMessage(bytes, 'utf8');
    const signatureBytes =
      signed instanceof Uint8Array
        ? signed
        : signed?.signature instanceof Uint8Array
          ? signed.signature
          : null;
    if (!signatureBytes) throw new Error('Wallet did not return a signature.');
    return toBase64(signatureBytes);
  }, []);

  const unlinkPacificaWallet = useCallback(() => {
    window.localStorage.removeItem(LINKED_WALLET_KEY);
    window.localStorage.removeItem(LINKED_WALLET_PROVIDER_KEY);
    setLinkedPacificaAddress('');
    setLinkedProvider('');
  }, []);

  return {
    linkedPacificaAddress,
    linkedProvider,
    isPacificaLinked: Boolean(linkedPacificaAddress),
    connectLinkedWallet,
    signWithLinkedWallet,
    unlinkPacificaWallet,
  };
}
