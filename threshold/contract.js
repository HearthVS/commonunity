/* threshold/contract.js
 *
 * OM Cipher universal connection contract — the stable handoff surface
 * that every CommonUnity app (cOMpass, Studio, Tuner, Field) can read.
 *
 * This file is intentionally small and stable. Apps depend on the shape
 * declared here. The threshold module writes; other apps read.
 *
 * If new semantic blocks are added later, add them additively. Never
 * rename or repurpose an existing block — that breaks downstream readers.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OmCipherContract = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const CONTRACT_STORAGE_KEY = 'commonunity_om_cipher_v1';
  const CONTRACT_VERSION = 1;

  function emptyContract() {
    return {
      contract_version: CONTRACT_VERSION,
      identity: {
        full_name: '',
        birth_date: '',
        birth_time: '',
        birth_place: ''
      },
      name_narrative: {
        essay: '',
        generated_at: '',
        version: 1,
        source: 'onboarding_threshold'
      },
      om_cipher: {
        palette: {
          primary: '',
          secondary: '',
          seasonal_accent: '',
          version: 1,
          source: 'om_cipher_v1'
        }
      },
      threshold: {
        completed: false,
        completed_at: '',
        version: 1,
        source: 'onboarding_threshold_v2'
      }
    };
  }

  function read() {
    try {
      const raw = window.localStorage.getItem(CONTRACT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function write(contract) {
    try {
      window.localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(contract));
      return true;
    } catch (_) {
      return false;
    }
  }

  function isThresholdCompleted() {
    const c = read();
    return !!(c && c.threshold && c.threshold.completed);
  }

  return {
    CONTRACT_STORAGE_KEY,
    CONTRACT_VERSION,
    emptyContract,
    read,
    write,
    isThresholdCompleted
  };
});
