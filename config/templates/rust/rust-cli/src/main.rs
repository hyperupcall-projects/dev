use clap::Parser;
use cli::Cmd;

mod cli;

fn main() {
	let args = cli::Cli::parse();

	match args.cmd {
		Cmd::Add { key, value } => {
			println!("add: {key} {value}");
		}
		Cmd::Remove { key } => {
			println!("remove: {key}");
		}
		Cmd::List {} => {
			println!("list");
		}
		Cmd::InternalCmd {} => {
			println!("internal")
		}
	}
}
