pub mod ctc;
pub mod fsrs;

pub const CORE_PROTOCOL_VERSION: u32 = 1;

pub fn core_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
