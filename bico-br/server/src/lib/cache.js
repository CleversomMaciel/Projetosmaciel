/**
 * Cache em memória com TTL e limite de itens (descarta o mais antigo).
 * Serve como 1º nível; o 2º nível (compartilhado entre instâncias) é a tabela registry_cache.
 */
export class MemoryCache {
  constructor({ maxItems = 5000, now = () => Date.now() } = {}) {
    this.maxItems = maxItems;
    this.now = now;
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value, ttlSeconds) {
    if (this.map.size >= this.maxItems && !this.map.has(key)) {
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }
}
