mod commit_message;

use std::env;
use std::io;
use std::os::unix::process::ExitStatusExt;
use std::path::Path;
use std::process::{self, Command};

fn run() -> io::Result<i32> {
	let args: Vec<_> = env::args_os().collect();
	if args.len() < 3 {
		eprintln!("Usage: commit-msg MESSAGE_FILE VALIDATOR [ARG ...]");
		return Ok(2);
	}
	let backup = commit_message::backup_path()?;
	// Run the validator verbatim: include the message path in its arguments.
	let code = match Command::new(&args[2]).args(&args[3..]).status() {
		Ok(status) => status
			.code()
			.unwrap_or_else(|| 128 + status.signal().unwrap_or(1)),
		Err(error) => {
			eprintln!("Cannot run validator {:?}: {error}", args[2]);
			127
		}
	};
	if code != 0 {
		match commit_message::copy_message(Path::new(&args[1]), &backup) {
			Ok(true) => {}
			Ok(false) => eprintln!("Cannot back up missing message file: {:?}", args[1]),
			Err(error) => eprintln!("Cannot back up rejected commit message: {error}"),
		}
	} else {
		commit_message::remove_backup(&backup)?;
	}
	Ok(code)
}

fn main() {
	process::exit(match run() {
		Ok(code) => code,
		Err(error) => {
			eprintln!("commit-msg: {error}");
			1
		}
	});
}
