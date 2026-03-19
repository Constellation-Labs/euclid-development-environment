import type { RemotePortsConfig } from '../config/schema.js';

/**
 * Default remote port configuration used when deploy.remote_ports is not set.
 */
export const DEFAULT_REMOTE_PORTS: RemotePortsConfig = {
  metagraph_l0: { public: 9100, p2p: 9101, cli: 9102 },
  currency_l1: { public: 9200, p2p: 9201, cli: 9202 },
  data_l1: { public: 9300, p2p: 9301, cli: 9302 },
};
