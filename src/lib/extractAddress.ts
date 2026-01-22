export const extractAddress = (addr: unknown): string | null => {
  if (!addr) return null;
  if (typeof addr === "string") {
    return addr.trim() || null;
  }
  if (typeof addr === "object") {
    try {
      const obj = addr as Record<string, unknown>;
      const maybe =
        obj.address ??
        obj.account ??
        obj.addr ??
        obj.wallet ??
        obj.walletAddress ??
        undefined;
      if (typeof maybe === "string" && maybe.trim()) return maybe.trim();

      if (typeof (addr as { toString?: unknown }).toString === "function") {
        const s = String(addr);
        if (s && s !== "[object Object]") return s;
      }
    } catch {
      return null;
    }
  }
  return null;
};
