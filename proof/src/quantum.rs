//! Future wiring point for quantum-hardware C bindings.
//!
//! Dual-execution design: when stable quantum hardware exists, a small
//! native shim will expose `quantum_collapse(challenge)` over FFI and this
//! module will call it instead of returning `QuantumHardwareAbsent`.
//! Until then every function here reports absence and the protocol mines
//! classically. Nothing here pretends otherwise.

use super::Grid;

/// Returned by every quantum path while no hardware (or shim) is linked.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct QuantumHardwareAbsent;

/// Placeholder for the future C binding.
///
/// # Safety
/// Today this performs no FFI, touches no hardware, and always returns
/// `Err(QuantumHardwareAbsent)`. When a real shim lands, its contract will
/// be: fills a 6x6 rank/regiment grid from collapsed qubit measurements,
/// with all 72 bytes < 6, borrowed slice living for the call.
pub unsafe fn collapse_stub(_challenge: &[u8]) -> Result<Grid, QuantumHardwareAbsent> {
    Err(QuantumHardwareAbsent)
}

/// Safe wrapper the protocol calls: probe hardware, report absence.
pub fn try_quantum_mine(challenge: &[u8]) -> Result<Grid, QuantumHardwareAbsent> {
    // SAFETY: collapse_stub performs no unsafe operations while no
    // hardware shim is linked (it returns Err immediately).
    unsafe { collapse_stub(challenge) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hardware_reports_absent() {
        assert_eq!(try_quantum_mine(b"physicoin-test"), Err(QuantumHardwareAbsent));
    }
}
