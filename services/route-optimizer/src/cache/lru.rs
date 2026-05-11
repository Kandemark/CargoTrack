use crate::models::RouteSolution;
use lru::LruCache;
use parking_lot::Mutex;
use sha2::{Digest, Sha256};
use std::num::NonZeroUsize;

/// Caches route optimization solutions keyed by a hash of the request.
/// Identical requests (same vehicles, stops, constraints) return cached solutions.
pub struct SolutionCache {
    inner: Mutex<LruCache<String, RouteSolution>>,
}

impl SolutionCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            inner: Mutex::new(LruCache::new(NonZeroUsize::new(capacity.max(1)).unwrap())),
        }
    }

    /// Look up a cached solution for the given request hash.
    pub fn get(&self, request_hash: &str) -> Option<RouteSolution> {
        self.inner.lock().get(request_hash).cloned()
    }

    /// Store a solution in the cache.
    pub fn put(&self, request_hash: String, solution: RouteSolution) {
        self.inner.lock().put(request_hash, solution);
    }

    pub fn len(&self) -> usize {
        self.inner.lock().len()
    }
}

/// Generate a deterministic hash for a route optimization request.
pub fn hash_request(request_json: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(request_json.as_bytes());
    hex::encode(hasher.finalize())
}
