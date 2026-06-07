use std::process;

const HEALTH_COMMAND: &str = "health";

fn main() {
    let command = std::env::args()
        .nth(1)
        .unwrap_or_else(|| HEALTH_COMMAND.to_owned());

    match command.as_str() {
        HEALTH_COMMAND => print_health(),
        "--version" | "version" => println!("{}", vocab_core::core_version()),
        other => {
            eprintln!("unsupported vocab-core-service command: {other}");
            process::exit(64);
        }
    }
}

fn print_health() {
    println!(
        "{{\"ok\":true,\"coreVersion\":\"{}\",\"protocolVersion\":{}}}",
        vocab_core::core_version(),
        vocab_core::CORE_PROTOCOL_VERSION
    );
}
